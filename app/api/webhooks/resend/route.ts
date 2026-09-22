import {createLogger, safeErrorSummary} from '@lib/logger'
import {
  deleteContactByEmail,
  loadEmailConfigForPublication
} from '@/journalist/email-sender'
import {
  ensureSchema,
  markContactRemoved,
  recordBounce,
  softBounceCount
} from '@/journalist/runs-log'
import {enabledPublications} from '@/publications'
import {verifyWebhookPayload} from '@/lib/resend-webhook-security'
import {
  deliveryEnabled,
  hubspotSyncEnabled,
  resendWebhookSecret
} from '@/lib/server-config'
import {trySyncContactToHubspot} from '@/journalist/hubspot-sync'

const log = createLogger('NewsletterWebhook:Resend')

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const SOFT_BOUNCE_THRESHOLD = 3

function classifyBounce(rawType: string | undefined): 'hard' | 'soft' {
  const type = (rawType ?? '').toLowerCase()
  return type === 'permanent' || type === 'hard' ? 'hard' : 'soft'
}

interface AudienceTarget {
  audienceId: string
  apiKey: string
}
type Outcome =
  | 'hard_recorded'
  | 'hard_removed'
  | 'soft_recorded'
  | 'soft_removed'
  | 'complaint_recorded'
  | 'complaint_removed'
  | 'duplicate'

async function removeContact(
  targets: AudienceTarget[],
  email: string
): Promise<boolean> {
  if (!deliveryEnabled()) return false
  let removed = false
  for (const target of targets) {
    try {
      // deleteContactByEmail independently performs the immediate delivery guard.
      await deleteContactByEmail(target.audienceId, email, target.apiKey)
      removed = true
    } catch (error) {
      log.warn(`contact deletion failed: ${safeErrorSummary(error)}`)
    }
  }
  return removed
}

async function handleRecipient(
  email: string,
  eventType: 'email.bounced' | 'email.complained',
  emailId: string | null,
  bounceType: string | undefined,
  bounceSubtype: string | null,
  targets: AudienceTarget[]
): Promise<{outcome: Outcome}> {
  if (eventType === 'email.complained') {
    const fresh = await recordBounce({
      email,
      bounceType: 'complaint',
      bounceSubtype: null,
      emailId,
      contactRemoved: false
    })
    if (!fresh) return {outcome: 'duplicate'}
    const removed = await removeContact(targets, email)
    if (removed) await markContactRemoved(email)
    return {outcome: removed ? 'complaint_removed' : 'complaint_recorded'}
  }

  const kind = classifyBounce(bounceType)
  const fresh = await recordBounce({
    email,
    bounceType: kind,
    bounceSubtype,
    emailId,
    contactRemoved: false
  })
  if (!fresh) return {outcome: 'duplicate'}
  if (kind === 'hard') {
    const removed = await removeContact(targets, email)
    if (removed) await markContactRemoved(email)
    return {outcome: removed ? 'hard_removed' : 'hard_recorded'}
  }

  const count = await softBounceCount(email)
  if (count >= SOFT_BOUNCE_THRESHOLD) {
    const removed = await removeContact(targets, email)
    if (removed) await markContactRemoved(email)
    return {outcome: removed ? 'soft_removed' : 'soft_recorded'}
  }
  return {outcome: 'soft_recorded'}
}

export async function POST(req: Request): Promise<Response> {
  const secret = resendWebhookSecret()
  if (!secret)
    return Response.json(
      {success: false, error: 'webhook not configured'},
      {status: 503}
    )

  const rawBody = await req.text()
  const verified = verifyWebhookPayload(rawBody, req.headers, secret)
  if (!verified.valid) {
    log.warn(`webhook ${verified.error}`)
    return Response.json(
      {success: false, error: verified.error},
      {status: verified.error === 'invalid signature' ? 401 : 400}
    )
  }
  const {event} = verified
  if (event.type === 'contact.created') {
    if (!hubspotSyncEnabled()) {
      return Response.json({success: true, data: {ignored: true}})
    }
    const email = event.data?.email?.trim()
    if (!email) {
      return Response.json({success: true, data: {ignored: true}})
    }
    const synced = await trySyncContactToHubspot({
      email,
      firstName: event.data?.first_name ?? null,
      lastName: event.data?.last_name ?? null
    })
    return Response.json({success: true, data: {hubspotSynced: synced}})
  }
  if (event.type !== 'email.bounced' && event.type !== 'email.complained') {
    return Response.json({success: true, data: {ignored: true}})
  }

  try {
    await ensureSchema()
    const targets: AudienceTarget[] = []
    if (deliveryEnabled()) {
      for (const publication of enabledPublications()) {
        const config = loadEmailConfigForPublication(publication)
        if (config)
          targets.push({audienceId: config.audienceId, apiKey: config.apiKey})
      }
    }

    const recipients = (event.data?.to ?? []).filter(
      (value): value is string =>
        typeof value === 'string' && value.trim().length > 0
    )
    const outcomes: Record<Outcome, number> = {
      hard_recorded: 0,
      hard_removed: 0,
      soft_recorded: 0,
      soft_removed: 0,
      complaint_recorded: 0,
      complaint_removed: 0,
      duplicate: 0
    }
    for (const email of recipients) {
      try {
        const result = await handleRecipient(
          email,
          event.type,
          event.data?.email_id ?? null,
          event.data?.bounce?.type,
          event.data?.bounce?.subType ?? null,
          targets
        )
        outcomes[result.outcome]++
      } catch (error) {
        log.warn(
          `webhook recipient handling failed: ${safeErrorSummary(error)}`
        )
      }
    }
    return Response.json({
      success: true,
      data: {processed: recipients.length, outcomes}
    })
  } catch (error) {
    log.error(`webhook processing failed: ${safeErrorSummary(error)}`)
    return Response.json(
      {success: false, error: 'webhook processing failed'},
      {status: 500}
    )
  }
}
