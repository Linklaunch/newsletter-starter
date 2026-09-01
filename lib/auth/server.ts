import 'server-only'
import {createNeonAuth} from '@neondatabase/auth/next/server'
import {hasOperatorAccessConfiguration, isAllowlistedOperator} from './access'
import {neonAuthConfig, operatorEmailAllowlist} from '../server-config'

/**
 * Singleton Neon Auth instance. Only constructed when both env vars are
 * present; `null` otherwise so an unconfigured deployment fails closed
 * instead of throwing at import time.
 */
export const auth = (() => {
  const config = neonAuthConfig()
  if (!config) return null
  return createNeonAuth({
    baseUrl: config.baseUrl,
    cookies: {secret: config.cookieSecret}
  })
})()

export interface OperatorIdentity {
  email: string
}

/** The authenticated operator's identity, or null if there is no session. */
export async function getAuth(): Promise<OperatorIdentity | null> {
  if (!auth) return null
  const {data} = await auth.getSession()
  const email = data?.user?.email
  return email ? {email} : null
}

export class OperatorAccessError extends Error {
  constructor(public readonly status: 401 | 403 = 401) {
    super(
      status === 401
        ? 'operator authentication is required'
        : 'operator access is denied'
    )
    this.name = 'OperatorAccessError'
  }
}

/** Server-side boundary for operator access. Never grants development bypasses. */
export async function requireOperator(): Promise<void> {
  const allowlist = operatorEmailAllowlist()
  const config = neonAuthConfig()
  if (!hasOperatorAccessConfiguration(config, allowlist)) {
    throw new OperatorAccessError(401)
  }
  const identity = await getAuth()
  if (!identity) {
    throw new OperatorAccessError(401)
  }
  if (!isAllowlistedOperator(identity.email, allowlist)) {
    throw new OperatorAccessError(403)
  }
}
