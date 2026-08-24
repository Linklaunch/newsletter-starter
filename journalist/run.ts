import {createLogger, safeErrorSummary} from '@lib/logger'
import {nextScheduledSendUtc} from '@lib/schedule'
import {configuredEnv, parseCommaList} from '../lib/server-config'
import {fetchRssCandidates} from './sources/rss-fetch'
import {fetchXCandidates} from './sources/x-fetch'
import {fetchOgImage} from './sources/og-image'
import {curateIssue} from './issue-curator'
import type {CuratedSelection} from './issue-curator'
import {writeSection} from './section-writer'
import type {Section} from './section-writer'
import {composeIssue} from './issue-composer'
import type {ComposeBrand} from './issue-composer'
import {
  activePublication,
  getPublication,
  isPublicationId
} from '../publications'
import type {PublicationId, PublicationProfile} from '../publications/types'
import {
  cancelBroadcast,
  deleteBroadcast,
  loadEmailConfigForPublication,
  scheduleIssue as resendScheduleBroadcast,
  sendIssueNow as resendBroadcast
} from './email-sender'
import {
  clearIssueSchedule,
  ensureSchema,
  getIssue,
  getSectionDrafts,
  getSettings,
  hasItemBeenUsed,
  markIssueScheduled,
  markIssueSent,
  nextIssueNumber,
  recentItemHeadlines,
  recordIssue,
  saveSectionDrafts
} from './runs-log'
import type {SectionDraft} from './runs-log'

const log = createLogger('Newsletter')

export interface RunOverrides {
  suggestion?: string
  /** Which edition to draft. Defaults to the env-selected active publication. */
  publicationId?: PublicationId
}

interface NewsletterConfig {
  publication: PublicationProfile
  llm: {
    apiKey: string
    baseUrl: string
    curatorModel: string
    writerModel: string
    writerFallbackModels: string[]
    appName: string
    referer: string
  }
  xSource: {apiUrl: string | null; query: string; limit: number}
  curation: {
    sectionsPerIssue: number
    rssWindowDays: number
    dedupWindowDays: number
    rssPerFeedLimit: number
  }
  brand: ComposeBrand
  archiveBaseUrl: string
}

function requireEnv(name: string): string {
  const value = configuredEnv(name)
  if (!value)
    throw new Error(`required server configuration is unavailable: ${name}`)
  return value
}

/**
 * Derive the composer brand bundle from a publicationId profile. The brand/locale/
 * timezone/CTAs/copy live on the profile; the parent site is env-overridable
 * per publication only via the profile default.
 */
function brandForPublication(publication: PublicationProfile): ComposeBrand {
  return {
    newsletter: publication.brand.newsletter,
    parent: publication.brand.parent,
    site: publication.brand.site,
    wordmark: publication.brand.wordmark,
    subtitle: publication.brand.subtitle,
    locale: publication.locale,
    timeZone: publication.timeZone,
    ctas: publication.ctas,
    feedbackCopy: publication.feedbackCopy,
    footer: publication.footer
  }
}

function loadConfig(publication: PublicationProfile): NewsletterConfig {
  const site = publication.brand.site
  const legacyModel = configuredEnv('NEWSLETTER_MODEL')
  const curatorModel = configuredEnv('NEWSLETTER_CURATOR_MODEL') ?? legacyModel
  const writerModel = configuredEnv('NEWSLETTER_WRITER_MODEL') ?? legacyModel
  if (!curatorModel || !writerModel) {
    throw new Error(
      'required server configuration is unavailable: NEWSLETTER_CURATOR_MODEL and NEWSLETTER_WRITER_MODEL'
    )
  }
  const writerFallbackModels = parseCommaList(
    configuredEnv('NEWSLETTER_WRITER_FALLBACK_MODELS')
  ).filter(model => model !== writerModel)
  return {
    publication,
    llm: {
      apiKey: requireEnv('LLM_API_KEY'),
      baseUrl: requireEnv('LLM_BASE_URL'),
      curatorModel,
      writerModel,
      writerFallbackModels,
      appName: publication.brand.newsletter,
      referer: `https://${site}`
    },
    xSource: {
      apiUrl: configuredEnv('X_SOURCE_API_URL'),
      query: publication.xQuery ?? '',
      limit: Number(configuredEnv('NEWSLETTER_X_LIMIT') ?? 40)
    },
    curation: {
      sectionsPerIssue: Number(
        configuredEnv('NEWSLETTER_SECTIONS_PER_ISSUE') ??
          publication.sectionsPerIssue
      ),
      rssWindowDays: Number(configuredEnv('NEWSLETTER_RSS_WINDOW_DAYS') ?? 7),
      dedupWindowDays: Number(
        configuredEnv('NEWSLETTER_DEDUP_WINDOW_DAYS') ?? 14
      ),
      rssPerFeedLimit: Number(configuredEnv('NEWSLETTER_RSS_PER_FEED') ?? 10)
    },
    brand: brandForPublication(publication),
    archiveBaseUrl:
      configuredEnv('NEWSLETTER_ARCHIVE_BASE_URL') ?? 'http://localhost:3008'
  }
}

