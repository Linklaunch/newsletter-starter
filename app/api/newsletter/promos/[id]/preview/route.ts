import {buildPromoPreviewHtml} from '@/lib/promo-actions'
import {requireOperatorMutation, safeRouteError} from '@/lib/route-guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{id: string}>
}

export async function GET(_req: Request, ctx: RouteContext) {
  try {
    await requireOperatorMutation()
    const {id} = await ctx.params
    const html = await buildPromoPreviewHtml(id)
    return new Response(html, {
      headers: {'Content-Type': 'text/html; charset=utf-8'}
    })
  } catch (error) {
    return safeRouteError(error)
  }
}
