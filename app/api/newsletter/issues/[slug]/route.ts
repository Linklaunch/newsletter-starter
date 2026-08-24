import {fetchIssueDetail, patchIssueMeta} from '@/lib/editor-actions'
import {requireOperatorMutation, safeRouteError} from '@/lib/route-guards'
import {toOperatorIssueDetailDto, toOperatorIssueDto} from '@/lib/dto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{slug: string}>
}

export async function GET(_req: Request, ctx: RouteContext) {
  const {slug} = await ctx.params
  try {
    await requireOperatorMutation()
    const detail = await fetchIssueDetail(slug)
    if (!detail)
      return Response.json({success: false, error: 'not found'}, {status: 404})
    return Response.json({
      success: true,
      data: toOperatorIssueDetailDto(detail)
    })
  } catch (err) {
    return errResponse(err)
  }
}

export async function PUT(req: Request, ctx: RouteContext) {
  return patch(req, ctx)
}

export async function PATCH(req: Request, ctx: RouteContext) {
  return patch(req, ctx)
}

async function patch(req: Request, ctx: RouteContext) {
  const {slug} = await ctx.params
  try {
    await requireOperatorMutation()
    const body = (await req.json()) as {subject?: string; intro?: string}
    const updated = await patchIssueMeta(slug, body)
    return Response.json({success: true, data: toOperatorIssueDto(updated)})
  } catch (err) {
    return errResponse(err)
  }
}

function errResponse(err: unknown): Response {
  return safeRouteError(err)
}
