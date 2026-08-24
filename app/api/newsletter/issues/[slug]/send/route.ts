import {confirmSend} from '@/lib/editor-actions'
import {requireOperatorMutation, safeRouteError} from '@/lib/route-guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface RouteContext {
  params: Promise<{slug: string}>
}

export async function POST(_req: Request, ctx: RouteContext) {
  const {slug} = await ctx.params
  try {
    await requireOperatorMutation()
    const result = await confirmSend(slug)
    return Response.json({success: true, data: {completed: true}})
  } catch (err) {
    return safeRouteError(err)
  }
}
