import {resendContactFetch} from '../journalist/resend-http'
import type {PublicationProfile} from '../publications/types'
import {configuredEnv} from './server-config'
import {isValidEmail} from './server-config-core'

/**
 * Public subscribe logic, kept out of the route handler so it can be tested
 * without a server, a database or a network call.
 */

export interface SubscribeConfig {
  apiKey: string
  audienceId: string
}

export type ValidationResult =
  | {ok: true; email: string}
  | {ok: false; reason: 'missing' | 'invalid' | 'too_long' | 'honeypot'}

/** Longest address we will accept. RFC allows 254; anything longer is not a real inbox. */
const MAX_EMAIL_LENGTH = 254

/** Lowercased and trimmed, so `A@B.com ` and `a@b.com` are never two contacts. */
export function normalizeEmail(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : ''
}

/**
 * Validate a submitted body.
 *
 * `website` is a honeypot: a real form keeps it hidden and empty, so anything
 * in it means a bot. It is rejected here rather than in the route so the rule
 * is covered by tests.
 */
export function validateSubscribeBody(body: unknown): ValidationResult {
  const input = (body ?? {}) as Record<string, unknown>
  if (normalizeEmail(input.website).length > 0) {
    return {ok: false, reason: 'honeypot'}
  }
  const email = normalizeEmail(input.email)
  if (!email) return {ok: false, reason: 'missing'}
  if (email.length > MAX_EMAIL_LENGTH) return {ok: false, reason: 'too_long'}
  if (!isValidEmail(email)) return {ok: false, reason: 'invalid'}
  return {ok: true, email}
}

/**
 * Resolve the credentials a subscribe needs.
 *
 * Only the API key and the audience are required. Sending configuration
 * (from address, reply-to) is deliberately not required, because a signup does
 * not send anything - demanding it would block subscriptions before the first
 * issue is ready.
 *
 * The audience must be the same one the broadcast targets, or a subscriber is
 * created but never receives an issue and nothing reports an error.
 */
export function resolveSubscribeConfig(
  publication: PublicationProfile
): SubscribeConfig | null {
  const env = publication.resendEnv
  const apiKey = configuredEnv(env.apiKey) ?? configuredEnv('RESEND_API_KEY')
  const audienceId = configuredEnv(env.audienceId)
  if (!apiKey || !audienceId) return null
  return {apiKey, audienceId}
}

export type SubscribeOutcome =
  | {status: 'added'}
  | {status: 'already_subscribed'}
  | {status: 'failed'; httpStatus: number}

/**
 * Add one address to the audience.
 *
 * A 409 from Resend means the contact already exists. That is reported as its
 * own outcome so the caller can log it accurately, but callers MUST return the
 * same response to the browser for `added` and `already_subscribed`: telling a
 * stranger which addresses are already on the list turns the form into a
 * membership oracle.
 */
export async function addSubscriber(
  email: string,
  config: SubscribeConfig
): Promise<SubscribeOutcome> {
  const res = await resendContactFetch(
    `/audiences/${config.audienceId}/contacts`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email, unsubscribed: false})
    },
    config.apiKey
  )
  if (res.ok) return {status: 'added'}
  if (res.status === 409) return {status: 'already_subscribed'}
  await res.body?.cancel().catch(() => {})
  return {status: 'failed', httpStatus: res.status}
}

/** Log-safe form of an address: enough to correlate, not enough to read. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return '***'
  const head = local.slice(0, 2)
  return `${head}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`
}
