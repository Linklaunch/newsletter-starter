import {createLogger} from '@lib/logger'
import {resendFetch} from './resend-http'
import type {PromoEngagement} from './runs-log'

const log = createLogger('Newsletter:PromoEngagement')

/*
 * IMPORTANT  -  why this scans the global email log and intersects with the
 * audience, rather than filtering by broadcast:
 *
 * Verified against the live Resend API (2026-07): the `/emails` list endpoint
 * SILENTLY IGNORES `broadcast_id`, `last_event`, and `audience_id` query
 * params  -  every variant returns the same unfiltered, newest-first firehose,
 * and each email row carries only `to` / `subject` / `created_at` /
 * `last_event` (no broadcast or audience field). Resend "segments" accept only
 * a `name` (filter/conditions are dropped), so there is no server-side
 * engagement filter available.
 *
 * So the only opener signal is the global `/emails` log. We page it once in
 * descending `created_at` order, stop at a time cutoff derived from the Nth
 * most-recent SENT broadcast of the publication's audience, and attribute an opener
 * to the publication by intersecting the recipient address with that publication's
 * audience contacts. The same audience pass yields the unsubscribe set we
 * subtract. This bounds the scan and correctly separates publications that
 * share one Resend account and one email log.
 */

export interface CollectEngagedInput {
  apiKey: string
  /** The publication's main newsletter audience id  -  bounds attribution + supplies unsubs. */
  audienceId: string
  /** How many of the most-recent sent broadcasts define the time window. */
  windowIssues: number
  /** 'opened' counts opens+clicks (a click implies an open); 'clicked' = clicks only. */
  engagement: PromoEngagement
}

export interface WindowBroadcast {
  name: string | null
  sentAt: number | null
}

export interface CollectEngagedResult {
  /** Deduped, lowercased engaged emails in the publication audience, minus unsubscribers. */
  emails: string[]
  /** The sent broadcasts whose window we scanned, most-recent first. */
  windowBroadcasts: WindowBroadcast[]
  /** How many engaged emails were dropped because they unsubscribed from the main list. */
  excludedUnsub: number
  /** Lowercased main-audience unsubscribers  -  used to suppress them in the Engaged audience too. */
  unsubscribedEmails: string[]
  /** How many sent broadcasts defined the window (<= windowIssues). */
  scannedBroadcasts: number
  /** Total distinct engaged addresses seen in the window BEFORE audience intersection. */
  engagedInWindow: number
}

interface ResendListEnvelope<T> {
  data?: T[]
  has_more?: boolean
}

interface BroadcastListItem {
  id: string
  name?: string | null
  audience_id?: string | null
  status?: string
  sent_at?: string | null
}

interface EmailListItem {
  id: string
  to?: string[] | null
  last_event?: string | null
  created_at?: string | null
}

interface ContactListItem {
  id?: string
  email?: string | null
  unsubscribed?: boolean | null
}

// Hard page caps so a runaway list can never loop forever. The Resend email
// log is large (thousands of rows across sends), so the email cap is generous;
// audiences are at most a few thousand contacts.
const MAX_EMAIL_PAGES = 400
const MAX_CONTACT_PAGES = 100

function parseTs(s: string | null | undefined): number | null {
  if (!s) return null
  const t = Date.parse(s)
  return Number.isNaN(t) ? null : t
}

async function resendGet<T>(path: string, apiKey: string): Promise<T> {
  const res = await resendFetch(path, {method: 'GET'}, apiKey)
  if (!res.ok) {
    throw new Error(`Resend read failed (status ${res.status})`)
  }
  return (await res.json()) as T
}

/**
 * The `last_event` values that count as engagement for each mode. A click
 * implies an open, so 'opened' includes clickers too.
 */
function matchingEvents(engagement: PromoEngagement): Set<string> {
  return engagement === 'clicked'
    ? new Set(['clicked'])
    : new Set(['opened', 'clicked'])
}

/** Page an audience's contacts, returning {all, unsubscribed} lowercased email sets. */
async function fetchAudienceContacts(
  audienceId: string,
  apiKey: string
): Promise<{all: Set<string>; unsubscribed: Set<string>}> {
  const all = new Set<string>()
  const unsubscribed = new Set<string>()
  let after: string | null = null
  for (let page = 0; page < MAX_CONTACT_PAGES; page++) {
    const qs = new URLSearchParams({limit: '100'})
    if (after) qs.set('after', after)
    const env = await resendGet<ResendListEnvelope<ContactListItem>>(
      `/audiences/${audienceId}/contacts?${qs.toString()}`,
      apiKey
    )
    const rows = env.data ?? []
    if (rows.length === 0) break
    for (const row of rows) {
      if (!row.email) continue
      const email = row.email.trim().toLowerCase()
      all.add(email)
      if (row.unsubscribed) unsubscribed.add(email)
    }
    const last = rows[rows.length - 1]
    if (!env.has_more || !last?.id) break
    after = last.id
  }
  return {all, unsubscribed}
}

