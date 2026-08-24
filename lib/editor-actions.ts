import {
  generateBrandedSectionImage,
  loadImageGenerationConfigFromEnv
} from '../journalist/image-generator'
import {storeNewsletterImage} from '../journalist/image-storage'
import {nextScheduledSendUtc} from './schedule'
import {configuredEnv} from './server-config'
import {composeIssue} from '../journalist/issue-composer'
import type {ComposeBrand} from '../journalist/issue-composer'
import {getPublication} from '../publications'
import type {PublicationProfile} from '../publications/types'
import {
  approveAndScheduleIssue,
  cancelApprovalForIssue,
  confirmAndSendIssue,
  regenerateSection
} from '../journalist/run'
import type {Section} from '../journalist/section-writer'
import {
  deleteSectionDraft,
  ensureSchema,
  getIssue,
  getSectionDrafts,
  getSettings,
  replaceSectionDraft,
  reorderSectionDrafts,
  updateIssueSubjectIntro,
  updateSectionDraft
} from '../journalist/runs-log'
import type {
  IssueRow,
  NewsletterSettings,
  SectionDraftPatch,
  SectionDraftRow
} from '../journalist/runs-log'

function resolvePreviewDate(
  issue: Pick<IssueRow, 'scheduledAt' | 'createdAt' | 'status'>,
  settings: NewsletterSettings
): Date {
  if (issue.scheduledAt) return new Date(issue.scheduledAt)
  if (issue.status === 'sent') return new Date(issue.createdAt)
  return nextScheduledSendUtc(settings)
}

/** Build the composer brand bundle from a publicationId profile. */
function composeBrandForPublication(
  publicationId: PublicationProfile
): ComposeBrand {
  return {
    newsletter: publicationId.brand.newsletter,
    parent: publicationId.brand.parent,
    site: publicationId.brand.site,
    wordmark: publicationId.brand.wordmark,
    subtitle: publicationId.brand.subtitle,
    locale: publicationId.locale,
    timeZone: publicationId.timeZone,
    ctas: publicationId.ctas,
    feedbackCopy: publicationId.feedbackCopy,
    footer: publicationId.footer
  }
}

export interface SectionDraftDto {
  index: number
  emojiHeadline: string
  bodyMarkdown: string
  soWhat: string
  linkUrl: string
  linkText: string
  isTactical: boolean
  imageUrl: string | null
  referenceImageUrl: string | null
}

export interface IssueDetailDto {
  issue: IssueRow
  sections: SectionDraftDto[]
}

export interface SendResultDto {
  broadcastId: string
  dashboardUrl: string
}