function buildInitialSubject(
  issueNumber: number,
  publication: PublicationProfile
): string {
  return `${publication.brand.newsletter} · Issue #${issueNumber}`
}

async function resolveDisplayDate(issue: {
  scheduledAt: number | null
  createdAt: number
  status: string
  publicationId: PublicationId
}): Promise<Date> {
  if (issue.scheduledAt) return new Date(issue.scheduledAt)
  if (issue.status === 'sent') return new Date(issue.createdAt)
  // Settings are publication-specific, so the displayed date follows this issue's schedule.
  const settings = await getSettings(issue.publicationId)
  return nextScheduledSendUtc(settings)
}

function buildSlug(
  issueNumber: number,
  date: Date,
  publication: PublicationProfile
): string {
  const yyyy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  return `${publication.id}-${yyyy}-${mm}-${dd}-issue-${String(issueNumber).padStart(3, '0')}`
}

function selectionToDraft(
  section: Section,
  selection: CuratedSelection,
  imageUrl: string | null
): SectionDraft {
  return {
    emojiHeadline: section.emojiHeadline,
    bodyMarkdown: section.bodyMarkdown,
    soWhat: section.soWhat,
    linkUrl: section.linkUrl,
    linkText: section.linkText,
    isTactical: section.isTactical,
    imageUrl,
    referenceImageUrl: imageUrl,
    selectionJson: JSON.stringify(selection)
  }
}

/**
 * Phase 1: pull candidates → curate → write sections → save drafts to DB.
 * Does NOT compose final HTML or call Resend. The pending issue is picked up
 * by the editor UI for review, edits, and a manual Send confirmation.
 */
export async function runJournalistAgent(
  overrides: RunOverrides = {}
): Promise<void> {
  await ensureSchema()
  const publication = overrides.publicationId
    ? getPublication(overrides.publicationId)
    : activePublication()
  const cfg = loadConfig(publication)
  const started = Date.now()

  log.start(
    `drafting ${publication.brand.newsletter} issue for ${new Date().toISOString().slice(0, 10)}`
  )

  const rssWindowMs = cfg.curation.rssWindowDays * 24 * 60 * 60 * 1000
  const [rssItems, xItems] = await Promise.all([
    fetchRssCandidates({
      feeds: publication.feeds,
      sinceMs: Date.now() - rssWindowMs,
      perFeedLimit: cfg.curation.rssPerFeedLimit,
      userAgent: `${publication.brand.newsletter}/0.1 (+https://${publication.brand.site}; news bot)`
    }),
    cfg.xSource.apiUrl && cfg.xSource.query
      ? fetchXCandidates({
          apiUrl: cfg.xSource.apiUrl,
          query: cfg.xSource.query,
          limit: cfg.xSource.limit
        }).catch(err => {
          log.warn('X fetch failed, continuing RSS-only')
          return []
        })
      : Promise.resolve([])
  ])
  log.info(
    `candidates pre-dedup: ${rssItems.length} RSS · ${xItems.length} X${cfg.xSource.apiUrl ? '' : ' (X disabled  -  no X_SOURCE_API_URL)'}`
  )

  const filteredRss = []
  for (const item of rssItems) {
    if (await hasItemBeenUsed(item.hash, publication.id)) continue
    filteredRss.push(item)
  }
  const filteredX = []
  for (const item of xItems) {
    if (await hasItemBeenUsed(item.hash, publication.id)) continue
    filteredX.push(item)
  }
  log.info(
    `candidates post-dedup: ${filteredRss.length} RSS · ${filteredX.length} X`
  )
  if (filteredRss.length + filteredX.length === 0) {
    log.warn('no fresh candidates  -  aborting run')
    return
  }

  const dedupWindowMs = cfg.curation.dedupWindowDays * 24 * 60 * 60 * 1000
  const recentHeadlines =
    dedupWindowMs > 0
      ? (
          await recentItemHeadlines(Date.now() - dedupWindowMs, publication.id)
        ).map(h => h.headline)
      : []

  const curated = await curateIssue({
    rssItems: filteredRss,
    xItems: filteredX,
    recentHeadlines,
    selector: {
      apiKey: cfg.llm.apiKey,
      baseUrl: cfg.llm.baseUrl,
      model: cfg.llm.curatorModel,
      referer: cfg.llm.referer,
      appName: cfg.llm.appName,
      sectionsPerIssue: cfg.curation.sectionsPerIssue,
      systemPrompt: publication.curatorSystemPrompt
    }
  })
  if (!curated) {
    log.warn('curator returned no issue  -  aborting')
    return
  }

  log.info(
    `curator picked ${curated.selections.length} item(s); fetching images and writing sections sequentially`
  )
  const imageResults = await Promise.allSettled(
    curated.selections.map(selection => fetchOgImage(selection.candidate.url))
  )
  const imageUrls = imageResults.map((result, i) => {
    const url = result.status === 'fulfilled' ? result.value : null
    if (url) return url
    log.warn(`no image found for curated item #${i + 1}`)
    return null
  })
  const sections: Section[] = []
  const drafts: SectionDraft[] = []
  for (let i = 0; i < curated.selections.length; i++) {
    const selection = curated.selections[i]!
    const imageUrl = imageUrls[i] ?? null
    const section = await writeSection(selection, {
      apiKey: cfg.llm.apiKey,
      baseUrl: cfg.llm.baseUrl,
      model: cfg.llm.writerModel,
      fallbackModels: cfg.llm.writerFallbackModels,
      referer: cfg.llm.referer,
      appName: cfg.llm.appName,
      systemPrompt: publication.writerSystemPrompt,
      fewShots: publication.writerFewShots
    })
    const sectionWithImage = {...section, imageUrl}
    sections.push(sectionWithImage)
    drafts.push(selectionToDraft(sectionWithImage, selection, imageUrl))
  }

  const issueNumber = await nextIssueNumber(publication.id)
  const issueDate = new Date()
  const slug = buildSlug(issueNumber, issueDate, publication)
  const subject = buildInitialSubject(issueNumber, publication)

  await recordIssue(
    {
      slug,
      issueNumber,
      subject,
      intro: curated.issueIntro,
      bodyHtml: null,
      bodyText: null,
      broadcastId: null,
      dashboardUrl: null,
      status: 'pending_review',
      scheduledAt: null,
      createdAt: issueDate.getTime(),
      publicationId: publication.id
    },
    curated.selections.map(sel => ({
      issueSlug: slug,
      itemHash: sel.candidate.hash,
      source: sel.candidate.source,
      sourceName: sel.candidate.sourceName,
      url: sel.candidate.url,
      headline: sel.candidate.title.slice(0, 200),
      isTactical: sel.isTactical
    }))
  )

  await saveSectionDrafts(slug, drafts)

  log.success(
    `pending issue ${slug} (#${issueNumber}) drafted in ${Date.now() - started}ms  -  open editor at /editor/${slug}`
  )
}

