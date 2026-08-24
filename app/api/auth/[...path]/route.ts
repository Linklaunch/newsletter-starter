export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function unavailable(): Response {
  return Response.json(
    {success: false, error: 'authentication integration is not configured'},
    {status: 503}
  )
}

export async function GET(): Promise<Response> {
  return unavailable()
}

export async function POST(): Promise<Response> {
  return unavailable()
}
