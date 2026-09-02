import {createLogger} from '@lib/logger'
import type {RssItem} from './sources/rss-fetch'
import type {XItem} from './sources/x-fetch'

const log = createLogger('Newsletter:Curator')

export interface CandidateItem {
  source: 'rss' | 'x'
  hash: string
  url: string
  title: string
  summary: string
  author: string | null
  publishedAt: string
  sourceName: string
  trustWeight: number
  engagement: number | null
}

export interface CuratedSelection {
  candidate: CandidateItem
  rationale: string
  readerAngle: string
  emoji: string
  isTactical: boolean
}

export interface CuratedIssue {
  selections: CuratedSelection[]
  issueIntro: string
}

export interface CuratorConfig {
  apiKey: string
  baseUrl: string
  model: string
  referer?: string
  appName?: string
  sectionsPerIssue?: number
  /** Publication editorial spec: who the reader is, what's in/out, the voice. */
  systemPrompt: string
}

export interface CurateIssueOptions {
  rssItems?: RssItem[]
  xItems?: XItem[]
  recentHeadlines?: string[]
  selector: CuratorConfig
}

function rssToCandidate(item: RssItem): CandidateItem {
  return {
    source: 'rss',
    hash: item.hash,
    url: item.url,
    title: item.title,
    summary: item.summary,
    author: item.author,
    publishedAt: item.publishedAt,
    sourceName: item.source,
    trustWeight: item.trustWeight,
    engagement: null
  }
}

function xToCandidate(item: XItem): CandidateItem {
  return {
    source: 'x',
    hash: item.hash,
    url: item.url,
    title: item.title,
    summary: item.summary,
    author: item.author,
    publishedAt: item.publishedAt,
    sourceName: item.author,
    trustWeight: 0.6,
    engagement: item.engagement
  }
}

export async function curateIssue(
  opts: CurateIssueOptions
): Promise<CuratedIssue | null> {
  const sectionsPerIssue = opts.selector.sectionsPerIssue ?? 4
  const candidates: CandidateItem[] = [
    ...(opts.rssItems ?? []).map(rssToCandidate),
    ...(opts.xItems ?? []).map(xToCandidate)
  ]
  if (candidates.length === 0) {
    log.warn('curator received zero candidates  -  aborting issue')
    return null
  }

  const ranked = rankForCurator(candidates).slice(0, 30)
  log.info(
    `curating issue from ${candidates.length} candidate(s), top ${ranked.length} sent to LLM`
  )

  const result = await callCurator(ranked, sectionsPerIssue, opts)
  if (!result) return null

  const byHash = new Map(ranked.map(c => [c.hash, c]))
  const selections: CuratedSelection[] = []
  for (const sel of result.selections) {
    const candidate = byHash.get(sel.itemHash)
    if (!candidate) {
      log.warn(`LLM picked unknown hash ${sel.itemHash}  -  dropping`)
      continue
    }
    selections.push({
      candidate,
      rationale: sel.rationale,
      readerAngle: sel.readerAngle,
      emoji: sel.emoji,
      isTactical: sel.isTactical
    })
  }
  if (selections.length === 0) {
    log.warn('curator returned no resolvable selections')
    return null
  }
  log.success(`curated ${selections.length} item(s) for the issue`)
  return {selections, issueIntro: result.issueIntro}
}

function rankForCurator(items: CandidateItem[]): CandidateItem[] {
  const now = Date.now()
  const HALF_LIFE_MS = 5 * 24 * 60 * 60 * 1000
  return [...items].sort(
    (a, b) =>
      scoreCandidate(b, now, HALF_LIFE_MS) -
      scoreCandidate(a, now, HALF_LIFE_MS)
  )
}

function scoreCandidate(
  item: CandidateItem,
  now: number,
  halfLifeMs: number
): number {
  const ageMs = Math.max(0, now - Date.parse(item.publishedAt))
  const recency = Math.exp(-Math.LN2 * (ageMs / halfLifeMs))
  const engagementBoost = item.engagement
    ? Math.log10(item.engagement + 1) / 5
    : 0
  return item.trustWeight * recency + engagementBoost
}

interface CuratorRawSelection {
  itemHash: string
  rationale: string
  readerAngle: string
  emoji: string
  isTactical: boolean
}

interface CuratorRawResult {
  selections: CuratorRawSelection[]
  issueIntro: string
}

