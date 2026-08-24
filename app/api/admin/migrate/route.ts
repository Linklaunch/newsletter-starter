import {ensureSchema} from '../../../../journalist/runs-log'
import {requireOperatorMutation, safeRouteError} from '@/lib/route-guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    await requireOperatorMutation()
    await ensureSchema()
    return Response.json({success: true, data: {migrated: true}})
  } catch (err) {
    return safeRouteError(err)
  }
}

export async function GET() {
  return POST()
}
