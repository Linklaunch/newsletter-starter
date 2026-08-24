import {
  fetchBroadcastStats,
  loadEmailConfigForPublication
} from '@/journalist/email-sender'
import {ensureSchema, getFeedbackCounts, getIssue} from '@/journalist/runs-log'
import {getPublication} from '@/publications'
import {requireOperatorMutation, safeRouteError} from '@/lib/route-guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

interface RouteContext {
  params: Promise<{slug: string}>
}

export async function GET(_req: Request, ctx: RouteContext) {
  try {
    await requireOperatorMutation()
    const {slug} = await ctx.params
    await ensureSchema()
    const issue = await getIssue(slug)
    if (!issue)
      return Response.json(
        {success: false, error: 'issue not found'},
        {status: 404}
      )
    if (!issue.broadcastId) {
      return Response.json(
        {success: false, error: 'issue has no broadcast yet'},
        {status: 409}
      )
    }
    const config = loadEmailConfigForPublication(
      getPublication(issue.publicationId)
    )
    if (!config) {
      return Response.json(
        {success: false, error: 'delivery is not configured'},
        {status: 503}
      )
    }
    const [stats, feedback] = await Promise.all([
      fetchBroadcastStats(issue.broadcastId, config.apiKey),
      getFeedbackCounts(slug)
    ])
    return Response.json({
      success: true,
      data: {
        slug: issue.slug,
        issueNumber: issue.issueNumber,
        subject: issue.subject,
        status: issue.status,
        stats,
        feedback
      }
    })
  } catch (error) {
    return safeRouteError(error)
  }
}
