import {cancelApproval} from '@/lib/editor-actions'
import {requireOperatorMutation, safeRouteError} from '@/lib/route-guards'
import {toOperatorIssueDto} from '@/lib/dto'

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
    const issue = await cancelApproval(slug)
    return Response.json({success: true, data: toOperatorIssueDto(issue)})
  } catch (err) {
    return safeRouteError(err)
  }
}
