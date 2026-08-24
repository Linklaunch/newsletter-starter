import {createLogger} from '@lib/logger'

const log = createLogger('Newsletter:OgImage')
const USER_AGENT =
  'NewsletterStarter/0.1 (+https://example.com; content fetcher)'
const MAX_BYTES = 64 * 1024

export async function fetchOgImage(
  url: string,
  timeoutMs = 5000
): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    })
    if (!res.ok || !res.body) return null
    const html = await readHeadChunk(res.body)
    const imageUrl = pickImageUrl(html, url)
    if (imageUrl) log.info(`og:image found for ${url}`)
    return imageUrl
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function readHeadChunk(
  body: ReadableStream<Uint8Array>
): Promise<string> {
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (total < MAX_BYTES) {
      const {value, done} = await reader.read()
      if (done || !value) break
      chunks.push(value)
      total += value.byteLength
      const text = new TextDecoder().decode(joinChunks(chunks, total))
      if (/<\/head\s*>/i.test(text)) return text
    }
    return new TextDecoder().decode(joinChunks(chunks, total))
  } finally {
    await reader.cancel().catch(() => undefined)
  }
}

function joinChunks(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

function pickImageUrl(html: string, pageUrl: string): string | null {
  const attrs = parseMetaTags(html)
  const candidates = ['og:image', 'twitter:image', 'og:image:url']
  for (const name of candidates) {
    const hit = attrs.find(a => a.property === name || a.name === name)
    const content = hit?.content?.trim()
    if (!content) continue
    const resolved = normalizeImageUrl(content, pageUrl)
    if (resolved) return resolved
  }
  return null
}

function parseMetaTags(html: string): Array<Record<string, string>> {
  const tags = html.match(/<meta\s+[^>]*>/gi) ?? []
  return tags.map(tag => {
    const attrs: Record<string, string> = {}
    for (const m of tag.matchAll(/([a-zA-Z_:.-]+)\s*=\s*(["'])(.*?)\2/g)) {
      attrs[m[1]!.toLowerCase()] = decodeHtml(m[3] ?? '')
    }
    return attrs
  })
}

function normalizeImageUrl(raw: string, pageUrl: string): string | null {
  try {
    const u = new URL(raw, pageUrl)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.toString()
  } catch {
    return null
  }
}

function decodeHtml(s: string): string {
  return s
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
}
