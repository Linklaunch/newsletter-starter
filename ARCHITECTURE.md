# Newsletter Starter architecture

Newsletter Starter is one Next.js application with a configurable publication registry and a review-first editorial pipeline. It separates draft creation, operator approval, external delivery, public rendering, and provider webhooks so that a newly configured deployment has no delivery or automation side effects.

## System map

```text
                   operator browser
                         |
                         | Neon Auth + allowlist
                         v
                Next.js operator routes
                         |
       manual draft      |       edit / approve / promo
                         v
RSS feeds -> curation -> section writing -> Postgres drafts
optional X      |              |                 |
source          |              |                 +--> public archive and feedback
                v              v
          OpenAI-compatible LLM calls

cron scheduler -> authenticated cron routes -> eligible draft/reconcile work

approved issue or promo -> delivery gate -> Resend mutations -> broadcast
                                                        |
                                                        v
                                                Resend webhook
                                                        |
                              signature verification before JSON or writes
                                                        |
                                                        v
                                  suppression records and guarded deletion
```

## Runtime surfaces

| Surface | Responsibility | Boundary |
| --- | --- | --- |
| Operator UI and `/api/newsletter/*` | Draft, edit, preview, approve, schedule, promote, and inspect publication state. | Neon Auth plus `OPERATOR_EMAIL_ALLOWLIST`. |
| CLI, `bun newsletter` | Runs a one-shot draft for the selected publication. | Requires database and LLM configuration. Produces `pending_review`, never an email send. |
| Public archive and feedback | Renders stored issue HTML and accepts anonymous feedback. | Intentionally public. Feedback stores no authenticated operator identity. |
| Cron routes | Draft eligible publications and reconcile scheduled broadcasts. | Exact Bearer secret, automation gate, and route-specific scheduling conditions. |
| Resend webhook | Records bounces and complaints, then conditionally removes affected contacts. | Raw-body Svix signature verification before parsing, database writes, or provider actions. |
| Health route | Minimal health response. | Intentionally public and should not expose secrets or configuration state. |

`proxy.ts` treats archive, feedback, health, authentication, cron, and webhook paths as public exceptions. Other matched paths fail closed when Neon Auth is unavailable, the allowlist is empty, a session is absent, or the authenticated email is not allowlisted. Server-side mutation handlers repeat the operator check, so the proxy is not the sole authorization boundary.

## Publication model

The registry in `publications/index.ts` maps a publication ID to a `PublicationProfile`. The bundled `career-signal` entry is CareerSignal, by LinkLaunch.

A profile supplies:

- Brand fields, locale, and IANA time zone.
- RSS feed definitions and an optional X query.
- Curator and writer prompts, writer examples, and issue-section count.
- Calls to action, feedback labels, and footer copy used by the composer.
- The Resend environment-variable names for API key, audience, sender, display name, and reply-to address.

`NEWSLETTER_PUBLICATION` selects the optional default for a manual or CLI run. `NEWSLETTER_ENABLED_PUBLICATIONS` selects the publications eligible for cron drafting and webhook contact-removal targets. The enabled list is empty by default, accepts trimmed case-insensitive IDs, deduplicates entries, and rejects unknown IDs rather than guessing.

Per-publication settings such as draft day/hour, send day/hour, and `draft_enabled` live in the database. This lets a deployment configure schedules without embedding operator preferences in source.

## Issue lifecycle

1. **Collect**: The draft runner fetches RSS candidates and, only when configured, optional X candidates. X failures fall back to RSS-only collection.
2. **Filter**: Used URL hashes and recent headlines provide publication-scoped deduplication.
3. **Curate**: The curator LLM selects a limited set of candidates and a concise issue introduction.
4. **Write**: The writer LLM produces each section in the profile's voice. Source-derived OG images may be recorded as references.
5. **Persist**: The runner writes an issue and section drafts as `pending_review`. It does not compose a final send or call Resend.
6. **Review**: An authorized operator can edit, reorder, regenerate, remove, preview, or optionally generate section images.
7. **Approve**: The server recomposes the current drafts, calculates the publication's next send slot, and creates a scheduled Resend broadcast only when delivery is enabled.
8. **Reconcile**: The reconciliation cron reads broadcast status and marks scheduled issues as sent after Resend reports a send time.
9. **Archive and feedback**: The exact persisted HTML renders in the public archive. Rating links write anonymous feedback records.

Promotions are separate records. They are drafted from a brief, then an operator may trigger an engaged-audience calculation and broadcast creation. The promo operation checks the delivery gate before database, Resend, or audience work.

## External effects and fail-closed gates

The configuration parser trims values and rejects common placeholders, including `replace_me` and `example.com`. It uses only `true` or `1` as a positive opt-in.