/**
 * Page the global email log (newest first) collecting the lowercased recipient
 * addresses whose last_event matched, stopping once rows predate `sinceMs`.
 * The log is not perfectly monotonic within a millisecond, so we tolerate a
 * small grace window before breaking.
 */
async function engagedEmailsSince(
  apiKey: string,
  wanted: Set<string>,
  sinceMs: number
): Promise<Set<string>> {
  const out = new Set<string>()
  const graceMs = 5 * 60 * 1000
  let after: string | null = null
  for (let page = 0; page < MAX_EMAIL_PAGES; page++) {
    const qs = new URLSearchParams({limit: '100'})
    if (after) qs.set('after', after)
    const env = await resendGet<ResendListEnvelope<EmailListItem>>(
      `/emails?${qs.toString()}`,
      apiKey
    )
    const rows = env.data ?? []
    if (rows.length === 0) break
    let oldestOnPage = Number.POSITIVE_INFINITY
    for (const row of rows) {
      const ts = parseTs(row.created_at)
      if (ts !== null && ts < oldestOnPage) oldestOnPage = ts
      if (ts !== null && ts < sinceMs) continue
      if (!wanted.has(row.last_event ?? '')) continue
      const email = row.to?.[0]
      if (email) out.add(email.trim().toLowerCase())
    }
    const last = rows[rows.length - 1]
    // Stop once the whole page predates the window (with a grace margin).
    if (oldestOnPage < sinceMs - graceMs) break
    if (!env.has_more || !last) break
    after = last.id
  }
  return out
}

/**
 * Compute the engaged-opener set for a publication. Bounds the scan to the time
 * window covered by the last `windowIssues` sent broadcasts of the publication's
 * audience, collects openers/clickers from the global email log within that
 * window, intersects them with the publication's audience (to attribute the right
 * publication and drop anyone not on the list), and subtracts unsubscribers. All
 * emails lowercased + deduped.
 */
export async function collectEngagedContacts(
  input: CollectEngagedInput
): Promise<CollectEngagedResult> {
  const wanted = matchingEvents(input.engagement)

  const broadcastsEnv = await resendGet<ResendListEnvelope<BroadcastListItem>>(
    '/broadcasts',
    input.apiKey
  )
  const sent = (broadcastsEnv.data ?? [])
    .filter(b => b.status === 'sent' && b.audience_id === input.audienceId)
    .sort((a, b) => (parseTs(b.sent_at) ?? 0) - (parseTs(a.sent_at) ?? 0))
    .slice(0, Math.max(1, input.windowIssues))

  if (sent.length === 0) {
    log.warn('no sent broadcasts found for configured audience')
    return {
      emails: [],
      windowBroadcasts: [],
      excludedUnsub: 0,
      unsubscribedEmails: [],
      scannedBroadcasts: 0,
      engagedInWindow: 0
    }
  }

  // The window starts at the oldest send we're counting. Subtract a day so the
  // send's own delivery/open rows (which trail sent_at slightly) are included.
  const oldest = sent[sent.length - 1]
  const oldestSentAt = parseTs(oldest?.sent_at) ?? 0
  const sinceMs = oldestSentAt - 24 * 60 * 60 * 1000

  log.info(
    `window = last ${sent.length} send(s), since ${new Date(sinceMs).toISOString()} (${input.engagement})`
  )

  const [engagedInWindow, contacts] = await Promise.all([
    engagedEmailsSince(input.apiKey, wanted, sinceMs),
    fetchAudienceContacts(input.audienceId, input.apiKey)
  ])

  let excludedUnsub = 0
  const finalEmails: string[] = []
  for (const email of engagedInWindow) {
    // Attribute to this publication: the address must be on the publication's audience.
    if (!contacts.all.has(email)) continue
    if (contacts.unsubscribed.has(email)) {
      excludedUnsub++
      continue
    }
    finalEmails.push(email)
  }

  log.success(
    `engaged=${finalEmails.length} (of ${engagedInWindow.size} openers in window; excluded ${excludedUnsub} unsubscribed) across ${sent.length} send(s)`
  )

  return {
    emails: finalEmails,
    windowBroadcasts: sent.map(b => ({
      name: b.name ?? null,
      sentAt: parseTs(b.sent_at)
    })),
    excludedUnsub,
    unsubscribedEmails: Array.from(contacts.unsubscribed),
    scannedBroadcasts: sent.length,
    engagedInWindow: engagedInWindow.size
  }
}