async function prepareComposedForSend(slug: string, displayDate?: Date) {
  await ensureSchema()
  const issue = await getIssue(slug)
  if (!issue) throw new Error(`issue not found: ${slug}`)
  if (issue.status === 'sent') {
    throw new Error(
      `issue ${slug} is already sent (broadcast ${issue.broadcastId ?? '?'})`
    )
  }
  const publication = getPublication(issue.publicationId)
  const cfg = loadConfig(publication)

  const drafts = await getSectionDrafts(slug)
  if (drafts.length === 0) {
    throw new Error(`issue ${slug} has no section drafts to send`)
  }

  const sections: Section[] = drafts.map((d, i) => ({
    hash: `s${i}`,
    emojiHeadline: d.emojiHeadline,
    bodyMarkdown: d.bodyMarkdown,
    soWhat: d.soWhat,
    linkUrl: d.linkUrl,
    linkText: d.linkText,
    isTactical: d.isTactical,
    imageUrl: d.imageUrl
  }))

  const issueDate = displayDate ?? (await resolveDisplayDate(issue))
  const composed = composeIssue({
    sections,
    issueIntro: issue.intro,
    issueNumber: issue.issueNumber,
    slugOverride: issue.slug,
    issueDate,
    archiveBaseUrl: cfg.archiveBaseUrl,
    brand: cfg.brand
  })
  const composedWithSlug = {...composed, slug, subject: issue.subject}

  const emailCfg = loadEmailConfigForPublication(publication)
  if (!emailCfg) {
    throw new Error(
      `Resend env not configured for publicationId ${publication.id}  -  cannot send. Set ${publication.resendEnv.apiKey}, ${publication.resendEnv.audienceId}, ${publication.resendEnv.fromEmail}.`
    )
  }

  return {issue, composed: composedWithSlug, emailCfg}
}

/**
 * Phase 2: compose final HTML from current section drafts (post-edit), persist
 * the body to the DB, ship via Resend, mark issue 'sent'. Called from the
 * editor's 'Send' button. Refuses on already-sent issues.
 */
