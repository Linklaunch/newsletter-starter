import {createLogger} from '@lib/logger'

const log = createLogger('Newsletter:XSearch')

export interface XSearchConfig {
  apiUrl: string
  timeoutMs?: number
  /** Timeout for the lightweight readiness preflight. Defaults to 8s. */
  readinessTimeoutMs?: number
}

export interface ScraperReadiness {
  ready: boolean
  reason: string
}

export interface SearchResponse {
  tweets: unknown[]
  pagination: {
    count: number
    total_fetched: number
    has_more: boolean
  }
  query: string
  product: NonNullable<SearchTweetsInput['product']>
}

interface AccountRow {
  logged_in?: boolean
}

/**
 * Lightweight preflight before a search. The optional source service may not
 * have a usable account, so check its fast readiness endpoint and skip safely.
 */
export async function checkScraperReady(
  config: XSearchConfig
): Promise<ScraperReadiness> {
  const timeoutMs = config.readinessTimeoutMs ?? 8_000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const base = validBaseUrl(config.apiUrl)
    if (!base) return {ready: false, reason: 'source service URL is invalid'}
    const res = await fetch(new URL('/accounts', base), {
      signal: controller.signal
    })
    if (!res.ok)
      return {
        ready: false,
        reason: `readiness endpoint returned HTTP ${res.status}`
      }
    const body: unknown = await res.json()
    if (!Array.isArray(body)) {
      return {
        ready: false,
        reason: 'readiness endpoint returned an invalid response'
      }
    }
    const accounts = body as AccountRow[]
    const usable = accounts.filter(account => account.logged_in === true).length
    if (usable === 0)
      return {ready: false, reason: 'source service has no usable accounts'}
    return {ready: true, reason: `${usable} usable account(s)`}
  } catch {
    return {ready: false, reason: 'source service preflight failed'}
  } finally {
    clearTimeout(timer)
  }
}

export interface SearchTweetsInput {
  query: string
  limit?: number
  product?: 'Top' | 'Latest' | 'Media' | 'People'
  cursor?: string | null
}

const RETRY_DELAYS_MS = [2_000, 5_000]

/**
 * Generic HTTP adapter for an optional source service. It intentionally owns no
 * generated client or service-specific credentials and accepts only a minimal
 * response shape used by the source collector.
 */
export async function searchTweets(
  config: XSearchConfig,
  input: SearchTweetsInput
): Promise<SearchResponse> {
  const base = validBaseUrl(config.apiUrl)
  if (!base) throw new Error('source service URL is invalid')

  const limit = input.limit ?? 20
  const product = input.product ?? 'Top'
  const timeoutMs = config.timeoutMs ?? 30_000
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const url = new URL('/search', base)
      url.searchParams.set('query', input.query)
      url.searchParams.set('limit', String(limit))
      url.searchParams.set('product', product)
      if (input.cursor) url.searchParams.set('cursor', input.cursor)

      const response = await fetch(url, {signal: controller.signal})
      if (!response.ok)
        throw new Error(`source service returned HTTP ${response.status}`)
      return normalizeResponse(await response.json(), input.query, product)
    } catch {
      const delay = RETRY_DELAYS_MS[attempt]
      if (delay === undefined) break
      log.warn(`X search attempt ${attempt + 1} failed, retrying in ${delay}ms`)
      await sleep(delay)
    } finally {
      clearTimeout(timer)
    }
  }
  throw new Error('X search failed after retries')
}

function validBaseUrl(value: string): URL | null {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

function normalizeResponse(
  value: unknown,
  query: string,
  product: NonNullable<SearchTweetsInput['product']>
): SearchResponse {
  if (!value || typeof value !== 'object') return emptyResult(query, product)
  const body = value as Record<string, unknown>
  const pagination = body.pagination as Record<string, unknown> | undefined
  return {
    tweets: Array.isArray(body.tweets) ? body.tweets : [],
    pagination: {
      count: typeof pagination?.count === 'number' ? pagination.count : 0,
      total_fetched:
        typeof pagination?.total_fetched === 'number'
          ? pagination.total_fetched
          : 0,
      has_more:
        typeof pagination?.has_more === 'boolean' ? pagination.has_more : false
    },
    query,
    product
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function emptyResult(
  query: string,
  product: NonNullable<SearchTweetsInput['product']>
): SearchResponse {
  return {
    tweets: [],
    pagination: {count: 0, total_fetched: 0, has_more: false},
    query,
    product
  }
}