| Effect | Required guard |
| --- | --- |
| Operator mutation | Auth client configured, non-empty allowlist, valid session, allowlisted email. |
| Cron request | Non-placeholder `CRON_SECRET` and exact `Authorization: Bearer <secret>`. |
| Automation work | Authenticated cron request and `NEWSLETTER_AUTOMATION_ENABLED=true`. Drafting additionally requires an enabled publication. |
| Any Resend POST, PATCH, PUT, or DELETE | Immediate `assertDeliveryEnabled()` before the fetch call. |
| Image generation | Image opt-in plus valid image key, base URL, model, and Blob token. |
| Webhook processing | Non-placeholder webhook secret and a valid Svix HMAC over the raw body. |
| Contact removal from a webhook | Valid webhook, delivery enabled, and delivery configuration for an enabled publication. |

The Resend HTTP module is the mutation funnel. It checks the delivery gate directly before every mutation request, including broadcasts, audience creation, contact addition, suppression, and deletion. Higher-level promo and webhook handlers also guard early to avoid unnecessary database or provider calls.

## Authentication and authorization

Neon Auth configuration is server-only. `getAuth()` returns `null` when its base URL or cookie secret is absent or a placeholder. `requireOperator()` fails with a generic authorization error when authentication is unavailable, session retrieval fails, the allowlist is empty, or the session email does not match the normalized allowlist.

No operator identity is embedded in source. Operators are supplied only through the deployment's `OPERATOR_EMAIL_ALLOWLIST` value. Client DTOs omit Resend broadcast identifiers and dashboard URLs that are not needed by the browser.

## Webhook flow

1. Resend posts its raw event body with Svix headers.
2. The route loads `RESEND_WEBHOOK_SECRET`; absent configuration returns a generic unavailable response.
3. `verifyWebhookPayload()` verifies the HMAC before JSON parsing. Invalid signatures return `401` without schema setup, database writes, contact lookup, or Resend API calls.
4. Only bounce and complaint events continue. Other verified events are acknowledged as ignored.
5. The handler records recipient outcomes idempotently in Postgres.
6. Hard bounces and complaints attempt guarded removal. Soft bounces are removed only after the configured threshold.
7. Contact-removal status is recorded only after a successful provider removal attempt.

The webhook never trusts event JSON before signature validation. It also does not remove contacts when delivery is disabled or no enabled publication provides a valid target.

## Data storage

Postgres is the durable system of record for:

- Issues, statuses, scheduled timestamps, composed HTML and plaintext.
- Section drafts and their source selection data.
- Publication scheduling settings and per-publication counters.
- Used items and recent headlines for deduplication.
- Promotional drafts, target counts, and associated broadcast metadata.
- Anonymous feedback and idempotent bounce or complaint suppression records.

Vercel Blob stores generated image bytes when image generation is enabled. Resend stores audience contacts, broadcast state, unsubscribe status, and provider-side delivery events. LLM and image providers receive the request content needed for generation. Application logs are emitted to the runtime log stream and should not contain secrets.

The application does not rely on a persistent local filesystem in production.

## Code layout

```text
app/                         pages and route handlers
app/api/cron/                authenticated drafting and reconciliation
app/api/newsletter/          operator issue, promotion, settings, and feedback APIs
app/api/webhooks/resend/     verified delivery-event handler
journalist/                  editorial pipeline and provider adapters
journalist/sources/          RSS, optional X, and source-image collection
lib/                         server configuration, guards, auth, DTOs, and actions
publications/                publication contract, registry, and sample profile
proxy.ts                     route-level access boundary
vercel.json                  included cron schedule and function duration settings
```

## Extension points

- **Publication profiles**: Add profile IDs and registry entries for isolated branding, voice, sources, scheduling, and Resend settings.
- **Sources**: Add a source adapter that returns the candidate contract used by the curator. Preserve deduplication and source provenance.
- **LLM providers**: Point `LLM_BASE_URL` at any compatible chat-completions endpoint. Keep model selection and credentials in server environment variables.
- **Image providers**: Replace the Gemini-compatible adapter when using another image API. Preserve the capability assertion before every provider and Blob operation.
- **Delivery provider**: Resend integration is concentrated in `journalist/resend-http.ts` and `journalist/email-sender.ts`. A replacement must retain review-first behavior, unsubscribe handling, and the immediate mutation gate.
- **Scheduling**: Another scheduler may invoke the cron routes with the same Bearer-secret contract. Preserve authentication before any status disclosure or work.
- **Authentication**: A different auth provider must preserve deny-by-default behavior and a server-side allowlist check for every operator mutation.
