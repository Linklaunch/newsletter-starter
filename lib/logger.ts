import consola, {LogLevels} from 'consola'
import type {ConsolaInstance} from 'consola'
import {configuredEnv, trimEnv} from './server-config'

export {LogLevels}
export type {ConsolaInstance}

/** Do not propagate provider response bodies, credentials, identifiers, or PII into logs. */
export function safeErrorSummary(error: unknown): string {
  if (error instanceof Error && error.name === 'CapabilityError')
    return error.message
  return 'operation failed'
}

export function safeStatus(response: Pick<Response, 'status'>): string {
  return `status=${response.status}`
}

export function safeRequestId(headers: Headers): string | null {
  const value = trimEnv(
    headers.get('x-request-id') ?? headers.get('x-vercel-id')
  )
  return value && /^[A-Za-z0-9._-]{1,128}$/.test(value) ? value : null
}

/**
 * Tagged logger. Runtime logs go to the platform log stream. Callers must only
 * pass safe summaries, status codes, counts, and request IDs.
 */
export function createLogger(tag: string): ConsolaInstance {
  return consola.withTag(tag)
}

const levelName = (configuredEnv('LOG_LEVEL') ??
  'info') as keyof typeof LogLevels
const level = LogLevels[levelName] ?? LogLevels.info
consola.level = level
