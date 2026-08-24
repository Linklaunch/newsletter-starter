import {createLogger} from '@lib/logger'
import {configuredEnv, isValidEmail} from '../lib/server-config'
import {resendFetch, resendMutationFetch} from './resend-http'
import type {ComposedIssue} from './issue-composer'
import type {PublicationProfile} from '../publications/types'

const log = createLogger('Newsletter:Email')

export interface EmailSenderConfig {
  apiKey: string
  fromEmail: string
  fromName: string
  audienceId: string
  replyTo?: string
  /**
   * Optional Resend broadcast name. When unset, Resend shows the broadcast as
   * "Untitled" in the dashboard. Promos set this so operators can identify the
   * draft they're reviewing.
   */
  broadcastName?: string
}

export interface SendResult {
  broadcastId: string
  status: 'draft' | 'sent' | 'scheduled'
  dashboardUrl: string
}

export async function sendIssue(
  issue: ComposedIssue,
  cfg: EmailSenderConfig
): Promise<SendResult> {
  const broadcastId = await createBroadcast(issue, cfg)
  const dashboardUrl = `https://resend.com/broadcasts/${broadcastId}`
  log.success('broadcast draft created')
  return {broadcastId, status: 'draft', dashboardUrl}
}

export async function sendIssueNow(
  issue: ComposedIssue,
  cfg: EmailSenderConfig
): Promise<SendResult> {
  const broadcastId = await createBroadcast(issue, cfg)
  await sendBroadcast(broadcastId, cfg.apiKey)
  return {
    broadcastId,
    status: 'sent',
    dashboardUrl: `https://resend.com/broadcasts/${broadcastId}`
  }
}

export async function scheduleIssue(
  issue: ComposedIssue,
  cfg: EmailSenderConfig,
  scheduledAt: Date
): Promise<SendResult> {
  const broadcastId = await createBroadcast(issue, cfg)
  const dashboardUrl = `https://resend.com/broadcasts/${broadcastId}`
  await sendBroadcast(broadcastId, cfg.apiKey, scheduledAt.toISOString())
  log.success(`broadcast scheduled for ${scheduledAt.toISOString()}`)
  return {broadcastId, status: 'scheduled', dashboardUrl}
}

export async function cancelBroadcast(
  broadcastId: string,
  apiKey: string
): Promise<void> {
  const res = await resendMutationFetch(
    `/broadcasts/${broadcastId}/cancel`,
    {
      method: 'POST'
    },
    apiKey
  )
  if (!res.ok && res.status !== 404) {
    throw new Error(`Resend cancel-broadcast failed (status ${res.status})`)
  }
}

/**
 * Remove a contact from the configured audience. Resend's DELETE endpoint
 * accepts either the contact UUID or the email address as the path id, so
 * we use the email directly to skip the GET-and-find roundtrip. 404 is
 * treated as success  -  the contact is already gone.
 */
export async function deleteContactByEmail(
  audienceId: string,
  email: string,
  apiKey: string
): Promise<void> {
  const res = await resendMutationFetch(
    `/audiences/${audienceId}/contacts/${encodeURIComponent(email)}`,
    {method: 'DELETE'},
    apiKey
  )
  if (!res.ok && res.status !== 404) {
    throw new Error(`Resend delete-contact failed (status ${res.status})`)
  }
}

/**
 * Find a Resend audience by exact name, creating it if absent. Used for the
 * per-publicationId "Engaged" audience that promotional blasts target. Returns the
 * audience id.
 */
export async function findOrCreateAudience(
  name: string,
  apiKey: string
): Promise<string> {
  const listRes = await resendFetch('/audiences', {method: 'GET'}, apiKey)
  if (listRes.ok) {
    const j = (await listRes.json()) as {
      data?: Array<{id?: string; name?: string}>
    }
    const match = (j.data ?? []).find(
      a => a.name === name && typeof a.id === 'string'
    )
    if (match?.id) return match.id
  }
  const createRes = await resendMutationFetch(
    '/audiences',
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({name})
    },
    apiKey
  )
  if (!createRes.ok) {
    throw new Error(
      `Resend create-audience failed (status ${createRes.status})`
    )
  }
  const j = (await createRes.json()) as {id?: unknown}
  if (typeof j.id !== 'string' || j.id.length === 0) {
    throw new Error('Resend create-audience response missing id')
  }
  log.success('created Resend audience')
  return j.id
}

export interface AddContactsResult {
  added: number
  skipped: number
}

/*
 * Resend has no bulk contact-import API, so audience membership is one request
 * per contact. A large engaged set (e.g. ~900 contacts) is far too many to do
 * SEQUENTIALLY  -  at ~200-400ms latency each that alone blows the function
 * timeout. Instead we fire them CONCURRENTLY and let the sliding-window limiter
 * in resend-http.ts pace admission to ~8/s, so the wall-clock floor becomes the
 * Resend rate cap (~N/8 seconds) rather than latency × N.
 */
const CONTACT_CONCURRENCY = 10

