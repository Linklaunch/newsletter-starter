# Newsletter Starter

Newsletter Starter is a self-hosted editorial workflow for producing review-first newsletters. It collects candidates from RSS and an optional X source, uses an OpenAI-compatible LLM to curate and write issue sections, stores editable drafts, and publishes approved issues through Resend with a public archive.

The bundled `coaching` publication is an English-language example. It is intentionally generic. Replace its identity, sources, voice, calls to action, and schedule before any production use.

## Features

- Configurable publication profiles for brand, locale, time zone, sources, editorial prompts, footer copy, and delivery environment-variable names.
- RSS-first candidate collection, with an optional X source and graceful RSS-only operation.
- LLM-assisted curation, section writing, and promotional-email drafting through an OpenAI-compatible endpoint.
- Review-first issue lifecycle with editable, reorderable, regenerable section drafts.
- Public archive and anonymous issue-feedback flow.
- Resend audience broadcasts, delivery metrics, unsubscribe support, bounce and complaint suppression.
- Optional image generation and Vercel Blob storage, protected by a separate capability gate.
- Operator authentication through Neon Auth plus an explicit email allowlist.
- Authenticated cron routes for scheduled drafting and delivery reconciliation.
- Fail-closed configuration checks that reject placeholders and require explicit capability opt-ins.

## Architecture at a glance

