import {HttpError, reorderSections} from '@/lib/editor-actions'
import {requireOperatorMutation, safeRouteError} from '@/lib/route-guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{slug: string}>
}

export async function POST(req: Request, ctx: RouteContext) {
  const {slug} = await ctx.params
  try {
    await requireOperatorMutation()
    const body = (await req.json()) as {order?: unknown}
    if (
      !Array.isArray(body.order) ||
      body.order.some(n => typeof n !== 'number')
    ) {
      throw new HttpError(400, 'order must be number[]')
    }
    const sections = await reorderSections(slug, body.order as number[])
    return Response.json({success: true, data: sections})
  } catch (err) {
    return safeRouteError(err)
  }
}
