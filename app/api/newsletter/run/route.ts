import {runJournalistAgent} from '../../../../journalist/run'
import {isPublicationId} from '../../../../publications'
import type {PublicationId} from '../../../../publications/types'
import {requireOperatorMutation, safeRouteError} from '@/lib/route-guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: Request) {
  try {
    await requireOperatorMutation()
    let publicationId: PublicationId | undefined
    try {
      const body = (await req.json()) as {publicationId?: unknown}
      if (typeof body.publicationId === 'string') {
        if (!isPublicationId(body.publicationId)) {
          return Response.json(
            {
              success: false,
              error: `unknown publicationId "${body.publicationId}"`
            },
            {status: 400}
          )
        }
        publicationId = body.publicationId
      }
    } catch {
      // No/empty body → default to the env-selected active publicationId.
    }
    await runJournalistAgent({publicationId})
    return Response.json({
      success: true,
      data: {triggered: true, publicationId: publicationId ?? null}
    })
  } catch (err) {
    return safeRouteError(err)
  }
}
