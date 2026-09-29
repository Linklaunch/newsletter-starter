import {parseCommaList} from './server-config-core'

/**
 * Shared plumbing for the public API surface (`/api/public/*`).
 *
 * These routes are the only ones a browser on another origin calls, so they are
 * the only ones that need CORS and per-IP throttling. Everything else in this
 * application is either operator-gated or called server to server.
 */

/** Origins allowed to call the public API, from PUBLIC_API_ALLOWED_ORIGINS. */
export function allowedOrigins(): ReadonlySet<string> {
  return new Set(
    parseCommaList(process.env.PUBLIC_API_ALLOWED_ORIGINS).map(o =>
      o.replace(/\/$/, '').toLowerCase()
    )
  )
}

/**
 * CORS headers for a request origin.
 *
 * Returns an empty object for an origin that is not allowlisted, so the browser
 * blocks the response. Deliberately never echoes an arbitrary origin back, and
 * never sends `*` - the allowlist is the whole point.
 */
export function corsHeaders(
  origin: string | null,
  allowed: ReadonlySet<string> = allowedOrigins()
): Record<string, string> {
  if (!origin) return {}
  const normalized = origin.replace(/\/$/, '').toLowerCase()
  if (!allowed.has(normalized)) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  }
}

/** Preflight response. 204 whether or not the origin is allowed; the headers decide. */
export function preflightResponse(req: Request): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(req.headers.get('origin'))
  })
}

/** JSON response carrying the CORS headers for this request. */
export function publicJson(
  req: Request,
  body: unknown,
  init: {status?: number; headers?: Record<string, string>} = {}
): Response {
  return Response.json(body, {
    status: init.status ?? 200,
    headers: {...corsHeaders(req.headers.get('origin')), ...(init.headers ?? {})}
  })
}

/** Best-effort client address. Only ever used for throttling, never stored. */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return req.headers.get('x-real-ip')?.trim() || 'unknown'
}

interface Bucket {
  hits: number[]
}

/**
 * In-memory sliding-window limiter.
 *
 * Honest limitation: this counts per running instance. On a serverless platform
 * several instances can serve the same client, so the effective limit is higher
 * than the number configured here. It is a brake on casual abuse, not a
 * guarantee. A shared store (or the platform's own edge throttling) is what
 * would make it exact, and that is a deliberate later decision rather than an
 * oversight.
 */
export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>()

  constructor(
    private readonly limit: number,
    private readonly windowMs: number
  ) {}

  /** True when the caller is within its allowance; records the hit. */
  check(key: string, now: number = Date.now()): boolean {
    const cutoff = now - this.windowMs
    const bucket = this.buckets.get(key) ?? {hits: []}
    bucket.hits = bucket.hits.filter(t => t > cutoff)
    if (bucket.hits.length >= this.limit) {
      this.buckets.set(key, bucket)
      return false
    }
    bucket.hits.push(now)
    this.buckets.set(key, bucket)
    if (this.buckets.size > 10_000) this.evict(cutoff)
    return true
  }

  /** Seconds until the caller's oldest hit leaves the window. */
  retryAfterSeconds(key: string, now: number = Date.now()): number {
    const oldest = this.buckets.get(key)?.hits[0]
    if (oldest === undefined) return 0
    return Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000))
  }

  private evict(cutoff: number): void {
    for (const [key, bucket] of this.buckets) {
      if (bucket.hits.every(t => t <= cutoff)) this.buckets.delete(key)
    }
  }
}

/** 10 subscribe attempts per IP per 10 minutes. */
export const subscribeLimiter = new RateLimiter(10, 10 * 60 * 1000)

/** 60 read requests per IP per minute. */
export const readLimiter = new RateLimiter(60, 60 * 1000)

/** 429 with a Retry-After header, carrying CORS. */
export function tooManyRequests(req: Request, retryAfter: number): Response {
  return publicJson(
    req,
    {success: false, error: 'too many requests'},
    {status: 429, headers: {'Retry-After': String(retryAfter)}}
  )
}

/**
 * Error response for the public surface.
 *
 * A disabled capability is reported as 503 so the caller can tell "switched
 * off" from "broken". Everything else returns a flat message with no internal
 * detail - these responses are read by anyone on the internet.
 */
export function publicRouteError(req: Request, error: unknown): Response {
  const capability =
    typeof error === 'object' &&
    error !== null &&
    'capability' in error &&
    typeof (error as {capability?: unknown}).capability === 'string'
      ? (error as {capability: string}).capability
      : null
  if (capability) {
    return publicJson(
      req,
      {
        success: false,
        error: `${capability} is disabled`,
        code: 'CAPABILITY_DISABLED'
      },
      {status: 503}
    )
  }
  return publicJson(
    req,
    {success: false, error: 'request failed'},
    {status: 500}
  )
}
