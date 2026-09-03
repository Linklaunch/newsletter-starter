import {createLogger} from '@lib/logger'

const log = createLogger('Newsletter:PromoWriter')

export interface PromoWriterConfig {
  apiKey: string
  baseUrl: string
  model: string
  fallbackModels?: string[]
  referer?: string
  appName?: string
  /** Publication-specific editorial voice. */
  voiceSystemPrompt: string
}

export interface PromoDraft {
  subject: string
  previewText: string
  headline: string
  bodyMarkdown: string
  ctaLabel: string
  ctaUrl: string
}

/** The promo-specific instruction block layered on top of the publication voice. */
const PROMO_INSTRUCTIONS = [
  '',
  'TASK',
  'You are writing a promotional email with one call to action for engaged newsletter readers. The editor brief supplies the goal and link.',
  '',
  'KEEP THE VOICE',
  'Use the publication voice exactly. Keep it direct, helpful, and free of corporate language.',
  '',
  'OUTPUT FORMAT',
  'Return ONLY a JSON object in this exact shape:',
  '{',
  '  "subject": string,        // email subject (max 60 chars). Use a concrete hook, not empty clickbait.',
  '  "preview_text": string,   // inbox preview (max 90 chars). Complement the subject without repeating it.',
  '  "headline": string,       // main email headline (max 70 chars). It may begin with an emoji.',
  '  "body_markdown": string,  // 40-110 words. Use simple Markdown. Explain the value and lead to the CTA. Do not repeat the headline.',
  '  "cta_label": string,      // button label (max 30 chars). Use an action verb.',
  '  "cta_url": string         // link from the brief. Copy it exactly; return an empty string if absent.',
  '}',
  '',
  'SOURCE DISCIPLINE',
  'Do not invent facts, prices, or promises not in the brief. Keep short briefs short. Copy the CTA link from the brief exactly.'
].join('\n')

export async function writePromo(
  brief: string,
  cfg: PromoWriterConfig
): Promise<PromoDraft> {
  const systemPrompt = `${cfg.voiceSystemPrompt}\n${PROMO_INSTRUCTIONS}`
  const userPrompt = [
    'Editor brief for this promotional email:',
    '',
    brief.trim(),
    '',
    'Write the email using the specified JSON format.'
  ].join('\n')

  const messages = [
    {role: 'system', content: systemPrompt},
    {role: 'user', content: userPrompt}
  ]

  log.info(`drafting promo copy (primary: ${cfg.model})`)
  const text = await callWithFallback(cfg, messages)
  const parsed = extractJson(text)

  return {
    subject: asString(parsed.subject, 'subject'),
    previewText: asOptionalString(parsed.preview_text),
    headline: asString(parsed.headline, 'headline'),
    bodyMarkdown: asString(parsed.body_markdown, 'body_markdown'),
    ctaLabel: asString(parsed.cta_label, 'cta_label'),
    ctaUrl: asOptionalString(parsed.cta_url)
  }
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
  cfg: PromoWriterConfig,
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
      body: JSON.stringify({model, max_completion_tokens: 1200, messages})
    }
  )
  const bodyText = await res.text()
  if (res.status === 429) throw new RateLimitError(model, 'rate limited')
  if (!res.ok) {
    throw new Error(`promo-writer failed (status ${res.status})`)
  }
  let json: {choices?: Array<{message?: {content?: string}}>}
  try {
    json = JSON.parse(bodyText)
  } catch {
    throw new Error('promo-writer returned invalid JSON')
  }
  const text = json.choices?.[0]?.message?.content
  if (!text) throw new Error(`promo-writer ${model} response missing content`)
  return text
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function callWithFallback(
  cfg: PromoWriterConfig,
  messages: Array<{role: string; content: string}>
): Promise<string> {
  const chain = [cfg.model, ...(cfg.fallbackModels ?? [])]
  let last429: RateLimitError | null = null
  for (let i = 0; i < chain.length; i++) {
    const model = chain[i]!
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const text = await callOnce(cfg, model, messages)
        if (i > 0 || attempt > 0)
          log.success(`recovered with ${model} (attempt ${attempt + 1})`)
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
    `promo-writer: all models rate-limited. Tried [${chain.join(', ')}]. Last 429: ${last429?.body ?? '?'}`
  )
}

function extractJson(text: string): Record<string, unknown> {
  const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/m.exec(text)
  const candidate = fenced?.[1] ?? text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    log.error('could not locate JSON in model response')
    throw new Error('promo-writer LLM response did not contain a JSON object')
  }
  try {
    return JSON.parse(candidate.slice(start, end + 1))
  } catch (err) {
    log.error(`JSON parse failed: ${(err as Error).message}`)
    throw new Error('promo-writer LLM response JSON parse failed')
  }
}

function asString(v: unknown, field: string): string {
  if (typeof v !== 'string' || v.trim().length === 0) {
    throw new Error(`Promo field "${field}" missing or empty`)
  }
  return v.trim()
}

function asOptionalString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}
