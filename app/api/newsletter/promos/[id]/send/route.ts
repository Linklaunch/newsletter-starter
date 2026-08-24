import {sendPromo} from '@/lib/promo-actions'
import {requireOperatorMutation, safeRouteError} from '@/lib/route-guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Runs a live multi-page Resend engagement scan (collectEngagedContacts) plus
// audience append + broadcast create  -  same order of work as the draft cron,
// so give it the same 300s ceiling rather than the default.
export const maxDuration = 300

interface RouteContext {
  params: Promise<{id: string}>
}

export async function POST(_req: Request, ctx: RouteContext) {
  const {id} = await ctx.params
  try {
    await requireOperatorMutation()
    const result = await sendPromo(id)
    return Response.json({
      success: true,
      data: {
        completed: true,
        status: result.status,
        targetCount: result.targetCount
      }
    })
  } catch (err) {
    return safeRouteError(err)
  }
}
