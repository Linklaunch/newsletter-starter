import {createHash} from 'node:crypto'
import {XMLParser} from 'fast-xml-parser'
import {createLogger} from '@lib/logger'

const log = createLogger('Newsletter:RSS')

export interface RssFeedConfig {
  name: string
  url: string
  trustWeight: number
}

export interface RssItem {
  hash: string
  url: string
  title: string
  summary: string
  author: string | null
  publishedAt: string
  source: string
  trustWeight: number
}

export interface FetchRssOptions {
  /** The active publication's feed list. Required, the caller selects the publication. */
  feeds: RssFeedConfig[]
  sinceMs?: number
  perFeedLimit?: number
  timeoutMs?: number
  /** User-Agent string for feed requests; defaults to a generic bot UA. */
  userAgent?: string
}

export async function fetchRssCandidates(
  opts: FetchRssOptions
): Promise<RssItem[]> {
  const feeds = opts.feeds
  const perFeedLimit = opts.perFeedLimit ?? 10
  const timeoutMs = opts.timeoutMs ?? 15_000
  const userAgent =
    opts.userAgent ??
    'NewsletterStarter/0.1 (+https://example.com; content fetcher)'

  log.info(`fetching ${feeds.length} feed(s)`)

  // Fetch sequentially with a short stagger rather than all at once. Several
  // of our feeds are scoped news.google.com searches, and firing many
  // simultaneous requests at the same host reads as bot traffic: Google
  // soft-throttles by returning HTTP 200 with zero items, which is
  // indistinguishable from "no recent articles" but silently drops an
  // entire source from the candidate pool. A small delay between requests,
  // plus one retry on a suspicious empty result, avoids that without
  // meaningfully slowing the run down.
  const results: RssItem[][] = []
  for (let i = 0; i < feeds.length; i++) {
    if (i > 0) await delay(300 + Math.random() * 400)
    results.push(
      await fetchOneFeedWithRetry(feeds[i], perFeedLimit, timeoutMs, userAgent)
    )
  }

  let all = results.flat()
  if (typeof opts.sinceMs === 'number') {
    const since = opts.sinceMs
    all = all.filter(item => Date.parse(item.publishedAt) >= since)
  }
  all.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))

  log.info(`collected ${all.length} item(s) from ${feeds.length} feed(s)`)
  return all
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchOneFeedWithRetry(
  feed: RssFeedConfig,
  perFeedLimit: number,
  timeoutMs: number,
  userAgent: string
): Promise<RssItem[]> {
  const first = await fetchOneFeed(feed, perFeedLimit, timeoutMs, userAgent)
  if (first.length > 0) return first
  log.info(`${feed.name}: empty result, retrying once after backoff`)
  await delay(1500 + Math.random() * 1000)
  return fetchOneFeed(feed, perFeedLimit, timeoutMs, userAgent)
}

async function fetchOneFeed(
  feed: RssFeedConfig,
  perFeedLimit: number,
  timeoutMs: number,
  userAgent: string
): Promise<RssItem[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(feed.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': userAgent,
        Accept:
          'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'
      }
    })
    if (!res.ok) {
      log.warn(`${feed.name} → HTTP ${res.status} ${res.statusText}`)
      return []
    }
    const xml = await res.text()
    const items = parseFeedXml(xml, feed)
    const limited = items.slice(0, perFeedLimit)
    log.info(`${feed.name} → ${limited.length} item(s) (of ${items.length})`)
    return limited
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.warn(`${feed.name} fetch failed: ${msg}`)
    return []
  } finally {
    clearTimeout(timer)
  }
}

interface ParsedNode {
  [key: string]: unknown
}

