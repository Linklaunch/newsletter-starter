import {toPublicIssueDto} from '@/lib/dto'
import {
  clientIp,
  preflightResponse,
  publicJson,
  publicRouteError,
  readLimiter,
  tooManyRequests
} from '@/lib/public-api'
import {ensureSchema, listPublishedIssues} from '@/journalist/runs-log'
import {isPublicationId} from '@/publications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

export async function OPTIONS(req: Request): Promise<Response> {
  return preflightResponse(req)
}

/**
 * Public list of sent issues, newest first.
 *
 * Uses `listPublishedIssues`, never `listIssues` - the latter returns drafts as
 * well, and a draft's subject line is not published information.
 */
export async function GET(req: Request): Promise<Response> {
  try {
    const ip = clientIp(req)
    if (!readLimiter.check(ip)) {
      return tooManyRequests(req, readLimiter.retryAfterSeconds(ip))
    }

    const url = new URL(req.url)

    const parsedLimit = Number.parseInt(
      url.searchParams.get('limit') ?? '',
      10
    )
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), MAX_LIMIT)
      : DEFAULT_LIMIT

    const requested = url.searchParams.get('publicationId')
    // An unrecognised publication returns nothing rather than quietly falling
    // back to every publication, which would be a surprising way to leak one.
    if (requested && !isPublicationId(requested)) {
      return publicJson(req, {success: true, data: [], count: 0})
    }

    await ensureSchema()
    const rows = await listPublishedIssues(requested || undefined, limit)
    const data = rows.map(toPublicIssueDto)

    return publicJson(
      req,
      {success: true, data, count: data.length},
      {headers: {'Cache-Control': 'public, max-age=300'}}
    )
  } catch (error) {
    return publicRouteError(req, error)
  }
}
