export interface OperatorAuthConfiguration {
  baseUrl: string
  cookieSecret: string
}

/** Authentication is usable only with configuration and a non-empty allowlist. */
export function hasOperatorAccessConfiguration(
  config: OperatorAuthConfiguration | null,
  allowlist: ReadonlySet<string>
): boolean {
  return config !== null && allowlist.size > 0
}

/** Normalizes and checks an authenticated identity against the configured allowlist. */
export function isAllowlistedOperator(
  email: string | null | undefined,
  allowlist: ReadonlySet<string>
): boolean {
  const normalized = email?.trim().toLowerCase()
  if (!normalized) return false
  return allowlist.has(normalized)
}