```text
RSS feeds + optional X source
             |
             v
      curator and writer LLM calls
             |
             v
Postgres issue and section drafts, pending_review
             |
             v
operator edits, previews, and approves
             |
             v
Resend audience broadcast and public archive
             |
             +--> webhook records bounces and complaints
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for boundaries, data flow, and extension points.

## Prerequisites

- [Bun](https://bun.sh/) 1.3 or later.
- A PostgreSQL database compatible with `@vercel/postgres`.
- A configured OpenAI-compatible chat-completions endpoint.
- Neon Auth, if you will expose the operator console.
- Resend, if you will create broadcasts, reconcile delivery, or process delivery webhooks.
- An optional Blob-compatible Vercel Blob setup and image provider, if you enable image generation.
- A deployment platform that can run Next.js route handlers and invoke cron endpoints. The included configuration targets Vercel.

## Quick start

1. Create your own local configuration file:

   ```bash
   bun install
   cp .env.example .env.local
   ```

2. Populate only the values needed for local drafting. Use your own accounts and endpoints. Do not copy environment files from another project or person.
3. Customize the sample publication, described below.
4. Configure a database and create the schema.
5. Start the application:

   ```bash
   bun dev
   ```

6. Sign in with an identity included in `OPERATOR_EMAIL_ALLOWLIST`, then use the operator console to create a draft.

A fresh configuration does not send email, run scheduled work, generate images, or remove contacts. Those effects each require a separate opt-in.

## Customize a publication

Publication profiles live in [`publications/`](publications/). The bundled profile is [`publications/coaching.ts`](publications/coaching.ts).

A profile defines:

- `id`, brand strings, locale, and IANA time zone.
- RSS feeds and an optional `xQuery`.
- Curator and writer prompts plus writer examples.
- Issue-section count, CTAs, feedback copy, and footer text.
- Environment-variable names used for the profile's Resend sender and audience settings.

To create another publication, add its profile, extend `PublicationId` in `publications/types.ts`, register it in `publications/index.ts`, and add the corresponding delivery variables to `.env.example` and your deployment configuration. Keep `NEWSLETTER_ENABLED_PUBLICATIONS` empty until its schedule and safeguards are verified.

## Configuration

All supported variables are listed in [`.env.example`](.env.example). Placeholder values such as `replace_me` and `example.com` are intentionally rejected at runtime.

| Group | Variables | Notes |
| --- | --- | --- |
| Operator access | `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `OPERATOR_EMAIL_ALLOWLIST` | Both Neon values and at least one valid allowlisted email are required. |
| Publication selection | `NEWSLETTER_PUBLICATION`, `NEWSLETTER_ENABLED_PUBLICATIONS` | The enabled list is empty by default. It controls scheduled drafting and webhook contact-removal targets. |
| Explicit gates | `NEWSLETTER_AUTOMATION_ENABLED`, `NEWSLETTER_DELIVERY_ENABLED`, `NEWSLETTER_IMAGE_GENERATION_ENABLED` | Only exact `true` or `1` enables a gate. |
| Scheduler | `CRON_SECRET` | Required as an exact Bearer token on both cron routes. |
| Resend | `RESEND_API_KEY`, `RESEND_AUDIENCE_ID`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME`, `RESEND_REPLY_TO`, `RESEND_WEBHOOK_SECRET` | Required fields vary by operation. Delivery mutations also require the delivery gate. |
| LLM | `LLM_BASE_URL`, `LLM_API_KEY`, `NEWSLETTER_CURATOR_MODEL`, `NEWSLETTER_WRITER_MODEL`, `NEWSLETTER_WRITER_FALLBACK_MODELS`, `NEWSLETTER_MODEL` | The last variable is a legacy single-model fallback. Prefer role-specific model variables. |
| Optional X source | `X_SOURCE_API_URL` | Leave blank for RSS-only drafting. |
| Images | `NANO_BANANA_API_KEY`, `NANO_BANANA_BASE_URL`, `NANO_BANANA_MODEL`, `BLOB_READ_WRITE_TOKEN` | All values and the image gate are required. The bundled adapter expects a Gemini-compatible `generateContent` API. |
| Data | `POSTGRES_URL` | Required for persisted application state. |
| Tuning | `LOG_LEVEL`, `NEWSLETTER_SECTIONS_PER_ISSUE`, `NEWSLETTER_RSS_WINDOW_DAYS`, `NEWSLETTER_RSS_PER_FEED`, `NEWSLETTER_DEDUP_WINDOW_DAYS`, `NEWSLETTER_X_LIMIT`, `NEWSLETTER_ARCHIVE_BASE_URL` | These tune behavior without enabling delivery or automation. |

## Safe opt-in gates

External effects fail closed.

| Effect | Required conditions |
| --- | --- |
| Scheduled drafting | Valid `CRON_SECRET`, authenticated cron request, `NEWSLETTER_AUTOMATION_ENABLED=true`, and at least one enabled publication. |
| Resend mutations | `NEWSLETTER_DELIVERY_ENABLED=true` immediately before every POST, PATCH, PUT, or DELETE request. This includes broadcasts, audiences, contact suppression, and contact deletion. |
| Image generation | `NEWSLETTER_IMAGE_GENERATION_ENABLED=true` plus non-placeholder image API key, base URL, model, and Blob token. |
| Webhook contact deletion | A valid Resend Svix signature, delivery enabled, and a matching configured enabled publication. |
| Operator mutations | A working Neon Auth configuration and an authenticated identity in the configured allowlist. |

Draft generation itself ends in `pending_review`. It does not create a Resend broadcast. Approval and promotional broadcast creation can still only mutate Resend when delivery is explicitly enabled.

## Local development

```bash
bun install
bun dev
```

The development server uses port 3008. Operator routes require working local authentication and an allowlisted identity. Public archive routes, feedback, health, cron, auth, and webhook routes have deliberately different access boundaries, so exercise them with care.

For a one-shot draft run after configuring the database and LLM, use:

```bash
bun newsletter
```

The CLI drafts the selected publication and persists it as `pending_review`. It does not send an issue.

## Database and schema

Set `POSTGRES_URL` to a database created for this deployment. The application owns tables for issues, item deduplication, section drafts, publication settings, promotional drafts, feedback, and bounce or complaint records.

Run the authenticated schema migration route after deployment:

```text
POST /api/admin/migrate
```

Use a deployment-specific database role with only the privileges the application needs. Back up production data before schema changes, and never point local development at a database that contains customer data unless your access controls and retention policy permit it.

## Resend and webhook setup

1. Verify a sending domain in Resend and publish its DNS records.
2. Create an audience for each publication and configure the profile's audience variable.
3. Set sender and reply-to values using addresses on your verified domain.
4. Configure `RESEND_WEBHOOK_SECRET`.
5. Register `https://your-domain.example/api/webhooks/resend` for bounce and complaint events.
6. Keep `NEWSLETTER_DELIVERY_ENABLED=false` while validating drafts, previews, and webhook signatures.
7. Enable delivery only when you are ready to allow Resend mutations.

