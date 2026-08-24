import {draftPromo} from '@/lib/promo-actions'
import {requireOperatorMutation, safeRouteError} from '@/lib/route-guards'
import {toOperatorPromoDto} from '@/lib/dto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: Request) {
  try {
    await requireOperatorMutation()
    const body = (await req.json()) as {
      publicationId?: unknown
      brief?: unknown
      windowIssues?: unknown
      engagement?: unknown
    }
    if (typeof body.publicationId !== 'string') {
      return Response.json(
        {success: false, error: 'publicationId is required'},
        {status: 400}
      )
    }
    const promo = await draftPromo({
      publicationId: body.publicationId,
      brief: body.brief,
      windowIssues: body.windowIssues,
      engagement: body.engagement
    })
    return Response.json({success: true, data: toOperatorPromoDto(promo)})
  } catch (err) {
    return safeRouteError(err)
  }
}
