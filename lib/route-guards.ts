import 'server-only'
import {OperatorAccessError, requireOperator} from './auth/server'
import {CapabilityError} from './server-config'
import {safeErrorSummary} from './logger'

export async function requireOperatorMutation(): Promise<void> {
  await requireOperator()
}

export function safeRouteError(error: unknown, fallbackStatus = 500): Response {
  if (error instanceof OperatorAccessError) {
    return Response.json(
      {success: false, error: error.message},
      {status: error.status}
    )
  }
  if (error instanceof CapabilityError) {
    return Response.json(
      {
        success: false,
        error: `${error.capability} is disabled`,
        code: 'CAPABILITY_DISABLED'
      },
      {status: error.status}
    )
  }
  const status =
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as {status?: unknown}).status === 'number'
      ? (error as {status: number}).status
      : fallbackStatus
  const message =
    error instanceof Error && error.name === 'HttpError'
      ? error.message
      : safeErrorSummary(error)
  return Response.json({success: false, error: message}, {status})
}