export async function confirmAndSendIssue(
  slug: string
): Promise<{broadcastId: string; dashboardUrl: string}> {
  const {composed, emailCfg} = await prepareComposedForSend(slug)
  const result = await resendBroadcast(composed, emailCfg)
  log.success(`issue delivery completed with status ${result.status}`)
  await markIssueSent(slug, {
    broadcastId: result.broadcastId,
    dashboardUrl: result.dashboardUrl,
    bodyHtml: composed.html,
    bodyText: composed.plaintext
  })
  return {broadcastId: result.broadcastId, dashboardUrl: result.dashboardUrl}
}

/**
 * Phase 2 (scheduled): compose final HTML from current section drafts and hand
 * the broadcast to Resend with a `scheduled_at` timestamp. Resend ships it at
 * that time. Marks the issue 'scheduled' until cancelled or until shipped.
 */
export async function approveAndScheduleIssue(
  slug: string,
  scheduledAt: Date
): Promise<{broadcastId: string; dashboardUrl: string; scheduledAt: number}> {
  const {issue, composed, emailCfg} = await prepareComposedForSend(
    slug,
    scheduledAt
  )

  if (issue.broadcastId) {
    if (issue.status === 'scheduled') {
      await cancelBroadcast(issue.broadcastId, emailCfg.apiKey).catch(err => {
        log.warn(
          `cancel previous scheduled broadcast failed: ${safeErrorSummary(err)}`
        )
      })
    }
    await deleteBroadcast(issue.broadcastId, emailCfg.apiKey)
  }

  const result = await resendScheduleBroadcast(composed, emailCfg, scheduledAt)
  await markIssueScheduled(slug, {
    broadcastId: result.broadcastId,
    dashboardUrl: result.dashboardUrl,
    bodyHtml: composed.html,
    bodyText: composed.plaintext,
    scheduledAt: scheduledAt.getTime()
  })
  return {
    broadcastId: result.broadcastId,
    dashboardUrl: result.dashboardUrl,
    scheduledAt: scheduledAt.getTime()
  }
}

export async function cancelApprovalForIssue(slug: string): Promise<void> {
  await ensureSchema()
  const issue = await getIssue(slug)
  if (!issue) throw new Error(`issue not found: ${slug}`)
  if (issue.status === 'sent') {
    throw new Error(`issue ${slug} already sent  -  cannot cancel`)
  }
  if (issue.status !== 'scheduled') {
    return
  }
  const emailCfg = loadEmailConfigForPublication(
    getPublication(issue.publicationId)
  )
  if (emailCfg && issue.broadcastId) {
    await cancelBroadcast(issue.broadcastId, emailCfg.apiKey)
  }
  await clearIssueSchedule(slug)
  log.info('approval cancelled, issue returned to pending review')
}

export async function regenerateSection(
  slug: string,
  index: number,
  angleHint?: string
): Promise<SectionDraft> {
  await ensureSchema()
  const issue = await getIssue(slug)
  if (!issue) throw new Error(`regenerate: issue not found: ${slug}`)
  const publication = getPublication(issue.publicationId)
  const cfg = loadConfig(publication)
  const drafts = await getSectionDrafts(slug)
  const draft = drafts[index]
  if (!draft) {
    throw new Error(`regenerate: index ${index} out of range for ${slug}`)
  }
  let selection: CuratedSelection
  try {
    selection = JSON.parse(draft.selectionJson) as CuratedSelection
  } catch {
    throw new Error(
      `regenerate: cannot parse selection_json for ${slug}/${index}`
    )
  }
  if (angleHint && angleHint.trim().length > 0) {
    selection = {
      ...selection,
      readerAngle: `${selection.readerAngle}\n\nEditor direction: ${angleHint.trim()}`
    }
  }

  log.info(
    `regenerating section ${index} for ${slug}${angleHint ? ` (angle: ${angleHint.slice(0, 80)})` : ''}`
  )
  const section = await writeSection(selection, {
    apiKey: cfg.llm.apiKey,
    baseUrl: cfg.llm.baseUrl,
    model: cfg.llm.writerModel,
    fallbackModels: cfg.llm.writerFallbackModels,
    referer: cfg.llm.referer,
    appName: cfg.llm.appName,
    systemPrompt: publication.writerSystemPrompt,
    fewShots: publication.writerFewShots
  })
  return selectionToDraft(section, selection, draft.imageUrl)
}

/*
 * CLI entry  -  `bun newsletter [publicationId]` (package.json script). Without this
 * guard the script imported the module and exited without drafting anything.
 * Publication defaults to NEWSLETTER_PUBLICATION (see activePublication()).
 */
if (import.meta.main) {
  const arg = process.argv[2]?.trim().toLowerCase()
  const publicationId = arg && isPublicationId(arg) ? arg : undefined
  if (arg && !publicationId) {
    log.error(`unknown publicationId "${arg}"`)
    process.exit(1)
  }
  runJournalistAgent({publicationId})
    .then(() => process.exit(0))
    .catch(err => {
      log.error(safeErrorSummary(err))
      process.exit(1)
    })
}
