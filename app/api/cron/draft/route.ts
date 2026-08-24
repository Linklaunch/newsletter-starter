import {runJournalistAgent} from '../../../../journalist/run'
import {getSettings} from '../../../../journalist/runs-log'
import {enabledPublications} from '../../../../publications'
import {isAuthorizedCronRequest, shouldRunAutomation} from '@/lib/cron-guards'
import {automationEnabled, cronSecret} from '@/lib/server-config'
import {safeErrorSummary} from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function authenticated(req: Request): boolean {
  return isAuthorizedCronRequest(req.headers.get('authorization'), cronSecret())
}

export async function GET(req: Request): Promise<Response> {
  // Authenticate before revealing whether automation is enabled.
  if (!authenticated(req))
    return Response.json({success: false, error: 'unauthorized'}, {status: 401})
  if (!automationEnabled())
    return Response.json({success: true, data: {skipped: true}})

  try {
    const publications = enabledPublications()
    if (!shouldRunAutomation(true, publications.length)) {
      return Response.json({success: true, data: {skipped: true}})
    }

    const now = new Date()
    const day = now.getUTCDay()
    const hour = now.getUTCHours()
    let triggered = 0
    let skipped = 0
    let failed = 0
    for (const publication of publications) {
      const settings = await getSettings(publication.id)
      if (
        !settings.draftEnabled ||
        day !== settings.draftDayUtc ||
        hour !== settings.draftHourUtc
      ) {
        skipped++
        continue
      }
      try {
        await runJournalistAgent({publicationId: publication.id})
        triggered++
      } catch (error) {
        failed++
        console.warn(
          `newsletter draft cron publication failed: ${safeErrorSummary(error)}`
        )
      }
    }
    return Response.json({
      success: failed === 0,
      data: {triggered, skipped, failed, at: now.getTime()}
    })
  } catch (error) {
    console.error(`newsletter draft cron failed: ${safeErrorSummary(error)}`)
    return Response.json(
      {success: false, error: 'cron execution failed'},
      {status: 500}
    )
  }
}
