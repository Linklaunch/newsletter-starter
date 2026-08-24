import {dropSection, HttpError, patchSection} from '@/lib/editor-actions'
import {requireOperatorMutation, safeRouteError} from '@/lib/route-guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{slug: string; index: string}>
}

export async function PUT(req: Request, ctx: RouteContext) {
  return patch(req, ctx)
}

export async function PATCH(req: Request, ctx: RouteContext) {
  return patch(req, ctx)
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const {slug, index} = await ctx.params
  const i = Number.parseInt(index, 10)
  if (Number.isNaN(i)) {
    return Response.json(
      {success: false, error: 'invalid index'},
      {status: 400}
    )
  }
  try {
    await requireOperatorMutation()
    const sections = await dropSection(slug, i)
    return Response.json({success: true, data: sections})
  } catch (err) {
    return errResponse(err)
  }
}

async function patch(req: Request, ctx: RouteContext) {
  const {slug, index} = await ctx.params
  const i = Number.parseInt(index, 10)
  if (Number.isNaN(i)) {
    return Response.json(
      {success: false, error: 'invalid index'},
      {status: 400}
    )
  }
  try {
    await requireOperatorMutation()
    const body = (await req.json()) as {
      emojiHeadline?: unknown
      bodyMarkdown?: unknown
      soWhat?: unknown
      isTactical?: unknown
      imageUrl?: unknown
    }
    const fields: {
      emojiHeadline?: string
      bodyMarkdown?: string
      soWhat?: string
      isTactical?: boolean
      imageUrl?: string | null
    } = {}
    if (typeof body.emojiHeadline === 'string')
      fields.emojiHeadline = body.emojiHeadline
    if (typeof body.bodyMarkdown === 'string')
      fields.bodyMarkdown = body.bodyMarkdown
    if (typeof body.soWhat === 'string') fields.soWhat = body.soWhat
    if (typeof body.isTactical === 'boolean')
      fields.isTactical = body.isTactical
    if (typeof body.imageUrl === 'string') {
      const trimmed = body.imageUrl.trim()
      if (trimmed.length === 0) {
        fields.imageUrl = null
      } else {
        let parsed: URL
        try {
          parsed = new URL(trimmed)
        } catch {
          throw new HttpError(400, 'imageUrl must be a valid URL')
        }
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          throw new HttpError(400, 'imageUrl must be http or https')
        }
        fields.imageUrl = parsed.toString()
      }
    }
    if (body.imageUrl === null) fields.imageUrl = null
    const sections = await patchSection(slug, i, fields)
    return Response.json({success: true, data: sections})
  } catch (err) {
    return errResponse(err)
  }
}

function errResponse(err: unknown): Response {
  return safeRouteError(err)
}
