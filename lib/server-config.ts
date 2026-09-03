import {
  isConfiguredValue,
  parseCommaList,
  parseEmailAllowlist,
  parseOptIn,
  resolveImageGenerationCredentials,
  trimEnv
} from './server-config-core'

export {
  isConfiguredValue,
  isValidEmail,
  parseCommaList,
  parseEmailAllowlist,
  parseOptIn,
  trimEnv
} from './server-config-core'
export type {ImageGenerationCredentials} from './server-config-core'

/** Server-side environment parsing. Values are never included in errors or logs. */
export class CapabilityError extends Error {
  constructor(
    public readonly capability:
      | 'delivery'
      | 'image-generation'
      | 'automation'
      | 'hubspot-sync',
    public readonly status = 503
  ) {
    super(`${capability} is disabled or not configured`)
    this.name = 'CapabilityError'
  }
}

/** Returns a trimmed value only when it is configured, never a placeholder. */
export function configuredEnv(name: string): string | null {
  const value = trimEnv(process.env[name])
  return isConfiguredValue(value) ? value : null
}

export function operatorEmailAllowlist(): ReadonlySet<string> {
  return parseEmailAllowlist(process.env.OPERATOR_EMAIL_ALLOWLIST)
}

export function selectedPublication(): string | null {
  return configuredEnv('NEWSLETTER_PUBLICATION')
}

export function enabledPublicationValues(): string[] {
  return parseCommaList(process.env.NEWSLETTER_ENABLED_PUBLICATIONS)
}

export function neonAuthConfig(): {
  baseUrl: string
  cookieSecret: string
} | null {
  const baseUrl = configuredEnv('NEON_AUTH_BASE_URL')
  const cookieSecret = configuredEnv('NEON_AUTH_COOKIE_SECRET')
  return baseUrl && cookieSecret ? {baseUrl, cookieSecret} : null
}

export function deliveryEnabled(): boolean {
  return parseOptIn(process.env.NEWSLETTER_DELIVERY_ENABLED)
}

export function assertDeliveryEnabled(): void {
  if (!deliveryEnabled()) throw new CapabilityError('delivery')
}

export function automationEnabled(): boolean {
  return parseOptIn(process.env.NEWSLETTER_AUTOMATION_ENABLED)
}

export function imageGenerationEnabled(): boolean {
  return parseOptIn(process.env.NEWSLETTER_IMAGE_GENERATION_ENABLED)
}

export function imageGenerationCredentials() {
  return resolveImageGenerationCredentials({
    enabled: process.env.NEWSLETTER_IMAGE_GENERATION_ENABLED,
    apiKey: process.env.NANO_BANANA_API_KEY,
    baseUrl: process.env.NANO_BANANA_BASE_URL,
    model: process.env.NANO_BANANA_MODEL,
    blobToken: process.env.BLOB_READ_WRITE_TOKEN
  })
}

export function assertImageGenerationEnabled() {
  const credentials = imageGenerationCredentials()
  if (!credentials) throw new CapabilityError('image-generation')
  return credentials
}

export function resendWebhookSecret(): string | null {
  return configuredEnv('RESEND_WEBHOOK_SECRET')
}

export function hubspotSyncEnabled(): boolean {
  return parseOptIn(process.env.HUBSPOT_SYNC_ENABLED)
}

/** Returns the access token when the sync is both enabled and configured, else null. */
export function hubspotAccessToken(): string | null {
  if (!hubspotSyncEnabled()) return null
  return configuredEnv('HUBSPOT_ACCESS_TOKEN')
}

export function assertHubspotSyncEnabled(): string {
  const token = hubspotAccessToken()
  if (!token) throw new CapabilityError('hubspot-sync')
  return token
}

export function cronSecret(): string | null {
  return configuredEnv('CRON_SECRET')
}
