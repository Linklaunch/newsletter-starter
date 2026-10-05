import {toPublicIssueDetailDto} from '@/lib/dto'
import {
  clientIp,
  preflightResponse,
  publicJson,
  publicRouteError,
  readLimiter,
  tooManyRequests
} from '@/lib/public-api'
import {ensureSchema, getPublishedIssue} from '@/journalist/runs-log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Same shape the archive page enforces: lowercase, digits and hyphens only. */
const SLUG_PATTERN = /^[a-z0-9-]+$/

interface RouteContext {
  params: Promise<{slug: string}>
}

export async function OPTIONS(req: Request): Promise<Response> {
  return preflightResponse(req)
}

/**
 * One sent issue, with its rendered body.
 *
 * A draft, an unknown slug and an issue whose body was never rendered all
 * return the same 404, so the endpoint cannot be used to discover which
 * unpublished issues exist.
 */
export async function GET(
  req: Request,
  context: RouteContext
): Promise<Response> {
  try {
    const ip = clientIp(req)
    if (!readLimiter.check(ip)) {
      return tooManyRequests(req, readLimiter.retryAfterSeconds(ip))
    }

    const {slug} = await context.params
    if (!SLUG_PATTERN.test(slug)) {
      return publicJson(
        req,
        {success: false, error: 'issue not found'},
        {status: 404}
      )
    }

    await ensureSchema()
    const issue = await getPublishedIssue(slug)
    const data = issue ? toPublicIssueDetailDto(issue) : null
    if (!data) {
      return publicJson(
        req,
        {success: false, error: 'issue not found'},
        {status: 404}
      )
    }

    return publicJson(
      req,
      {success: true, data},
      {headers: {'Cache-Control': 'public, max-age=300'}}
    )
  } catch (error) {
    return publicRouteError(req, error)
  }
}
