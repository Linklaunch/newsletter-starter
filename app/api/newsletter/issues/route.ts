import {ensureSchema, listIssues} from '../../../../journalist/runs-log'
import {isPublicationId} from '../../../../publications'
import {toOperatorIssueDto} from '@/lib/dto'
import {requireOperatorMutation, safeRouteError} from '@/lib/route-guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    await requireOperatorMutation()
    await ensureSchema()
    const url = new URL(req.url)
    const limit = Number.parseInt(url.searchParams.get('limit') || '50')
    const publicationParam = url.searchParams.get('publicationId')
    const publicationId =
      publicationParam && isPublicationId(publicationParam)
        ? publicationParam
        : undefined
    const rows = await listIssues(publicationId, limit)
    return Response.json({
      success: true,
      data: rows.map(toOperatorIssueDto),
      count: rows.length
    })
  } catch (error) {
    return safeRouteError(error)
  }
}
