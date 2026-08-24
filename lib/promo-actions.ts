import {
  assertDeliveryEnabled,
  configuredEnv,
  parseCommaList
} from './server-config'
import {collectEngagedContacts} from '../journalist/promo-engagement'
import {writePromo} from '../journalist/promo-writer'
import {composePromo} from '../journalist/promo-composer'
import type {PromoComposeBrand} from '../journalist/promo-composer'
import {
  addContactsToAudience,
  findOrCreateAudience,
  loadEmailConfigForPublication,
  sendIssue,
  suppressContactsInAudience
} from '../journalist/email-sender'
import {getPublication, isPublicationId} from '../publications'
import type {PublicationId, PublicationProfile} from '../publications/types'
import {
  createPromo,
  ensureSchema,
  getPromo,
  getPromoAudienceId,
  listPromos,
  markPromoSent,
  setPromoAudienceId,
  updatePromo
} from '../journalist/runs-log'
import type {
  PromoEngagement,
  PromoPatch,
  PromoRecord
} from '../journalist/runs-log'

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

interface LlmConfig {
  apiKey: string
  baseUrl: string
  writerModel: string
  writerFallbackModels: string[]
  appName: string
  referer: string
}

/** Resolve LLM config the same way journalist/run.ts does (shared env). */
function loadLlmConfig(publicationId: PublicationProfile): LlmConfig {
  const apiKey = configuredEnv('LLM_API_KEY')
  const baseUrl = configuredEnv('LLM_BASE_URL')
  const legacyModel = configuredEnv('NEWSLETTER_MODEL')
  const writerModel = configuredEnv('NEWSLETTER_WRITER_MODEL') ?? legacyModel
  if (!apiKey || !baseUrl || !writerModel) {
    throw new HttpError(500, 'LLM configuration is unavailable')
  }
  const writerFallbackModels = parseCommaList(
    configuredEnv('NEWSLETTER_WRITER_FALLBACK_MODELS')
  ).filter(model => model !== writerModel)
  return {
    apiKey,
    baseUrl,
    writerModel,
    writerFallbackModels,
    appName: publicationId.brand.newsletter,
    referer: `https://${publicationId.brand.site}`
  }
}

function promoBrandForPublication(
  publicationId: PublicationProfile
): PromoComposeBrand {
  return {
    newsletter: publicationId.brand.newsletter,
    parent: publicationId.brand.parent,
    site: publicationId.brand.site,
    wordmark: publicationId.brand.wordmark,
    subtitle: publicationId.brand.subtitle,
    locale: publicationId.locale,
    footer: publicationId.footer
  }
}

function resolvePublication(value: string): PublicationProfile {
  if (!isPublicationId(value))
    throw new HttpError(400, `unknown publicationId "${value}"`)
  return getPublication(value)
}

function normalizeEngagement(value: unknown): PromoEngagement {
  return value === 'clicked' ? 'clicked' : 'opened'
}

function normalizeWindow(value: unknown): number {
  const n =
    typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(n)) return 4
  return Math.min(52, Math.max(1, Math.trunc(n)))
}

/** Resolve the Resend email config for a publicationId, or throw a 400 with guidance. */
function requireEmailConfig(publicationId: PublicationProfile) {
  const cfg = loadEmailConfigForPublication(publicationId)
  if (!cfg) {
    throw new HttpError(
      400,
      `Resend env not configured for publicationId ${publicationId.id} - set ${publicationId.resendEnv.apiKey}, ${publicationId.resendEnv.audienceId}, ${publicationId.resendEnv.fromEmail}.`
    )
  }
  return cfg
}

// ---- Audience preview -------------------------------------------------------

export interface AudiencePreviewDto {
  publicationId: PublicationId
  windowIssues: number
  engagement: PromoEngagement
  reach: number
  excludedUnsub: number
  scannedBroadcasts: number
  engagedInWindow: number
  windowBroadcasts: Array<{name: string | null; sentAt: number | null}>
}

export async function previewAudience(input: {
  publicationId: string
  windowIssues: unknown
  engagement: unknown
}): Promise<AudiencePreviewDto> {
  const publicationId = resolvePublication(input.publicationId)
  const emailCfg = requireEmailConfig(publicationId)
  const windowIssues = normalizeWindow(input.windowIssues)
  const engagement = normalizeEngagement(input.engagement)

  const result = await collectEngagedContacts({
    apiKey: emailCfg.apiKey,
    audienceId: emailCfg.audienceId,
    windowIssues,
    engagement
  })
  return {
    publicationId: publicationId.id,
    windowIssues,
    engagement,
    reach: result.emails.length,
    excludedUnsub: result.excludedUnsub,
    scannedBroadcasts: result.scannedBroadcasts,
    engagedInWindow: result.engagedInWindow,
    windowBroadcasts: result.windowBroadcasts.map(b => ({
      name: b.name,
      sentAt: b.sentAt
    }))
  }
}

// ---- Draft ------------------------------------------------------------------

export async function draftPromo(input: {
  publicationId: string
  brief: unknown
  windowIssues: unknown
  engagement: unknown
}): Promise<PromoRecord> {
  await ensureSchema()
  const publicationId = resolvePublication(input.publicationId)
  const brief = typeof input.brief === 'string' ? input.brief.trim() : ''
  if (brief.length === 0) throw new HttpError(400, 'brief is required')
  const windowIssues = normalizeWindow(input.windowIssues)
  const engagement = normalizeEngagement(input.engagement)
  const llm = loadLlmConfig(publicationId)

  const draft = await writePromo(brief, {
    apiKey: llm.apiKey,
    baseUrl: llm.baseUrl,
    model: llm.writerModel,
    fallbackModels: llm.writerFallbackModels,
    referer: llm.referer,
    appName: llm.appName,
    voiceSystemPrompt: publicationId.writerSystemPrompt
  })

  const now = Date.now()
  const id = `promo-${publicationId.id}-${now}`
  const promo: PromoRecord = {
    id,
    publicationId: publicationId.id,
    subject: draft.subject,
    previewText: draft.previewText,
    headline: draft.headline,
    bodyMarkdown: draft.bodyMarkdown,
    ctaLabel: draft.ctaLabel,
    ctaUrl: draft.ctaUrl,
    brief,
    windowIssues,
    engagement,
    bodyHtml: null,
    bodyText: null,
    targetCount: null,
    broadcastId: null,
    dashboardUrl: null,
    status: 'draft',
    createdAt: now,
    sentAt: null
  }
  await createPromo(promo)
  return promo
}

