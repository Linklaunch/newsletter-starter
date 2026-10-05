import {auth} from '@/lib/auth/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function unavailable(): Response {
  return Response.json(
    {success: false, error: 'authentication integration is not configured'},
    {status: 503}
  )
}

const handler = auth?.handler()

export async function GET(
  request: Request,
  ctx: {params: Promise<{path: string[]}>}
): Promise<Response> {
  return handler ? handler.GET(request, ctx) : unavailable()
}

export async function POST(
  request: Request,
  ctx: {params: Promise<{path: string[]}>}
): Promise<Response> {
  return handler ? handler.POST(request, ctx) : unavailable()
}
