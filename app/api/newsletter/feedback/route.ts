import {createHash} from 'node:crypto'
import {ensureSchema, getIssue, recordFeedback} from '@/journalist/runs-log'
import {safeRouteError} from '@/lib/route-guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    await ensureSchema()
    const url = new URL(req.url)
    const slug = url.searchParams.get('slug')?.trim() ?? ''
    const ratingRaw = Number.parseInt(url.searchParams.get('rating') ?? '', 10)
    if (!slug || (ratingRaw !== 1 && ratingRaw !== 2 && ratingRaw !== 3)) {
      return Response.json(
        {success: false, error: 'invalid feedback link'},
        {status: 400}
      )
    }
    const issue = await getIssue(slug)
    if (!issue) {
      return Response.json(
        {success: false, error: 'issue not found'},
        {status: 404}
      )
    }
    const userAgent = req.headers.get('user-agent') ?? ''
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const voterHash = createHash('sha256')
      .update(`${ip}|${userAgent}|${slug}`)
      .digest('hex')
      .slice(0, 16)
    await recordFeedback({
      slug,
      rating: ratingRaw,
      voterHash,
      userAgent: userAgent || null
    })
    return Response.redirect(
      new URL(`/feedback?rating=${ratingRaw}`, url.origin),
      302
    )
  } catch (err) {
    return safeRouteError(err)
  }
}
