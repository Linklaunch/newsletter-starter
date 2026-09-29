import {createHash} from 'node:crypto'
import {ensureSchema, getPublishedIssue, recordFeedback} from '@/journalist/runs-log'
import {
  clientIp,
  preflightResponse,
  publicJson,
  publicRouteError,
  readLimiter,
  tooManyRequests
} from '@/lib/public-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VALID_RATINGS = new Set([1, 2, 3])

export async function OPTIONS(req: Request): Promise<Response> {
  return preflightResponse(req)
}

/**
 * Issue feedback submitted from the website, rather than from the link in an
 * email.
 *
 * The email keeps its own GET endpoint at /api/newsletter/feedback, because a
 * mail client can only offer a link. A page can do better: this is a POST, so
 * it is not fired by link prefetchers and scanners, it answers with JSON
 * instead of a redirect, and it carries CORS so the reader stays on the site
 * they were reading rather than being bounced to this application.
 *
 * Only published issues accept feedback - otherwise the endpoint would confirm
 * which unpublished slugs exist.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const ip = clientIp(req)
    if (!readLimiter.check(ip)) {
      return tooManyRequests(req, readLimiter.retryAfterSeconds(ip))
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return publicJson(
        req,
        {success: false, error: 'invalid request body'},
        {status: 400}
      )
    }

    const {slug, rating} = (body ?? {}) as {slug?: unknown; rating?: unknown}
    const parsedRating =
      typeof rating === 'number' ? rating : Number.parseInt(String(rating), 10)

    if (
      typeof slug !== 'string' ||
      !/^[a-z0-9-]+$/.test(slug) ||
      !VALID_RATINGS.has(parsedRating)
    ) {
      return publicJson(
        req,
        {success: false, error: 'invalid feedback'},
        {status: 400}
      )
    }

    await ensureSchema()
    const issue = await getPublishedIssue(slug)
    if (!issue) {
      return publicJson(
        req,
        {success: false, error: 'issue not found'},
        {status: 404}
      )
    }

    // Same de-duplication key the email endpoint uses: enough to stop one
    // reader voting repeatedly, not enough to identify them.
    const userAgent = req.headers.get('user-agent') ?? ''
    const voterHash = createHash('sha256')
      .update(`${ip}|${userAgent}|${slug}`)
      .digest('hex')
      .slice(0, 16)

    await recordFeedback({
      slug,
      rating: parsedRating,
      voterHash,
      userAgent: userAgent || null
    })

    return publicJson(req, {success: true, data: {recorded: true}})
  } catch (error) {
    return publicRouteError(req, error)
  }
}
