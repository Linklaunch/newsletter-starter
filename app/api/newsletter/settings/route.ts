import {getSettings, updateSettings} from '@/journalist/runs-log'
import type {NewsletterSettingsPatch} from '@/journalist/runs-log'
import {DEFAULT_PUBLICATION, isPublicationId} from '@/publications'
import type {PublicationId} from '@/publications/types'
import {requireOperatorMutation, safeRouteError} from '@/lib/route-guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function publicationFromQuery(req: Request): PublicationId {
  const raw = new URL(req.url).searchParams.get('publicationId')
  return raw && isPublicationId(raw) ? raw : DEFAULT_PUBLICATION
}

export async function GET(req: Request) {
  try {
    await requireOperatorMutation()
    const publicationId = publicationFromQuery(req)
    const settings = await getSettings(publicationId)
    return Response.json({success: true, data: {...settings, publicationId}})
  } catch (err) {
    return safeRouteError(err)
  }
}

export async function PUT(req: Request) {
  try {
    await requireOperatorMutation()
    const publicationId = publicationFromQuery(req)
    const body = (await req.json()) as NewsletterSettingsPatch
    const settings = await updateSettings(body, publicationId)
    return Response.json({success: true, data: {...settings, publicationId}})
  } catch (err) {
    return safeRouteError(err)
  }
}
