import {createLogger, safeErrorSummary} from '@lib/logger'
import {
  fetchBroadcastStats,
  loadEmailConfigForPublication
} from '@/journalist/email-sender'
import {
  ensureSchema,
  listScheduledIssues,
  markScheduledIssueSent
} from '@/journalist/runs-log'
import {getPublication} from '@/publications'
import {isAuthorizedCronRequest} from '@/lib/cron-guards'
import {automationEnabled, cronSecret} from '@/lib/server-config'

const log = createLogger('NewsletterCron:Reconcile')

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authenticated(req: Request): boolean {
  return isAuthorizedCronRequest(req.headers.get('authorization'), cronSecret())
}

export async function GET(req: Request): Promise<Response> {
  if (!authenticated(req))
    return Response.json({success: false, error: 'unauthorized'}, {status: 401})
  if (!automationEnabled())
    return Response.json({success: true, data: {skipped: true}})

  try {
    await ensureSchema()
    const scheduled = await listScheduledIssues()
    let flipped = 0
    let failed = 0
    for (const issue of scheduled) {
      if (!issue.broadcastId) continue
      const config = loadEmailConfigForPublication(
        getPublication(issue.publicationId)
      )
      if (!config) {
        failed++
        continue
      }
      try {
        const stats = await fetchBroadcastStats(
          issue.broadcastId,
          config.apiKey
        )
        if (stats.sentAt) {
          await markScheduledIssueSent(issue.slug)
          flipped++
        }
      } catch (error) {
        failed++
        log.warn(`reconcile item failed: ${safeErrorSummary(error)}`)
      }
    }
    return Response.json({
      success: failed === 0,
      data: {checked: scheduled.length, flipped, failed}
    })
  } catch (error) {
    log.error(`reconcile cron failed: ${safeErrorSummary(error)}`)
    return Response.json(
      {success: false, error: 'cron execution failed'},
      {status: 500}
    )
  }
}