export interface ScheduleResultDto {
  broadcastId: string
  dashboardUrl: string
  scheduledAt: number
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

function toDto(rows: SectionDraftRow[]): SectionDraftDto[] {
  return rows.map(r => ({
    index: r.sectionIndex,
    emojiHeadline: r.emojiHeadline,
    bodyMarkdown: r.bodyMarkdown,
    soWhat: r.soWhat,
    linkUrl: r.linkUrl,
    linkText: r.linkText,
    isTactical: r.isTactical,
    imageUrl: r.imageUrl,
    referenceImageUrl: r.referenceImageUrl
  }))
}

async function requireOpenIssue(slug: string): Promise<IssueRow> {
  await ensureSchema()
  const issue = await getIssue(slug)
  if (!issue) throw new HttpError(404, 'issue not found')
  if (issue.status === 'sent') throw new HttpError(409, 'issue already sent')
  return issue
}

export async function fetchIssueDetail(
  slug: string
): Promise<IssueDetailDto | null> {
  await ensureSchema()
  const issue = await getIssue(slug)
  if (!issue) return null
  const drafts = await getSectionDrafts(slug)
  return {issue, sections: toDto(drafts)}
}

export async function patchSection(
  slug: string,
  index: number,
  patch: SectionDraftPatch
): Promise<SectionDraftDto[]> {
  await requireOpenIssue(slug)
  await updateSectionDraft(slug, index, patch)
  return toDto(await getSectionDrafts(slug))
}

export async function reorderSections(
  slug: string,
  newOrder: number[]
): Promise<SectionDraftDto[]> {
  await requireOpenIssue(slug)
  await reorderSectionDrafts(slug, newOrder)
  return toDto(await getSectionDrafts(slug))
}

export async function dropSection(
  slug: string,
  index: number
): Promise<SectionDraftDto[]> {
  await requireOpenIssue(slug)
  await deleteSectionDraft(slug, index)
  return toDto(await getSectionDrafts(slug))
}

export async function regenerateSectionApi(
  slug: string,
  index: number,
  angle?: string
): Promise<SectionDraftDto[]> {
  await requireOpenIssue(slug)
  const fresh = await regenerateSection(slug, index, angle)
  await replaceSectionDraft(slug, index, fresh)
  return toDto(await getSectionDrafts(slug))
}

export async function generateSectionImageApi(
  slug: string,
  index: number,
  prompts: {systemPrompt?: string; imagePrompt?: string} = {}
): Promise<SectionDraftDto[]> {
  const issue = await requireOpenIssue(slug)
  const drafts = await getSectionDrafts(slug)
  const draft = drafts[index]
  if (!draft) throw new HttpError(404, 'section not found')

  const referenceImageUrl = draft.referenceImageUrl ?? draft.imageUrl
  const publicationId = getPublication(issue.publicationId)
  const generated = await generateBrandedSectionImage({
    headline: draft.emojiHeadline,
    bodyMarkdown: draft.bodyMarkdown,
    soWhat: draft.soWhat,
    sourceUrl: draft.linkUrl,
    referenceImageUrl,
    brand: {
      newsletter: publicationId.brand.newsletter,
      parent: publicationId.brand.parent,
      site: publicationId.brand.site
    },
    config: loadImageGenerationConfigFromEnv(),
    systemPrompt: prompts.systemPrompt,
    imagePrompt: prompts.imagePrompt
  })
  const blobUrl = await storeNewsletterImage({
    slug: issue.slug,
    sectionIndex: index,
    imageBytes: generated.imageBytes,
    contentType: generated.contentType
  })
  await updateSectionDraft(slug, index, {
    imageUrl: blobUrl,
    referenceImageUrl: draft.referenceImageUrl ?? draft.imageUrl
  })
  return toDto(await getSectionDrafts(slug))
}

export async function patchIssueMeta(
  slug: string,
  meta: {subject?: string; intro?: string}
): Promise<IssueRow> {
  await requireOpenIssue(slug)
  await updateIssueSubjectIntro(slug, meta)
  const updated = await getIssue(slug)
  if (!updated) throw new HttpError(500, 'issue vanished after meta update')
  return updated
}

export async function buildPreviewHtml(slug: string): Promise<string> {
  await ensureSchema()
  const issue = await getIssue(slug)
  if (!issue) throw new HttpError(404, 'issue not found')
  const drafts = await getSectionDrafts(slug)
  if (drafts.length === 0)
    throw new HttpError(409, 'issue has no section drafts')
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
  const publicationId = getPublication(issue.publicationId)
  const settings = await getSettings(issue.publicationId)
  const issueDate = resolvePreviewDate(issue, settings)
  const composed = composeIssue({
    sections,
    issueIntro: issue.intro,
    issueNumber: issue.issueNumber,
    slugOverride: issue.slug,
    issueDate,
    archiveBaseUrl:
      configuredEnv('NEWSLETTER_ARCHIVE_BASE_URL') ??
      `https://editor.${publicationId.brand.site}`,
    brand: composeBrandForPublication(publicationId)
  })
  return composed.html
}

export async function confirmSend(slug: string): Promise<SendResultDto> {
  const issue = await requireOpenIssue(slug)
  void issue
  return await confirmAndSendIssue(slug)
}

export async function approveAndSchedule(
  slug: string
): Promise<ScheduleResultDto> {
  const issue = await requireOpenIssue(slug)
  const settings = await getSettings(issue.publicationId)
  const scheduledAt = nextScheduledSendUtc(settings)
  return await approveAndScheduleIssue(slug, scheduledAt)
}

export async function cancelApproval(slug: string): Promise<IssueRow> {
  await requireOpenIssue(slug)
  await cancelApprovalForIssue(slug)
  const updated = await getIssue(slug)
  if (!updated) throw new HttpError(500, 'issue vanished after cancel')
  return updated
}