async function callCurator(
  candidates: CandidateItem[],
  sectionsPerIssue: number,
  opts: CurateIssueOptions
): Promise<CuratorRawResult | null> {
  const candidateBlock = candidates
    .map(
      c =>
        `[hash=${c.hash}] (${c.sourceName} · ${c.publishedAt.slice(0, 10)}${c.engagement != null ? ` · ${Math.round(c.engagement)} eng` : ''})\n  ${c.title}\n  ${c.summary.slice(0, 280).replaceAll('\n', ' ')}`
    )
    .join('\n\n')

  const recentBlock =
    opts.recentHeadlines && opts.recentHeadlines.length > 0
      ? [
          '',
          'RECENTLY COVERED TOPICS: do not repeat the same event. Exclude candidates that are essentially the same story unless they add material new information:',
          ...opts.recentHeadlines.slice(0, 30).map(h => `  - ${h}`),
          ''
        ].join('\n')
      : ''

  const userPrompt = [
    `Today is ${new Date().toISOString().slice(0, 10)}. You are preparing this week's issue.`,
    '',
    `You have ${candidates.length} candidates below, already filtered for relevance and recency. Choose up to ${sectionsPerIssue} strong items for the issue.`,
    recentBlock,
    'Candidates:',
    candidateBlock,
    '',
    'Return ONLY a JSON object, with no prose outside the JSON, in this form:',
    '{',
    `  "selections": [`,
    '    {',
    `      "item_hash": string,            // copy the chosen candidate hash exactly`,
    `      "rationale": string,            // 1-2 sentences: why this belongs this week`,
    `      "reader_angle": string,          // 1 sentence: what the reader takes away`,
    `      "emoji": string,                // one emoji that prefixes the section headline`,
    `      "is_tactical": boolean          // mark one practical selection true when appropriate`,
    '    }',
    `    // ... up to ${sectionsPerIssue} items, strongest first`,
    '  ],',
    `  "issue_intro": string               // 1 sentence (max 140 chars) that connects the selected ideas in a warm, clear voice`,
    '}'
  ]
    .filter(Boolean)
    .join('\n')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${opts.selector.apiKey}`
  }
  if (opts.selector.referer)
    headers['HTTP-Referer'] = asciiHeaderValue(opts.selector.referer)
  if (opts.selector.appName)
    headers['X-Title'] = asciiHeaderValue(opts.selector.appName)

  const res = await fetch(
    `${opts.selector.baseUrl.replace(/\/$/, '')}/chat/completions`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: opts.selector.model,
        // Generous headroom: reasoning-family models spend tokens on hidden
        // reasoning before the visible output, and selecting up to 10 items
        // (vs. the original 4-5) needs a noticeably larger JSON response.
        max_completion_tokens: 8000,
        messages: [
          {role: 'system', content: opts.selector.systemPrompt},
          {role: 'user', content: userPrompt}
        ]
      })
    }
  )

  if (!res.ok) {
    log.warn(`curator LLM call failed: status=${res.status}`)
    return null
  }
  const json = (await res.json()) as {
    choices?: Array<{message?: {content?: string}}>
  }
  const text = json.choices?.[0]?.message?.content
  if (!text) {
    log.warn('curator response missing content')
    return null
  }

  const parsed = extractJson(text)
  if (!parsed) {
    log.warn('curator response was not parseable JSON')
    return null
  }

  const rawSelections = Array.isArray(parsed.selections)
    ? parsed.selections
    : []
  const selections: CuratorRawSelection[] = []
  for (const s of rawSelections) {
    if (!s || typeof s !== 'object') continue
    const o = s as Record<string, unknown>
    const itemHash = typeof o.item_hash === 'string' ? o.item_hash : ''
    const rationale = typeof o.rationale === 'string' ? o.rationale : ''
    const readerAngle = typeof o.reader_angle === 'string' ? o.reader_angle : ''
    const emoji = typeof o.emoji === 'string' ? o.emoji : '💡'
    const isTactical = o.is_tactical === true
    if (!itemHash || !rationale) continue
    selections.push({itemHash, rationale, readerAngle, emoji, isTactical})
  }

  const issueIntro =
    typeof parsed.issue_intro === 'string' ? parsed.issue_intro.trim() : ''
  if (selections.length === 0) {
    log.warn('curator returned zero valid selections')
    return null
  }
  return {selections, issueIntro}
}

function asciiHeaderValue(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\x20-\x7e]/g, '')
    .trim()
}

function extractJson(text: string): Record<string, unknown> | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/m.exec(text)
  const candidate = fenced?.[1] ?? text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as Record<
      string,
      unknown
    >
  } catch {
    return null
  }
}
