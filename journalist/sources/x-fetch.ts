import {createHash} from 'node:crypto'
import {checkScraperReady, searchTweets} from '../x-search'
import type {XSearchConfig} from '../x-search'
import {createLogger} from '@lib/logger'

const log = createLogger('Newsletter:XFetch')

export interface XItem {
  hash: string
  url: string
  title: string
  summary: string
  author: string
  publishedAt: string
  engagement: number
  hasLink: boolean
}

export interface FetchXOptions {
  apiUrl: string
  query: string
  limit?: number
  timeoutMs?: number
  minEngagement?: number
}

export async function fetchXCandidates(opts: FetchXOptions): Promise<XItem[]> {
  const xConfig: XSearchConfig = {
    apiUrl: opts.apiUrl,
    timeoutMs: opts.timeoutMs ?? 30_000
  }
  const limit = opts.limit ?? 40
  const minEngagement = opts.minEngagement ?? 5

  const readiness = await checkScraperReady(xConfig)
  if (!readiness.ready) {
    log.warn(`skipping X search  -  ${readiness.reason}`)
    return []
  }

  log.info(`searching X: "${opts.query}" (limit ${limit})`)
  let raw: unknown[]
  try {
    const res = await searchTweets(xConfig, {
      query: opts.query,
      limit,
      product: 'Top'
    })
    raw = Array.isArray(res.tweets) ? res.tweets : []
  } catch (err) {
    log.warn('searchTweets failed')
    return []
  }

  const items = raw
    .map(normalizeTweet)
    .filter((t): t is XItem => t !== null && t.engagement >= minEngagement)
    .sort((a, b) => b.engagement - a.engagement)

  log.info(
    `collected ${items.length} X item(s) above engagement ${minEngagement}`
  )
  return items
}

function normalizeTweet(raw: unknown): XItem | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = typeof r.id === 'string' ? r.id : null
  const url = typeof r.url === 'string' ? r.url : ''
  const text = typeof r.content === 'string' ? r.content : ''
  if (!id || !text) return null

  const user = (r.user ?? {}) as Record<string, unknown>
  const author =
    typeof user.username === 'string'
      ? `@${user.username}`
      : typeof user.displayname === 'string'
        ? (user.displayname as string)
        : '@unknown'

  const links = Array.isArray(r.links) ? r.links : []
  const hasLink = links.length > 0 || /https?:\/\/\S+/i.test(text)
  const date = typeof r.date === 'string' ? r.date : new Date().toISOString()
  const likeCount = typeof r.like_count === 'number' ? r.like_count : 0
  const retweetCount = typeof r.retweet_count === 'number' ? r.retweet_count : 0
  const viewCount = typeof r.view_count === 'number' ? r.view_count : 0
  const engagement = likeCount + 2 * retweetCount + 0.0001 * viewCount

  const cleanText = text.replaceAll(/\s+/g, ' ').trim()
  const title = cleanText.slice(0, 100) + (cleanText.length > 100 ? '…' : '')

  return {
    hash: createHash('sha256').update(id).digest('hex').slice(0, 16),
    url,
    title,
    summary: cleanText.slice(0, 600),
    author,
    publishedAt: date,
    engagement,
    hasLink
  }
}
