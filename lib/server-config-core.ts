/** Pure configuration parsing shared by server-only configuration and tests. */
const PLACEHOLDER_PATTERNS = [
  /replace_me/i,
  /^replace[-_]?with/i,
  /^your[-_]?/i,
  /^example(?:\.com)?$/i,
  /(?:^|[.@/:])example\.com(?:$|[/:])/i
]

export function trimEnv(value: string | undefined | null): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function isConfiguredValue(
  value: string | undefined | null
): value is string {
  const normalized = trimEnv(value)
  return (
    normalized.length > 0 &&
    !PLACEHOLDER_PATTERNS.some(pattern => pattern.test(normalized))
  )
}

/** Exact, deliberately narrow opt-in parser. Only `true` and `1` enable a capability. */
export function parseOptIn(value: string | undefined | null): boolean {
  const normalized = trimEnv(value).toLowerCase()
  return normalized === 'true' || normalized === '1'
}

export function parseCommaList(value: string | undefined | null): string[] {
  return trimEnv(value)
    .split(',')
    .map(item => item.trim())
    .filter(item => item.length > 0)
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(value: string): boolean {
  const email = value.trim().toLowerCase()
  return EMAIL_PATTERN.test(email) && isConfiguredValue(email)
}

export function parseEmailAllowlist(
  value: string | undefined | null
): ReadonlySet<string> {
  const emails = parseCommaList(value)
    .map(email => email.toLowerCase())
    .filter(isValidEmail)
  return new Set(emails)
}

export interface ImageGenerationCredentialsInput {
  enabled: string | undefined | null
  apiKey: string | undefined | null
  baseUrl: string | undefined | null
  model: string | undefined | null
  blobToken: string | undefined | null
}

export interface ImageGenerationCredentials {
  apiKey: string
  baseUrl: string
  model: string
  blobToken: string
}

/** Image generation is available only with an exact opt-in and complete non-placeholder configuration. */
export function resolveImageGenerationCredentials(
  input: ImageGenerationCredentialsInput
): ImageGenerationCredentials | null {
  const apiKey = trimEnv(input.apiKey)
  const baseUrl = trimEnv(input.baseUrl)
  const model = trimEnv(input.model)
  const blobToken = trimEnv(input.blobToken)
  if (
    !parseOptIn(input.enabled) ||
    !isConfiguredValue(apiKey) ||
    !isConfiguredValue(baseUrl) ||
    !isConfiguredValue(model) ||
    !isConfiguredValue(blobToken)
  ) {
    return null
  }
  return {apiKey, baseUrl, model, blobToken}
}
