import 'server-only'
import {hasOperatorAccessConfiguration} from './access'
import {neonAuthConfig, operatorEmailAllowlist} from '../server-config'

/**
 * Authentication is integration-owned in this starter. Until a deployer adds a
 * server-side session adapter, all operator requests deny by default.
 */
export function getAuth(): null {
  return null
}

export function requireAuth(): never {
  throw new Error('authentication integration is not configured')
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
  if (!hasOperatorAccessConfiguration(config, allowlist) || !getAuth()) {
    throw new OperatorAccessError(401)
  }
  throw new OperatorAccessError(401)
}
