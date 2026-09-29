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

/**
 * LOCAL DEVELOPMENT ONLY - remove before committing or deploying.
 *
 * Neon Auth needs a real hosted identity service, which a developer machine
 * running entirely offline does not have. This returns a stand-in operator only
 * when BOTH local-development switches are set, so it cannot activate by
 * accident in any deployed environment:
 *   USE_LOCAL_PGLITE=true            (the local WASM database is in use)
 *   LOCAL_DEV_OPERATOR_EMAIL=<email> (explicitly opted in)
 * The email must still appear in OPERATOR_EMAIL_ALLOWLIST, so the allowlist
 * check below is still exercised rather than skipped.
 */
function localDevOperator(): OperatorIdentity | null {
  if (process.env.USE_LOCAL_PGLITE !== 'true') return null
  const email = process.env.LOCAL_DEV_OPERATOR_EMAIL?.trim().toLowerCase()
  return email ? {email} : null
}

/** The authenticated operator's identity, or null if there is no session. */
export async function getAuth(): Promise<OperatorIdentity | null> {
  const devIdentity = localDevOperator()
  if (devIdentity) return devIdentity
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
  // LOCAL DEVELOPMENT ONLY - see localDevOperator() above. The allowlist check
  // still applies; only the hosted-identity requirement is stood in for.
  const devIdentity = localDevOperator()
  if (devIdentity) {
    if (!isAllowlistedOperator(devIdentity.email, allowlist)) {
      throw new OperatorAccessError(403)
    }
    return
  }
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