async function mapConcurrent<T>(
  items: T[],
  worker: (item: T) => Promise<void>
): Promise<void> {
  let cursor = 0
  async function run(): Promise<void> {
    while (cursor < items.length) {
      const i = cursor++
      const item = items[i]
      if (item !== undefined) await worker(item)
    }
  }
  await Promise.all(
    Array.from({length: Math.min(CONTACT_CONCURRENCY, items.length)}, run)
  )
}

/** Page an audience's existing contact emails (lowercased). Used to skip re-adds. */
async function fetchExistingContactEmails(
  audienceId: string,
  apiKey: string
): Promise<Set<string>> {
  const out = new Set<string>()
  let after: string | null = null
  for (let page = 0; page < 100; page++) {
    const qs = new URLSearchParams({limit: '100'})
    if (after) qs.set('after', after)
    const res = await resendFetch(
      `/audiences/${audienceId}/contacts?${qs.toString()}`,
      {},
      apiKey
    )
    if (!res.ok) break
    const j = (await res.json()) as {
      data?: Array<{id?: string; email?: string | null}>
      has_more?: boolean
    }
    const rows = j.data ?? []
    if (rows.length === 0) break
    for (const row of rows) {
      if (row.email) out.add(row.email.trim().toLowerCase())
    }
    const last = rows[rows.length - 1]
    if (!j.has_more || !last?.id) break
    after = last.id
  }
  return out
}

/**
 * Add contacts to an audience (append-only). Each POST is idempotent from our
 * side: a 200 counts as added, a 409/"already exists" counts as skipped. We
 * never delete or reset a contact here, so a promo unsubscribe recorded by
 * Resend on this audience is never silently undone by re-adding.
 *
 * Contacts already in the audience are skipped WITHOUT a request (we diff
 * against the current membership first), so re-sends to a mostly-unchanged
 * engaged set are near-instant instead of re-POSTing every contact just to
 * learn it already exists.
 */
export async function addContactsToAudience(
  audienceId: string,
  emails: string[],
  apiKey: string
): Promise<AddContactsResult> {
  const existing = await fetchExistingContactEmails(audienceId, apiKey)
  const toAdd = emails.filter(e => !existing.has(e.trim().toLowerCase()))
  const alreadyPresent = emails.length - toAdd.length

  let added = 0
  let skipped = alreadyPresent
  await mapConcurrent(toAdd, async email => {
    const res = await resendMutationFetch(
      `/audiences/${audienceId}/contacts`,
      {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email, unsubscribed: false})
      },
      apiKey
    )
    if (res.ok) {
      added++
      return
    }
    if (res.status === 409) {
      skipped++
      return
    }
    if (res.status === 422) {
      skipped++
      return
    }
    log.warn(`add-contact failed: status=${res.status}`)
    skipped++
  })
  log.info(
    `engaged audience updated: +${added} added, ${skipped} skipped (${alreadyPresent} already present)`
  )
  return {added, skipped}
}

/**
 * Mark contacts as unsubscribed in an audience. Used to propagate main-list
 * opt-outs into the Engaged audience as a belt-and-suspenders suppression.
 * 404 (contact absent) is treated as success. Runs concurrently (paced by the
 * limiter) for the same reason as the add path.
 */
export async function suppressContactsInAudience(
  audienceId: string,
  emails: string[],
  apiKey: string
): Promise<void> {
  await mapConcurrent(emails, async email => {
    const res = await resendMutationFetch(
      `/audiences/${audienceId}/contacts/${encodeURIComponent(email)}`,
      {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({unsubscribed: true})
      },
      apiKey
    )
    if (!res.ok && res.status !== 404) {
      log.warn(`suppress-contact failed: status=${res.status}`)
    }
  })
}

export async function deleteBroadcast(
  broadcastId: string,
  apiKey: string
): Promise<void> {
  const res = await resendMutationFetch(
    `/broadcasts/${broadcastId}`,
    {
      method: 'DELETE'
    },
    apiKey
  )
  if (!res.ok && res.status !== 404) {
    log.warn(`Resend delete-broadcast non-fatal failure: status=${res.status}`)
  }
}

export interface BroadcastStats {
  status: string
  sentAt: number | null
  scheduledAt: number | null
  recipients: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  complained: number
  unsubscribed: number
  openRate: number
  clickRate: number
}

interface ResendBroadcastResponse {
  status?: string
  sent_at?: string | null
  scheduled_at?: string | null
  recipient_count?: number
  total_recipients?: number
  delivery?: {
    sent?: number
    delivered?: number
    bounced?: number
    complained?: number
  }
  engagement?: {
    opened?: number
    clicked?: number
    unsubscribed?: number
  }
  metrics?: {
    sent?: number
    delivered?: number
    opened?: number
    clicked?: number
    bounced?: number
    complained?: number
    unsubscribed?: number
  }
}

function parseTs(s: string | null | undefined): number | null {
  if (!s) return null
  const t = Date.parse(s)
  return Number.isNaN(t) ? null : t
}