The webhook validates Svix headers against the raw body before parsing JSON, writing database records, or attempting contact removal. Unsubscribe handling remains with Resend's audience-broadcast unsubscribe token.

## OpenAI-compatible LLM setup

Newsletter Starter calls the standard chat-completions shape. Configure:

```text
LLM_BASE_URL=https://your-llm-provider.example/v1
LLM_API_KEY=your_provider_key
NEWSLETTER_CURATOR_MODEL=your-curation-model
NEWSLETTER_WRITER_MODEL=your-writing-model
```

The endpoint must accept chat-completions requests and return compatible JSON. Model identifiers are provider-specific. `NEWSLETTER_WRITER_FALLBACK_MODELS` accepts a comma-separated list and is optional. No LLM provider endpoint or model is assumed by default.

## Image generation

Image generation is optional. The included adapter sends a Gemini-compatible `generateContent` request and stores successful image bytes in Vercel Blob. Before enabling it, configure all four image variables, verify Blob access, and set `NEWSLETTER_IMAGE_GENERATION_ENABLED=true`.

If your image provider has a different API shape, implement a replacement adapter behind the existing `generateBrandedSectionImage` boundary. Keep the capability assertion before any provider or storage call.

## Cron

[`vercel.json`](vercel.json) schedules:

- `/api/cron/draft` hourly. The route authenticates the Bearer secret, checks the automation gate, then only runs publications whose database schedule matches the current UTC day and hour.
- `/api/cron/reconcile` every 15 minutes. The route authenticates the same way, checks the automation gate, and reconciles already scheduled broadcasts.

If you use another scheduler, call the endpoints over HTTPS with `Authorization: Bearer <CRON_SECRET>`. Keep the secret out of URLs, logs, and client-side code.

## Deployment

The included deployment configuration is Vercel-oriented, but the application can run on another compatible platform if it provides Next.js server execution, PostgreSQL connectivity, secure environment variables, and scheduled HTTPS requests.

Before production:

1. Set all configuration in the deployment environment, not in committed files.
2. Configure the database, operator authentication, and allowlist.
3. Deploy with all effect gates false.
4. Run the schema setup route as an authenticated operator.
5. Validate public archive rendering and signed webhook rejection.
6. Configure Resend and scheduler secrets.
7. Enable only the capabilities you intend to use.

Do not rely on the sample publication's sources, brand, time zone, or delivery settings for a live publication.

## Tests and validation

```bash
bun test
bun run typecheck
bun run lint
bun run check
```

`test`, `typecheck`, `lint`, and `check` are non-mutating. Use `bun run format` or `bun run check:fix` only when you intentionally want files rewritten.

The test suite covers configuration parsing, publication resolution, auth allowlisting, cron guards, webhook signature verification, image configuration, generic composition, delivery gating, and the absence of hardcoded operator identities.

## Data and privacy

The database stores editorial drafts, issue content, publication settings, anonymous feedback, promotion metadata, and bounce or complaint suppression records. Resend receives the content and audience identifiers necessary to create broadcasts and report delivery events. Configured LLM and image providers receive the prompts and source-derived content needed for generation.

Choose providers appropriate for your privacy obligations. Minimize source content, avoid putting personal or sensitive data in prompts, define retention and deletion policies, and restrict access to databases, provider dashboards, environment variables, and logs. The project does not provide legal or compliance advice.

## Security

Please do not open public issues for suspected vulnerabilities or include credentials, tokens, or personal data in reports. See [SECURITY.md](SECURITY.md) for private reporting through GitHub Security Advisories.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before opening a pull request.

## License

Licensed under the [MIT License](LICENSE).
