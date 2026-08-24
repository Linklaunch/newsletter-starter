import {fetchPromoList} from '@/lib/promo-actions'
import {toOperatorPromoDto} from '@/lib/dto'
import {requireOperatorMutation, safeRouteError} from '@/lib/route-guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    await requireOperatorMutation()
    const url = new URL(req.url)
    const publicationId = url.searchParams.get('publicationId') ?? undefined
    const rows = await fetchPromoList(publicationId)
    return Response.json({
      success: true,
      data: rows.map(toOperatorPromoDto),
      count: rows.length
    })
  } catch (error) {
    return safeRouteError(error)
  }
}