function pickCount(...candidates: Array<number | undefined>): number {
  for (const c of candidates) {
    if (typeof c === 'number' && Number.isFinite(c)) return c
  }
  return 0
}

export async function fetchBroadcastStats(
  broadcastId: string,
  apiKey: string
): Promise<BroadcastStats> {
  const res = await resendFetch(
    `/broadcasts/${broadcastId}`,
    {method: 'GET'},
    apiKey
  )
  if (!res.ok) {
    throw new Error(`Resend get-broadcast failed (status ${res.status})`)
  }
  const j = (await res.json()) as ResendBroadcastResponse
  const recipients = pickCount(j.total_recipients, j.recipient_count)
  const delivered = pickCount(j.delivery?.delivered, j.metrics?.delivered)
  const opened = pickCount(j.engagement?.opened, j.metrics?.opened)
  const clicked = pickCount(j.engagement?.clicked, j.metrics?.clicked)
  const bounced = pickCount(j.delivery?.bounced, j.metrics?.bounced)
  const complained = pickCount(j.delivery?.complained, j.metrics?.complained)
  const unsubscribed = pickCount(
    j.engagement?.unsubscribed,
    j.metrics?.unsubscribed
  )
  return {
    status: j.status ?? 'unknown',
    sentAt: parseTs(j.sent_at),
    scheduledAt: parseTs(j.scheduled_at),
    recipients,
    delivered,
    opened,
    clicked,
    bounced,
    complained,
    unsubscribed,
    openRate: delivered > 0 ? opened / delivered : 0,
    clickRate: delivered > 0 ? clicked / delivered : 0
  }
}

// Resend caps the broadcast `name` at 70 characters (create-broadcast returns
// 422 "Field `name` has a maximum of 70 items" otherwise). Our promo names  -
// "<newsletter>  -  Promo: <subject>"  -  routinely exceed that. Truncate by whole
// code points (never splitting a surrogate pair like an emoji) and measure by
// UTF-16 length so we satisfy the API's counter under any interpretation.
const MAX_BROADCAST_NAME = 70

function capBroadcastName(name: string): string {
  if (name.length <= MAX_BROADCAST_NAME) return name
  const target = MAX_BROADCAST_NAME - 1 // reserve 1 for the ellipsis
  let out = ''
  for (const ch of name) {
    if (out.length + ch.length > target) break
    out += ch
  }
  return `${out}…`
}

async function createBroadcast(
  issue: ComposedIssue,
  cfg: EmailSenderConfig
): Promise<string> {
  const fromHeader = cfg.fromName
    ? `${cfg.fromName} <${cfg.fromEmail}>`
    : cfg.fromEmail

  const payload: Record<string, unknown> = {
    audience_id: cfg.audienceId,
    from: fromHeader,
    subject: issue.subject,
    html: issue.html,
    text: issue.plaintext,
    preview_text: issue.previewText
  }
  if (cfg.replyTo) payload.reply_to = cfg.replyTo
  if (cfg.broadcastName) payload.name = capBroadcastName(cfg.broadcastName)

  const res = await resendMutationFetch(
    '/broadcasts',
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    },
    cfg.apiKey
  )
  if (!res.ok) {
    throw new Error(`Resend create-broadcast failed (status ${res.status})`)
  }
  const json = (await res.json()) as {id?: unknown}
  if (typeof json.id !== 'string' || json.id.length === 0) {
    throw new Error('Resend create-broadcast response missing id')
  }
  return json.id
}

async function sendBroadcast(
  broadcastId: string,
  apiKey: string,
  scheduledAt?: string
): Promise<void> {
  const body = scheduledAt ? JSON.stringify({scheduled_at: scheduledAt}) : '{}'
  const res = await resendMutationFetch(
    `/broadcasts/${broadcastId}/send`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body
    },
    apiKey
  )
  if (!res.ok) {
    throw new Error(`Resend send-broadcast failed (status ${res.status})`)
  }
}

/**
 * Resolve Resend configuration from the publication profile's declared variable
 * names. A profile can use shared credentials or its own variables and audience.
 * Returns null when required values are absent or placeholders.
 */
export function loadEmailConfigForPublication(
  publicationId: PublicationProfile
): EmailSenderConfig | null {
  const env = publicationId.resendEnv
  const apiKey = configuredEnv(env.apiKey) ?? configuredEnv('RESEND_API_KEY')
  const fromEmail =
    configuredEnv(env.fromEmail) ?? configuredEnv('RESEND_FROM_EMAIL')
  const audienceId = configuredEnv(env.audienceId)
  if (!apiKey || !fromEmail || !isValidEmail(fromEmail) || !audienceId)
    return null
  const fromName =
    configuredEnv(env.fromName) ??
    configuredEnv('RESEND_FROM_NAME') ??
    publicationId.brand.newsletter
  const replyTo = configuredEnv(env.replyTo) ?? configuredEnv('RESEND_REPLY_TO')
  return {
    apiKey,
    fromEmail,
    fromName,
    audienceId,
    replyTo: replyTo && isValidEmail(replyTo) ? replyTo : undefined
  }
}
