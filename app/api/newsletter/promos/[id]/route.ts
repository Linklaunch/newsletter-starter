import {fetchPromoDetail, patchPromo} from '@/lib/promo-actions'
import type {PromoPatch} from '@/journalist/runs-log'
import {requireOperatorMutation, safeRouteError} from '@/lib/route-guards'
import {toOperatorPromoDto} from '@/lib/dto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{id: string}>
}

export async function GET(_req: Request, ctx: RouteContext) {
  try {
    await requireOperatorMutation()
    const {id} = await ctx.params
    const promo = await fetchPromoDetail(id)
    if (!promo)
      return Response.json(
        {success: false, error: 'promo not found'},
        {status: 404}
      )
    return Response.json({success: true, data: toOperatorPromoDto(promo)})
  } catch (error) {
    return safeRouteError(error)
  }
}

export async function PATCH(req: Request, ctx: RouteContext) {
  try {
    await requireOperatorMutation()
    const {id} = await ctx.params
    const body = (await req.json()) as Record<string, unknown>
    const patch: PromoPatch = {}
    if (typeof body.subject === 'string') patch.subject = body.subject
    if (typeof body.previewText === 'string')
      patch.previewText = body.previewText
    if (typeof body.headline === 'string') patch.headline = body.headline
    if (typeof body.bodyMarkdown === 'string')
      patch.bodyMarkdown = body.bodyMarkdown
    if (typeof body.ctaLabel === 'string') patch.ctaLabel = body.ctaLabel
    if (typeof body.ctaUrl === 'string') patch.ctaUrl = body.ctaUrl
    if (typeof body.windowIssues === 'number')
      patch.windowIssues = body.windowIssues
    if (body.engagement === 'opened' || body.engagement === 'clicked') {
      patch.engagement = body.engagement
    }
    const updated = await patchPromo(id, patch)
    return Response.json({success: true, data: toOperatorPromoDto(updated)})
  } catch (error) {
    return safeRouteError(error)
  }
}
