import {previewAudience} from '@/lib/promo-actions'
import {requireOperatorMutation, safeRouteError} from '@/lib/route-guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Runs the same live multi-page Resend engagement scan as the send path.
export const maxDuration = 300

export async function POST(req: Request) {
  try {
    await requireOperatorMutation()
    const body = (await req.json()) as {
      publicationId?: unknown
      windowIssues?: unknown
      engagement?: unknown
    }
    if (typeof body.publicationId !== 'string') {
      return Response.json(
        {success: false, error: 'publicationId is required'},
        {status: 400}
      )
    }
    const data = await previewAudience({
      publicationId: body.publicationId,
      windowIssues: body.windowIssues,
      engagement: body.engagement
    })
    return Response.json({success: true, data})
  } catch (err) {
    return safeRouteError(err)
  }
}