// ---- Read / edit ------------------------------------------------------------

export async function fetchPromoList(
  publicationId?: string
): Promise<PromoRecord[]> {
  await ensureSchema()
  const selectedPublicationId =
    publicationId && isPublicationId(publicationId) ? publicationId : undefined
  return listPromos(selectedPublicationId)
}

export async function fetchPromoDetail(
  id: string
): Promise<PromoRecord | null> {
  await ensureSchema()
  return getPromo(id)
}

async function requireDraftPromo(id: string): Promise<PromoRecord> {
  await ensureSchema()
  const promo = await getPromo(id)
  if (!promo) throw new HttpError(404, 'promo not found')
  if (promo.status === 'sent') throw new HttpError(409, 'promo already sent')
  return promo
}

export async function patchPromo(
  id: string,
  patch: PromoPatch
): Promise<PromoRecord> {
  await requireDraftPromo(id)
  await updatePromo(id, patch)
  const updated = await getPromo(id)
  if (!updated) throw new HttpError(500, 'promo vanished after update')
  return updated
}

export async function buildPromoPreviewHtml(id: string): Promise<string> {
  await ensureSchema()
  const promo = await getPromo(id)
  if (!promo) throw new HttpError(404, 'promo not found')
  const publicationId = getPublication(promo.publicationId)
  const composed = composePromo({
    subject: promo.subject,
    previewText: promo.previewText,
    headline: promo.headline,
    bodyMarkdown: promo.bodyMarkdown,
    ctaLabel: promo.ctaLabel,
    ctaUrl: promo.ctaUrl,
    brand: promoBrandForPublication(publicationId)
  })
  return composed.html
}

// ---- Send -------------------------------------------------------------------

export interface PromoSendResultDto {
  broadcastId: string
  dashboardUrl: string
  status: 'draft' | 'sent' | 'scheduled'
  targetCount: number
}

/**
 * Compose the promo, refresh the per-publicationId Engaged audience with the current
 * openers/clickers (append-only) minus unsubscribers, then create a Resend
 * broadcast against that audience. Default is a DRAFT for human review; set
 * NEWSLETTER_DELIVERY_ENABLED=true to permit Resend mutations.
 */
export async function sendPromo(id: string): Promise<PromoSendResultDto> {
  assertDeliveryEnabled()
  const promo = await requireDraftPromo(id)
  const publicationId = getPublication(promo.publicationId)
  const emailCfg = requireEmailConfig(publicationId)

  // 1. Recompute the engaged set from live Resend engagement data.
  const engaged = await collectEngagedContacts({
    apiKey: emailCfg.apiKey,
    audienceId: emailCfg.audienceId,
    windowIssues: promo.windowIssues,
    engagement: promo.engagement
  })
  if (engaged.emails.length === 0) {
    throw new HttpError(
      409,
      'no engaged contacts found for this window/engagement - widen the window or wait for more opens'
    )
  }

  // 2. Ensure the per-publicationId Engaged audience exists (cached id in DB).
  const audienceName = `${publicationId.brand.newsletter} - Engaged (${publicationId.id.toUpperCase()})`
  let engagedAudienceId = await getPromoAudienceId(publicationId.id)
  if (!engagedAudienceId) {
    engagedAudienceId = await findOrCreateAudience(
      audienceName,
      emailCfg.apiKey
    )
    await setPromoAudienceId(publicationId.id, engagedAudienceId)
  }

  // 3. Append current openers, then suppress anyone unsubscribed from the main list.
  await addContactsToAudience(
    engagedAudienceId,
    engaged.emails,
    emailCfg.apiKey
  )
  if (engaged.unsubscribedEmails.length > 0) {
    await suppressContactsInAudience(
      engagedAudienceId,
      engaged.unsubscribedEmails,
      emailCfg.apiKey
    )
  }

  // 4. Compose the branded email and broadcast to the Engaged audience.
  const composed = composePromo({
    subject: promo.subject,
    previewText: promo.previewText,
    headline: promo.headline,
    bodyMarkdown: promo.bodyMarkdown,
    ctaLabel: promo.ctaLabel,
    ctaUrl: promo.ctaUrl,
    brand: promoBrandForPublication(publicationId)
  })

  const result = await sendIssue(
    {
      subject: composed.subject,
      previewText: composed.previewText,
      plaintext: composed.plaintext,
      html: composed.html,
      slug: promo.id
    },
    {
      ...emailCfg,
      audienceId: engagedAudienceId,
      broadcastName: `${publicationId.brand.newsletter} - Promo: ${composed.subject}`
    }
  )

  await markPromoSent(id, {
    broadcastId: result.broadcastId,
    dashboardUrl: result.dashboardUrl,
    bodyHtml: composed.html,
    bodyText: composed.plaintext,
    targetCount: engaged.emails.length
  })

  return {
    broadcastId: result.broadcastId,
    dashboardUrl: result.dashboardUrl,
    status: result.status,
    targetCount: engaged.emails.length
  }
}