function parseFeedXml(xml: string, feed: RssFeedConfig): RssItem[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    trimValues: true,
    parseTagValue: false,
    parseAttributeValue: false
  })
  let parsed: ParsedNode
  try {
    parsed = parser.parse(xml) as ParsedNode
  } catch (err) {
    log.warn(`${feed.name}: XML parse failed: ${(err as Error).message}`)
    return []
  }

  const rss = (parsed.rss ?? {}) as ParsedNode
  const channel = (rss.channel ?? {}) as ParsedNode
  const rssItems = asArray(channel.item)
  if (rssItems.length > 0) {
    return rssItems
      .map(raw => normalizeRssItem(raw, feed))
      .filter((x): x is RssItem => x !== null)
  }

  const atomFeed = (parsed.feed ?? {}) as ParsedNode
  const atomEntries = asArray(atomFeed.entry)
  if (atomEntries.length > 0) {
    return atomEntries
      .map(raw => normalizeAtomEntry(raw, feed))
      .filter((x): x is RssItem => x !== null)
  }

  log.warn(`${feed.name}: no <item> or <entry> elements found`)
  return []
}

function normalizeRssItem(raw: unknown, feed: RssFeedConfig): RssItem | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as ParsedNode

  const title = pickString(r.title)
  const link = pickString(r.link) || pickString(r.guid)
  if (!title || !link) return null

  const url = canonicalizeUrl(link)
  const summary = stripHtml(
    pickString((r as ParsedNode)['content:encoded']) ||
      pickString(r.description) ||
      ''
  ).slice(0, 600)
  const publishedAt = parseDateOr(
    pickString(r.pubDate) || pickString((r as ParsedNode)['dc:date']),
    new Date().toISOString()
  )
  const author =
    pickString((r as ParsedNode)['dc:creator']) || pickString(r.author) || null

  return {
    hash: hashUrl(url),
    url,
    title: stripHtml(title),
    summary,
    author,
    publishedAt,
    source: feed.name,
    trustWeight: feed.trustWeight
  }
}

function normalizeAtomEntry(raw: unknown, feed: RssFeedConfig): RssItem | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as ParsedNode

  const title = pickString(r.title)
  const linkRaw = r.link
  let href = ''
  if (typeof linkRaw === 'string') {
    href = linkRaw
  } else if (Array.isArray(linkRaw)) {
    const first = linkRaw.find((l: unknown) => {
      if (!l || typeof l !== 'object') return false
      const rel = (l as ParsedNode)['@_rel']
      return rel === undefined || rel === 'alternate'
    })
    if (first && typeof first === 'object') {
      href = String((first as ParsedNode)['@_href'] ?? '')
    }
  } else if (linkRaw && typeof linkRaw === 'object') {
    href = String((linkRaw as ParsedNode)['@_href'] ?? '')
  }
  if (!title || !href) return null

  const url = canonicalizeUrl(href)
  const summary = stripHtml(
    pickString(r.summary) || pickString(r.content) || ''
  ).slice(0, 600)
  const publishedAt = parseDateOr(
    pickString(r.published) || pickString(r.updated),
    new Date().toISOString()
  )
  const author = pickAtomAuthor(r.author)

  return {
    hash: hashUrl(url),
    url,
    title: stripHtml(title),
    summary,
    author,
    publishedAt,
    source: feed.name,
    trustWeight: feed.trustWeight
  }
}

function pickAtomAuthor(node: unknown): string | null {
  if (!node) return null
  if (typeof node === 'string') return node
  if (typeof node === 'object') {
    const name = (node as ParsedNode).name
    if (typeof name === 'string') return name
  }
  return null
}

function asArray(v: unknown): unknown[] {
  if (Array.isArray(v)) return v
  if (v === undefined || v === null) return []
  return [v]
}

function pickString(v: unknown): string {
  if (typeof v === 'string') return v.trim()
  if (v && typeof v === 'object') {
    const inner = (v as ParsedNode)['#text']
    if (typeof inner === 'string') return inner.trim()
  }
  return ''
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function canonicalizeUrl(raw: string): string {
  try {
    const u = new URL(raw)
    const trackingParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
      'fbclid',
      'gclid',
      'mc_cid',
      'mc_eid'
    ]
    for (const p of trackingParams) u.searchParams.delete(p)
    u.hash = ''
    return u.toString().replace(/\/$/, '')
  } catch {
    return raw
  }
}

function parseDateOr(input: string, fallback: string): string {
  if (!input) return fallback
  const ms = Date.parse(input)
  if (Number.isNaN(ms)) return fallback
  return new Date(ms).toISOString()
}

export function hashUrl(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 16)
}
