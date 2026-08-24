export const runtime = 'nodejs'

export async function GET() {
  return Response.json({
    success: true,
    data: {status: 'healthy', timestamp: Date.now()}
  })
}
