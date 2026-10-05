import crypto from 'node:crypto'

export interface ResendWebhookEvent {
  type: string
  data?: {
    email_id?: string
    to?: string[]
    bounce?: {type?: string; subType?: string}
    // contact.created / contact.updated fields, per Resend's Contact object.
    email?: string
    first_name?: string | null
    last_name?: string | null
    unsubscribed?: boolean
  }
}

function decodeSecret(secret: string): Buffer | null {
  const value = secret.replace(/^whsec_/, '')
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null
  const bytes = Buffer.from(value, 'base64')
  return bytes.length > 0 ? bytes : null
}

/** Verify the Svix HMAC before parsing untrusted payload data. */
export function verifySvixSignature(
  rawBody: string,
  headers: Headers,
  secret: string
): boolean {
  const id = headers.get('svix-id')
  const timestamp = headers.get('svix-timestamp')
  const signature = headers.get('svix-signature')
  const secretBytes = decodeSecret(secret)
  if (!id || !timestamp || !signature || !secretBytes) return false

  const expected = crypto
    .createHmac('sha256', secretBytes)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest()

  let valid = false
  for (const part of signature.split(' ')) {
    const [, encoded] = part.split(',', 2)
    if (!encoded) continue
    const candidate = Buffer.from(encoded, 'base64')
    if (
      candidate.length === expected.length &&
      crypto.timingSafeEqual(candidate, expected)
    ) {
      valid = true
    }
  }
  return valid
}

export type VerifiedWebhookPayload =
  | {valid: true; event: ResendWebhookEvent}
  | {valid: false; error: 'invalid signature' | 'invalid JSON'}

/**
 * Signature validation deliberately precedes JSON parsing. Callers must only begin
 * persistence or provider work after receiving a valid result.
 */
export function verifyWebhookPayload(
  rawBody: string,
  headers: Headers,
  secret: string,
  parseJson: (value: string) => unknown = JSON.parse
): VerifiedWebhookPayload {
  if (!verifySvixSignature(rawBody, headers, secret)) {
    return {valid: false, error: 'invalid signature'}
  }
  try {
    return {valid: true, event: parseJson(rawBody) as ResendWebhookEvent}
  } catch {
    return {valid: false, error: 'invalid JSON'}
  }
}
