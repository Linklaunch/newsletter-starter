import {createLogger} from '@lib/logger'
import type {CuratedSelection} from './issue-curator'
import type {WriterFewShot} from '../publications/types'

const log = createLogger('Newsletter:Writer')

export interface Section {
  hash: string
  emojiHeadline: string
  bodyMarkdown: string
  soWhat: string
  linkUrl: string
  linkText: string
  isTactical: boolean
  imageUrl: string | null
}

export interface SectionWriterConfig {
  apiKey: string
  baseUrl: string
  model: string
  fallbackModels?: string[]
  referer?: string
  appName?: string
  /** Publication-specific editorial voice. */
  systemPrompt: string
  /** Publication-specific few-shot examples that anchor the voice. */
  fewShots: WriterFewShot[]
}

export async function writeSection(
  selection: CuratedSelection,
  cfg: SectionWriterConfig
): Promise<Section> {
  const today = new Date().toISOString().slice(0, 10)
  const userPrompt = [
    `Today: ${today}.`,
    '',
    `Source: ${selection.candidate.sourceName} (${selection.candidate.publishedAt.slice(0, 10)})`,
    `Original title: ${selection.candidate.title}`,
    'Source summary:',
    selection.candidate.summary,
    '',
    'Editor notes:',
    `- ${selection.rationale}`,
    `- Reader angle: ${selection.readerAngle}`,
    selection.isTactical
      ? '- This is the practical section. Write it as a useful practice note; a numbered list is allowed.'
      : '- Educational or contextual section.',
    `- Suggested headline emoji: ${selection.emoji} (change it if a better one fits)`,
    '',
    'Return ONLY a JSON object with this shape:',
    '{',
    `  "emoji_headline": string,    // one emoji followed by a useful headline (max 70 chars). Use a concrete hook, not a news headline.`,
    `  "body_markdown": string,     // 100-180 words in clear US English. Use Markdown where useful. Do not repeat the headline.`,
    `  "so_what": string            // 1-2 sentences explaining the reader takeaway or next step.`,
    '}'
  ].join('\n')

  const messages = [
    {role: 'system', content: cfg.systemPrompt},
    ...cfg.fewShots.flatMap(shot => [
      {role: 'user', content: shot.user},
      {role: 'assistant', content: shot.assistant}
    ]),
    {role: 'user', content: userPrompt}
  ]

  log.info(
    `writing section for "${selection.candidate.title.slice(0, 60)}…" (primary: ${cfg.model})`
  )

  const text = await callWriterWithFallback(cfg, messages)
  const parsed = extractJson(text)
  const emojiHeadline = asString(parsed.emoji_headline, 'emoji_headline')
  const bodyMarkdown = asString(parsed.body_markdown, 'body_markdown')
  const soWhat = asString(parsed.so_what, 'so_what')

  return {
    hash: selection.candidate.hash,
    emojiHeadline,
    bodyMarkdown,
    soWhat,
    linkUrl: selection.candidate.url,
    linkText: linkLabel(selection),
    isTactical: selection.isTactical,
    imageUrl: null
  }
}

function linkLabel(selection: CuratedSelection): string {
  const src = selection.candidate.sourceName
  if (selection.candidate.source === 'x') {
    return `View on X  -  ${src}`
  }
  return `Read at ${src}`
}

function asciiHeaderValue(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\x20-\x7e]/g, '')
    .trim()
}

class RateLimitError extends Error {
  constructor(
    public model: string,
    public body: string
  ) {
    super(`${model} → 429`)
  }
}

async function callOnce(
  cfg: SectionWriterConfig,
  model: string,
  messages: Array<{role: string; content: string}>
): Promise<string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${cfg.apiKey}`
  }
  if (cfg.referer) headers['HTTP-Referer'] = asciiHeaderValue(cfg.referer)
  if (cfg.appName) headers['X-Title'] = asciiHeaderValue(cfg.appName)

  const res = await fetch(
    `${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({model, max_completion_tokens: 1500, messages})
    }
  )
  const bodyText = await res.text()
  if (res.status === 429) throw new RateLimitError(model, 'rate limited')
  if (!res.ok) {
    throw new Error(`section-writer failed (status ${res.status})`)
  }
  let json: {choices?: Array<{message?: {content?: string}}>}
  try {
    json = JSON.parse(bodyText)
  } catch {
    throw new Error('section-writer returned invalid JSON')
  }
  const text = json.choices?.[0]?.message?.content
  if (!text) throw new Error(`section-writer ${model} response missing content`)
  return text
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Try the primary model. On 429, retry once after 4s. If still 429, walk the
 * fallback chain (each model gets one attempt + one retry on its own 429). Any
 * non-rate-limit error short-circuits to throw immediately.
 */
async function callWriterWithFallback(
  cfg: SectionWriterConfig,
  messages: Array<{role: string; content: string}>
): Promise<string> {
  const chain = [cfg.model, ...(cfg.fallbackModels ?? [])]
  let last429: RateLimitError | null = null
  for (let i = 0; i < chain.length; i++) {
    const model = chain[i]!
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const text = await callOnce(cfg, model, messages)
        if (i > 0 || attempt > 0) {
          log.success(`recovered with ${model} (attempt ${attempt + 1})`)
        }
        return text
      } catch (err) {
        if (err instanceof RateLimitError) {
          last429 = err
          if (attempt === 0) {
            log.warn(`${model} → 429, retrying in 4s`)
            await sleep(4000)
          } else {
            log.warn(`${model} → 429 again, falling back`)
          }
        } else {
          throw err
        }
      }
    }
  }
  throw new Error(
    `section-writer: all models rate-limited. Tried [${chain.join(', ')}]. Last 429: ${last429?.body ?? '?'}`
  )
}

function extractJson(text: string): Record<string, unknown> {
  const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/m.exec(text)
  const candidate = fenced?.[1] ?? text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    log.error('could not locate JSON in model response')
    throw new Error('section-writer LLM response did not contain a JSON object')
  }
  try {
    return JSON.parse(candidate.slice(start, end + 1))
  } catch (err) {
    log.error(`JSON parse failed: ${(err as Error).message}`)
    throw new Error('section-writer LLM response JSON parse failed')
  }
}

function asString(v: unknown, field: string): string {
  if (typeof v !== 'string' || v.trim().length === 0) {
    throw new Error(`Section field "${field}" missing or empty`)
  }
  return v.trim()
}
