import {regenerateSectionApi} from '@/lib/editor-actions'
import {requireOperatorMutation, safeRouteError} from '@/lib/route-guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

interface RouteContext {
  params: Promise<{slug: string; index: string}>
}

export async function POST(req: Request, ctx: RouteContext) {
  const {slug, index} = await ctx.params
  const i = Number.parseInt(index, 10)
  if (Number.isNaN(i)) {
    return Response.json(
      {success: false, error: 'invalid index'},
      {status: 400}
    )
  }
  try {
    await requireOperatorMutation()
  } catch (err) {
    return safeRouteError(err)
  }
  let angle: string | undefined
  try {
    const body = (await req.json()) as {angle?: unknown}
    if (typeof body.angle === 'string') angle = body.angle.trim().slice(0, 500)
  } catch {
    /* no body is fine */
  }
  try {
    const sections = await regenerateSectionApi(slug, i, angle)
    return Response.json({success: true, data: sections})
  } catch (err) {
    return safeRouteError(err)
  }
}
