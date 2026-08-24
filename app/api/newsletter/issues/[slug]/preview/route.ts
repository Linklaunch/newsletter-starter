import {buildPreviewHtml} from '@/lib/editor-actions'
import {requireOperatorMutation, safeRouteError} from '@/lib/route-guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{slug: string}>
}

export async function GET(_req: Request, ctx: RouteContext) {
  try {
    await requireOperatorMutation()
    const {slug} = await ctx.params
    const html = await buildPreviewHtml(slug)
    return new Response(html, {
      headers: {'Content-Type': 'text/html; charset=utf-8'}
    })
  } catch (error) {
    return safeRouteError(error)
  }
}
