import {generateSectionImageApi} from '@/lib/editor-actions'
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
  let prompts: {systemPrompt?: string; imagePrompt?: string} = {}
  try {
    const body = (await req.json()) as {
      systemPrompt?: unknown
      imagePrompt?: unknown
    }
    prompts = {
      systemPrompt:
        typeof body.systemPrompt === 'string'
          ? body.systemPrompt.slice(0, 4000)
          : undefined,
      imagePrompt:
        typeof body.imagePrompt === 'string'
          ? body.imagePrompt.slice(0, 4000)
          : undefined
    }
  } catch {
    /* no body is fine */
  }
  try {
    const sections = await generateSectionImageApi(slug, i, prompts)
    return Response.json({success: true, data: sections})
  } catch (err) {
    return safeRouteError(err)
  }
}
