import {createLogger, safeErrorSummary} from '@lib/logger'
import {assertHubspotSyncEnabled} from '../lib/server-config'

const log = createLogger('Newsletter:HubSpot')

const HUBSPOT_API = 'https://api.hubapi.com'
const MAX_RETRIES = 3

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export interface HubspotContactInput {
  email: string
  firstName?: string | null
  lastName?: string | null
}

/**
 * Create-or-update a contact by email via HubSpot's batch upsert endpoint.
 * A single input either creates a new contact or updates the existing one
 * matched by email  -  no separate lookup step needed. Throws on a non-OK
 * response so callers (the webhook handler) can log and move on without
 * failing the whole request over one contact.
 */
export async function upsertHubspotContact(
  input: HubspotContactInput
): Promise<void> {
  const token = assertHubspotSyncEnabled()
  const properties: Record<string, string> = {email: input.email}
  if (input.firstName) properties.firstname = input.firstName
  if (input.lastName) properties.lastname = input.lastName

  const body = JSON.stringify({
    inputs: [{id: input.email, idProperty: 'email', properties}]
  })

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(
      `${HUBSPOT_API}/crm/v3/objects/contacts/batch/upsert`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body
      }
    )
    if (res.status !== 429 || attempt >= MAX_RETRIES) {
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(
          `HubSpot contact upsert failed (status ${res.status}): ${text.slice(0, 300)}`
        )
      }
      log.success(`synced contact to HubSpot: ${input.email}`)
      return
    }
    const retryAfterHeader = Number(res.headers.get('retry-after'))
    const delayMs =
      Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
        ? retryAfterHeader * 1000
        : 1000 * 2 ** attempt
    log.warn(
      `HubSpot 429  -  retrying in ${delayMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
    )
    await sleep(delayMs)
  }
}

/**
 * Best-effort sync: logs and swallows failures rather than throwing, since
 * this runs inside the Resend webhook handler and a HubSpot outage should
 * never fail the webhook response or block Resend-side contact handling.
 */
export async function trySyncContactToHubspot(
  input: HubspotContactInput
): Promise<boolean> {
  try {
    await upsertHubspotContact(input)
    return true
  } catch (error) {
    log.warn(`HubSpot sync failed: ${safeErrorSummary(error)}`)
    return false
  }
}
