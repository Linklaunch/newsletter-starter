import {sql} from '@vercel/postgres'
import {DEFAULT_PUBLICATION_ID, PUBLICATION_IDS} from '../publications/display'
import type {PublicationId} from '../publications/types'

export type IssueStatus =
  | 'pending_review'
  | 'approved'
  | 'scheduled'
  | 'sent'
  | 'draft'

export interface IssueRecord {
  slug: string
  issueNumber: number
  subject: string
  intro: string
  bodyHtml: string | null
  bodyText: string | null
  broadcastId: string | null
  dashboardUrl: string | null
  status: IssueStatus
  scheduledAt: number | null
  createdAt: number
  publicationId: PublicationId
}

export interface SectionDraft {
  emojiHeadline: string
  bodyMarkdown: string
  soWhat: string
  linkUrl: string
  linkText: string
  isTactical: boolean
  imageUrl: string | null
  referenceImageUrl: string | null
  selectionJson: string
}

export interface SectionDraftRow extends SectionDraft {
  issueSlug: string
  sectionIndex: number
}

export interface IssueRow extends IssueRecord {
  itemCount: number
  sectionDraftCount: number
}

export interface ItemHeadline {
  headline: string
  source: 'rss' | 'x'
  createdAt: number
}

export interface SectionDraftPatch {
  emojiHeadline?: string
  bodyMarkdown?: string
  soWhat?: string
  isTactical?: boolean
  imageUrl?: string | null
  referenceImageUrl?: string | null
}

export interface FeedbackCounts {
  fire: number
  smile: number
  sleep: number
  total: number
}

export interface FeedbackRecord {
  slug: string
  rating: 1 | 2 | 3
  voterHash: string
  userAgent: string | null
}

export interface FeedbackResult {
  counted: boolean
  previousRating: number | null
}

export async function ensureSchema(): Promise<void> {
  const now = Date.now()
  await sql`
    CREATE TABLE IF NOT EXISTS newsletter_issues (
      slug TEXT PRIMARY KEY,
      issue_number INTEGER NOT NULL,
      subject TEXT NOT NULL,
      intro TEXT NOT NULL,
      body_html TEXT,
      body_text TEXT,
      broadcast_id TEXT,
      dashboard_url TEXT,
      status TEXT NOT NULL DEFAULT 'pending_review',
      scheduled_at BIGINT,
      created_at BIGINT NOT NULL,
      publication_id TEXT NOT NULL
    )
  `
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS uniq_issues_publication_number ON newsletter_issues(publication_id, issue_number)`
  await sql`
    CREATE TABLE IF NOT EXISTS newsletter_items (
      issue_slug TEXT NOT NULL REFERENCES newsletter_issues(slug) ON DELETE CASCADE,
      item_hash TEXT NOT NULL,
      source TEXT NOT NULL,
      source_name TEXT NOT NULL,
      url TEXT NOT NULL,
      headline TEXT NOT NULL,
      is_tactical BOOLEAN NOT NULL DEFAULT FALSE,
      created_at BIGINT NOT NULL,
      publication_id TEXT NOT NULL,
      PRIMARY KEY (issue_slug, item_hash)
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_items_hash ON newsletter_items(item_hash)`
  await sql`CREATE INDEX IF NOT EXISTS idx_items_publication_hash ON newsletter_items(publication_id, item_hash)`
  await sql`CREATE INDEX IF NOT EXISTS idx_issues_created ON newsletter_issues(created_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS idx_issues_publication ON newsletter_issues(publication_id)`
  await sql`
    CREATE TABLE IF NOT EXISTS newsletter_section_drafts (
      issue_slug TEXT NOT NULL REFERENCES newsletter_issues(slug) ON DELETE CASCADE,
      section_index INTEGER NOT NULL,
      emoji_headline TEXT NOT NULL,
      body_markdown TEXT NOT NULL,
      so_what TEXT NOT NULL,
      link_url TEXT NOT NULL,
      link_text TEXT NOT NULL,
      is_tactical BOOLEAN NOT NULL DEFAULT FALSE,
      image_url TEXT,
      reference_image_url TEXT,
      image_alt TEXT,
      selection_json TEXT NOT NULL,
      PRIMARY KEY (issue_slug, section_index)
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS newsletter_bounces (
      id BIGSERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      bounce_type TEXT NOT NULL,
      bounce_subtype TEXT,
      email_id TEXT,
      contact_removed BOOLEAN NOT NULL DEFAULT FALSE,
      occurred_at BIGINT NOT NULL
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_bounces_email ON newsletter_bounces(email)`
  await sql`CREATE INDEX IF NOT EXISTS idx_bounces_type ON newsletter_bounces(bounce_type)`
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS uniq_bounces_event ON newsletter_bounces(email_id, bounce_type)`
  await sql`
    CREATE TABLE IF NOT EXISTS newsletter_settings (
      publication_id TEXT PRIMARY KEY,
      draft_days_utc INTEGER[] NOT NULL,
      draft_hour_utc INTEGER NOT NULL,
      send_days_utc INTEGER[] NOT NULL,
      send_hour_utc INTEGER NOT NULL,
      draft_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at BIGINT NOT NULL
    )
  `
  // Migrate a pre-existing table from the old single-day-of-week columns
  // (draft_day_utc/send_day_utc INTEGER) to day-set arrays. CREATE TABLE IF
  // NOT EXISTS above is a no-op against an already-created table, so this
  // runs unconditionally and only acts when the old column is still present
  // — idempotent, safe to run on every ensureSchema() call.
  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'newsletter_settings' AND column_name = 'draft_day_utc'
      ) THEN
        ALTER TABLE newsletter_settings RENAME COLUMN draft_day_utc TO draft_days_utc;
        ALTER TABLE newsletter_settings ALTER COLUMN draft_days_utc TYPE INTEGER[] USING ARRAY[draft_days_utc];
      END IF;
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'newsletter_settings' AND column_name = 'send_day_utc'
      ) THEN
        ALTER TABLE newsletter_settings RENAME COLUMN send_day_utc TO send_days_utc;
        ALTER TABLE newsletter_settings ALTER COLUMN send_days_utc TYPE INTEGER[] USING ARRAY[send_days_utc];
      END IF;
    END $$
  `
  // Seed a disabled schedule row for every registered publication, so a new
  // publication is visible in the console before anyone enables its drafting.
  for (const publicationId of PUBLICATION_IDS) {
    await sql`
      INSERT INTO newsletter_settings
        (publication_id, draft_days_utc, draft_hour_utc, send_days_utc, send_hour_utc, draft_enabled, updated_at)
      VALUES (${publicationId}, ARRAY[2]::INTEGER[], 13, ARRAY[3]::INTEGER[], 14, FALSE, ${now})
      ON CONFLICT (publication_id) DO NOTHING
    `
  }
  await sql`
    CREATE TABLE IF NOT EXISTS newsletter_feedback (
      id BIGSERIAL PRIMARY KEY,
      issue_slug TEXT NOT NULL REFERENCES newsletter_issues(slug) ON DELETE CASCADE,
      rating SMALLINT NOT NULL CHECK (rating IN (1, 2, 3)),
      voter_hash TEXT NOT NULL,
      user_agent TEXT,
      created_at BIGINT NOT NULL
    )
  `
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS uniq_feedback_voter ON newsletter_feedback(issue_slug, voter_hash)`
  await sql`
    CREATE TABLE IF NOT EXISTS newsletter_promos (
      id TEXT PRIMARY KEY,
      publication_id TEXT NOT NULL,
      subject TEXT NOT NULL,
      preview_text TEXT NOT NULL DEFAULT '',
      headline TEXT NOT NULL,
      body_markdown TEXT NOT NULL,
      cta_label TEXT NOT NULL,
      cta_url TEXT NOT NULL,
      brief TEXT NOT NULL DEFAULT '',
      window_issues INTEGER NOT NULL DEFAULT 4,
      engagement TEXT NOT NULL DEFAULT 'opened',
      body_html TEXT,
      body_text TEXT,
      target_count INTEGER,
      broadcast_id TEXT,
      dashboard_url TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at BIGINT NOT NULL,
      sent_at BIGINT
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_promos_publication_created ON newsletter_promos(publication_id, created_at DESC)`
  await sql`
    CREATE TABLE IF NOT EXISTS newsletter_promo_audiences (
      publication_id TEXT PRIMARY KEY,
      audience_id TEXT NOT NULL,
      updated_at BIGINT NOT NULL
    )
  `
}

export interface NewsletterSettings {
  draftDaysUtc: number[]
  draftHourUtc: number
  sendDaysUtc: number[]
  sendHourUtc: number
  draftEnabled: boolean
  updatedAt: number
}

export interface NewsletterSettingsPatch {
  draftDaysUtc?: number[]
  draftHourUtc?: number
  sendDaysUtc?: number[]
  sendHourUtc?: number
  draftEnabled?: boolean
}

interface RawSettingsRow {
  draft_days_utc: number[]
  draft_hour_utc: number
  send_days_utc: number[]
  send_hour_utc: number
  draft_enabled: boolean
  updated_at: string | number
}

export async function getSettings(
  publicationId: PublicationId = DEFAULT_PUBLICATION_ID
): Promise<NewsletterSettings> {
  await ensureSchema()
  const r = await sql`
    SELECT draft_days_utc, draft_hour_utc, send_days_utc, send_hour_utc, draft_enabled, updated_at
      FROM newsletter_settings
     WHERE publication_id = ${publicationId}
  `
  const row = r.rows[0] as RawSettingsRow | undefined
  if (!row) {
    throw new Error(
      `newsletter_settings row missing for publicationId ${publicationId}  -  ensureSchema should have seeded it`
    )
  }
  return {
    draftDaysUtc: row.draft_days_utc,
    draftHourUtc: row.draft_hour_utc,
    sendDaysUtc: row.send_days_utc,
    sendHourUtc: row.send_hour_utc,
    draftEnabled: row.draft_enabled,
    updatedAt: Number(row.updated_at)
  }
}

/** Validates, de-dupes, and sorts a day-of-week set before it reaches the DB. */
function normalizeDaysUtc(days: number[], field: string): number[] {
  if (!Array.isArray(days) || days.length === 0) {
    throw new Error(`${field} must be a non-empty array`)
  }
  for (const d of days) {
    if (!Number.isInteger(d) || d < 0 || d > 6) {
      throw new Error(`${field} values must be integers 0-6`)
    }
  }
  return [...new Set(days)].sort((a, b) => a - b)
}

export async function updateSettings(
  patch: NewsletterSettingsPatch,
  publicationId: PublicationId = DEFAULT_PUBLICATION_ID
): Promise<NewsletterSettings> {
  await ensureSchema()
  if (patch.draftDaysUtc !== undefined) {
    const days = normalizeDaysUtc(patch.draftDaysUtc, 'draftDaysUtc')
    await sql`UPDATE newsletter_settings SET draft_days_utc = ${days} WHERE publication_id = ${publicationId}`
  }
  if (patch.draftHourUtc !== undefined) {
    if (
      !Number.isInteger(patch.draftHourUtc) ||
      patch.draftHourUtc < 0 ||
      patch.draftHourUtc > 23
    ) {
      throw new Error('draftHourUtc must be 0-23')
    }
    await sql`UPDATE newsletter_settings SET draft_hour_utc = ${patch.draftHourUtc} WHERE publication_id = ${publicationId}`
  }
  if (patch.sendDaysUtc !== undefined) {
    const days = normalizeDaysUtc(patch.sendDaysUtc, 'sendDaysUtc')
    await sql`UPDATE newsletter_settings SET send_days_utc = ${days} WHERE publication_id = ${publicationId}`
  }
  if (patch.sendHourUtc !== undefined) {
    if (
      !Number.isInteger(patch.sendHourUtc) ||
      patch.sendHourUtc < 0 ||
      patch.sendHourUtc > 23
    ) {
      throw new Error('sendHourUtc must be 0-23')
    }
    await sql`UPDATE newsletter_settings SET send_hour_utc = ${patch.sendHourUtc} WHERE publication_id = ${publicationId}`
  }
  if (patch.draftEnabled !== undefined) {
    await sql`UPDATE newsletter_settings SET draft_enabled = ${patch.draftEnabled} WHERE publication_id = ${publicationId}`
  }
  await sql`UPDATE newsletter_settings SET updated_at = ${Date.now()} WHERE publication_id = ${publicationId}`
  return getSettings(publicationId)
}

export interface IssueItemRecord {
  issueSlug: string
  itemHash: string
  source: 'rss' | 'x'
  sourceName: string
  url: string
  headline: string
  isTactical: boolean
}

export async function recordIssue(
  issue: IssueRecord,
  items: IssueItemRecord[]
): Promise<void> {
  await sql`
    INSERT INTO newsletter_issues
      (slug, issue_number, subject, intro, body_html, body_text,
       broadcast_id, dashboard_url, status, scheduled_at, created_at, publication_id)
    VALUES
      (${issue.slug}, ${issue.issueNumber}, ${issue.subject}, ${issue.intro},
       ${issue.bodyHtml}, ${issue.bodyText},
       ${issue.broadcastId}, ${issue.dashboardUrl}, ${issue.status},
       ${issue.scheduledAt}, ${issue.createdAt}, ${issue.publicationId})
  `
  for (const it of items) {
    await sql`
      INSERT INTO newsletter_items
        (issue_slug, item_hash, source, source_name, url, headline, is_tactical, created_at, publication_id)
      VALUES
        (${it.issueSlug}, ${it.itemHash}, ${it.source}, ${it.sourceName},
         ${it.url}, ${it.headline}, ${it.isTactical}, ${issue.createdAt}, ${issue.publicationId})
    `
  }
}

export async function nextIssueNumber(
  publicationId: PublicationId = DEFAULT_PUBLICATION_ID
): Promise<number> {
  const r = await sql`
    SELECT COALESCE(MAX(issue_number), 0)::int AS n
      FROM newsletter_issues
     WHERE publication_id = ${publicationId}
  `
  const n = (r.rows[0] as {n: number} | undefined)?.n ?? 0
  return n + 1
}

export async function hasItemBeenUsed(
  itemHash: string,
  publicationId: PublicationId = DEFAULT_PUBLICATION_ID
): Promise<boolean> {
  const r = await sql`
    SELECT 1 FROM newsletter_items
     WHERE item_hash = ${itemHash} AND publication_id = ${publicationId}
     LIMIT 1
  `
  return r.rows.length > 0
}

export async function recentItemHeadlines(
  sinceMs: number,
  publicationId: PublicationId = DEFAULT_PUBLICATION_ID,
  limit = 50
): Promise<ItemHeadline[]> {
  const r = await sql`
    SELECT headline, source, created_at
      FROM newsletter_items
     WHERE created_at >= ${sinceMs} AND publication_id = ${publicationId}
     ORDER BY created_at DESC
     LIMIT ${limit}
  `
  return r.rows.map(row => ({
    headline: row.headline as string,
    source: row.source as 'rss' | 'x',
    createdAt: Number(row.created_at)
  }))
}

const ISSUE_SELECT = `
  SELECT i.slug, i.issue_number, i.subject, i.intro, i.body_html, i.body_text,
         i.broadcast_id, i.dashboard_url, i.status, i.scheduled_at, i.created_at, i.publication_id,
         (SELECT COUNT(*) FROM newsletter_items WHERE issue_slug = i.slug)::int AS item_count,
         (SELECT COUNT(*) FROM newsletter_section_drafts WHERE issue_slug = i.slug)::int AS section_draft_count
    FROM newsletter_issues i
`

interface RawIssueRow {
  slug: string
  issue_number: number
  subject: string
  intro: string
  body_html: string | null
  body_text: string | null
  broadcast_id: string | null
  dashboard_url: string | null
  status: IssueStatus
  scheduled_at: string | number | null
  created_at: string | number
  publication_id: string | null
  item_count: number
  section_draft_count: number
}

function asPublicationId(value: string | null | undefined): PublicationId {
  if (value && PUBLICATION_IDS.includes(value)) return value
  throw new Error(`unknown publication_id in database: ${value ?? 'null'}`)
}

function mapIssueRow(r: RawIssueRow): IssueRow {
  return {
    slug: r.slug,
    issueNumber: r.issue_number,
    subject: r.subject,
    intro: r.intro,
    bodyHtml: r.body_html,
    bodyText: r.body_text,
    broadcastId: r.broadcast_id,
    dashboardUrl: r.dashboard_url,
    status: r.status,
    scheduledAt: r.scheduled_at == null ? null : Number(r.scheduled_at),
    createdAt: Number(r.created_at),
    publicationId: asPublicationId(r.publication_id),
    itemCount: r.item_count,
    sectionDraftCount: r.section_draft_count
  }
}

export async function listIssues(
  publicationId?: PublicationId,
  limit = 50
): Promise<IssueRow[]> {
  const r = publicationId
    ? await sql.query(
        `${ISSUE_SELECT} WHERE i.publication_id = $1 ORDER BY i.created_at DESC LIMIT $2`,
        [publicationId, limit]
      )
    : await sql.query(`${ISSUE_SELECT} ORDER BY i.created_at DESC LIMIT $1`, [
        limit
      ])
  return (r.rows as unknown as RawIssueRow[]).map(mapIssueRow)
}

export async function getIssue(slug: string): Promise<IssueRow | null> {
  const r = await sql.query(`${ISSUE_SELECT} WHERE i.slug = $1`, [slug])
  const row = r.rows[0] as RawIssueRow | undefined
  return row ? mapIssueRow(row) : null
}

export async function saveSectionDrafts(
  slug: string,
  drafts: SectionDraft[]
): Promise<void> {
  await sql`DELETE FROM newsletter_section_drafts WHERE issue_slug = ${slug}`
  for (let i = 0; i < drafts.length; i++) {
    const d = drafts[i]!
    await sql`
      INSERT INTO newsletter_section_drafts
        (issue_slug, section_index, emoji_headline, body_markdown, so_what,
         link_url, link_text, is_tactical, image_url, reference_image_url, selection_json)
      VALUES
        (${slug}, ${i}, ${d.emojiHeadline}, ${d.bodyMarkdown}, ${d.soWhat},
         ${d.linkUrl}, ${d.linkText}, ${d.isTactical}, ${d.imageUrl}, ${d.referenceImageUrl}, ${d.selectionJson})
    `
  }
}

export async function getSectionDrafts(
  slug: string
): Promise<SectionDraftRow[]> {
  const r = await sql`
    SELECT issue_slug, section_index, emoji_headline, body_markdown, so_what,
           link_url, link_text, is_tactical, image_url, reference_image_url, selection_json
      FROM newsletter_section_drafts
     WHERE issue_slug = ${slug}
     ORDER BY section_index ASC
  `
  return r.rows.map(row => ({
    issueSlug: row.issue_slug as string,
    sectionIndex: row.section_index as number,
    emojiHeadline: row.emoji_headline as string,
    bodyMarkdown: row.body_markdown as string,
    soWhat: row.so_what as string,
    linkUrl: row.link_url as string,
    linkText: row.link_text as string,
    isTactical: row.is_tactical as boolean,
    imageUrl: (row.image_url as string | null) ?? null,
    referenceImageUrl: (row.reference_image_url as string | null) ?? null,
    selectionJson: row.selection_json as string
  }))
}

export async function updateSectionDraft(
  slug: string,
  index: number,
  patch: SectionDraftPatch
): Promise<void> {
  if (patch.emojiHeadline !== undefined) {
    await sql`UPDATE newsletter_section_drafts SET emoji_headline = ${patch.emojiHeadline} WHERE issue_slug = ${slug} AND section_index = ${index}`
  }
  if (patch.bodyMarkdown !== undefined) {
    await sql`UPDATE newsletter_section_drafts SET body_markdown = ${patch.bodyMarkdown} WHERE issue_slug = ${slug} AND section_index = ${index}`
  }
  if (patch.soWhat !== undefined) {
    await sql`UPDATE newsletter_section_drafts SET so_what = ${patch.soWhat} WHERE issue_slug = ${slug} AND section_index = ${index}`
  }
  if (patch.isTactical !== undefined) {
    await sql`UPDATE newsletter_section_drafts SET is_tactical = ${patch.isTactical} WHERE issue_slug = ${slug} AND section_index = ${index}`
  }
  if (patch.imageUrl !== undefined) {
    await sql`UPDATE newsletter_section_drafts SET image_url = ${patch.imageUrl} WHERE issue_slug = ${slug} AND section_index = ${index}`
  }
  if (patch.referenceImageUrl !== undefined) {
    await sql`UPDATE newsletter_section_drafts SET reference_image_url = ${patch.referenceImageUrl} WHERE issue_slug = ${slug} AND section_index = ${index}`
  }
}

export async function reorderSectionDrafts(
  slug: string,
  newOrder: number[]
): Promise<void> {
  const drafts = await getSectionDrafts(slug)
  if (newOrder.length !== drafts.length) {
    throw new Error(
      `reorder length mismatch: got ${newOrder.length}, expected ${drafts.length}`
    )
  }
  const reordered: SectionDraft[] = []
  for (const oldIndex of newOrder) {
    const d = drafts[oldIndex]
    if (!d) throw new Error(`reorder references missing index ${oldIndex}`)
    reordered.push(extractDraft(d))
  }
  await saveSectionDrafts(slug, reordered)
}

export async function deleteSectionDraft(
  slug: string,
  index: number
): Promise<void> {
  const drafts = await getSectionDrafts(slug)
  if (index < 0 || index >= drafts.length) {
    throw new Error(
      `deleteSectionDraft: index ${index} out of range (have ${drafts.length})`
    )
  }
  const remaining = drafts.filter((_, i) => i !== index).map(extractDraft)
  await saveSectionDrafts(slug, remaining)
}

export async function replaceSectionDraft(
  slug: string,
  index: number,
  replacement: SectionDraft
): Promise<void> {
  const drafts = await getSectionDrafts(slug)
  if (index < 0 || index >= drafts.length) {
    throw new Error(
      `replaceSectionDraft: index ${index} out of range (have ${drafts.length})`
    )
  }
  const next = drafts.map((d, i) =>
    i === index ? replacement : extractDraft(d)
  )
  await saveSectionDrafts(slug, next)
}

export async function updateIssueSubjectIntro(
  slug: string,
  fields: {subject?: string; intro?: string}
): Promise<void> {
  if (fields.subject !== undefined) {
    await sql`UPDATE newsletter_issues SET subject = ${fields.subject} WHERE slug = ${slug}`
  }
  if (fields.intro !== undefined) {
    await sql`UPDATE newsletter_issues SET intro = ${fields.intro} WHERE slug = ${slug}`
  }
}

export async function markIssueSent(
  slug: string,
  fields: {
    broadcastId: string
    dashboardUrl: string
    bodyHtml: string
    bodyText: string
  }
): Promise<void> {
  await sql`
    UPDATE newsletter_issues
       SET status = 'sent',
           broadcast_id = ${fields.broadcastId},
           dashboard_url = ${fields.dashboardUrl},
           body_html = ${fields.bodyHtml},
           body_text = ${fields.bodyText},
           scheduled_at = NULL
     WHERE slug = ${slug}
  `
}

export async function markIssueScheduled(
  slug: string,
  fields: {
    broadcastId: string
    dashboardUrl: string
    bodyHtml: string
    bodyText: string
    scheduledAt: number
  }
): Promise<void> {
  await sql`
    UPDATE newsletter_issues
       SET status = 'scheduled',
           broadcast_id = ${fields.broadcastId},
           dashboard_url = ${fields.dashboardUrl},
           body_html = ${fields.bodyHtml},
           body_text = ${fields.bodyText},
           scheduled_at = ${fields.scheduledAt}
     WHERE slug = ${slug}
  `
}

export async function clearIssueSchedule(slug: string): Promise<void> {
  await sql`
    UPDATE newsletter_issues
       SET status = 'pending_review',
           scheduled_at = NULL
     WHERE slug = ${slug}
  `
}

/**
 * Flip an already-scheduled issue to 'sent' without touching body/broadcast
 * metadata. Called by the reconciler cron once Resend confirms delivery.
 */
export async function markScheduledIssueSent(slug: string): Promise<void> {
  await sql`
    UPDATE newsletter_issues
       SET status = 'sent',
           scheduled_at = NULL
     WHERE slug = ${slug}
       AND status = 'scheduled'
  `
}

export async function listScheduledIssues(): Promise<IssueRow[]> {
  const r = await sql.query(
    `${ISSUE_SELECT} WHERE i.status = 'scheduled' ORDER BY i.scheduled_at ASC NULLS LAST`,
    []
  )
  return (r.rows as unknown as RawIssueRow[]).map(mapIssueRow)
}

export type BounceType = 'hard' | 'soft' | 'complaint'

export interface BounceRecord {
  email: string
  bounceType: BounceType
  bounceSubtype: string | null
  emailId: string | null
  contactRemoved: boolean
}

/**
 * Insert a bounce row, deduping on (email_id, bounce_type). Returns true if
 * a new row was inserted, false if this event was already recorded  -  lets
 * the webhook handler skip re-deleting / re-counting on Svix retries.
 */
export async function recordBounce(rec: BounceRecord): Promise<boolean> {
  const r = await sql`
    INSERT INTO newsletter_bounces
      (email, bounce_type, bounce_subtype, email_id, contact_removed, occurred_at)
    VALUES
      (${rec.email.toLowerCase()}, ${rec.bounceType}, ${rec.bounceSubtype},
       ${rec.emailId}, ${rec.contactRemoved}, ${Date.now()})
    ON CONFLICT (email_id, bounce_type) DO NOTHING
    RETURNING id
  `
  return r.rows.length > 0
}

/**
 * Mark every prior bounce row for an email as contact_removed=true. Called
 * after a successful Resend contact deletion (e.g. after the 3rd soft bounce)
 * so the audit trail stays consistent.
 */
export async function markContactRemoved(email: string): Promise<void> {
  await sql`
    UPDATE newsletter_bounces
       SET contact_removed = TRUE
     WHERE email = ${email.toLowerCase()}
  `
}

export async function softBounceCount(email: string): Promise<number> {
  const r = await sql`
    SELECT COUNT(*)::int AS n
      FROM newsletter_bounces
     WHERE email = ${email.toLowerCase()}
       AND bounce_type = 'soft'
  `
  return (r.rows[0] as {n: number} | undefined)?.n ?? 0
}

export async function recordFeedback(
  rec: FeedbackRecord
): Promise<FeedbackResult> {
  const existing = await sql`
    SELECT rating
      FROM newsletter_feedback
     WHERE issue_slug = ${rec.slug}
       AND voter_hash = ${rec.voterHash}
     LIMIT 1
  `
  const previousRating =
    (existing.rows[0]?.rating as number | undefined) ?? null
  await sql`
    INSERT INTO newsletter_feedback
      (issue_slug, rating, voter_hash, user_agent, created_at)
    VALUES
      (${rec.slug}, ${rec.rating}, ${rec.voterHash}, ${rec.userAgent}, ${Date.now()})
    ON CONFLICT (issue_slug, voter_hash) DO UPDATE
      SET rating = EXCLUDED.rating,
          user_agent = EXCLUDED.user_agent,
          created_at = EXCLUDED.created_at
  `
  return {counted: previousRating === null, previousRating}
}

export async function getFeedbackCounts(slug: string): Promise<FeedbackCounts> {
  const batch = await getFeedbackCountsBatch([slug])
  return batch[slug] ?? emptyFeedbackCounts()
}

export async function getFeedbackCountsBatch(
  slugs: string[]
): Promise<Record<string, FeedbackCounts>> {
  const out: Record<string, FeedbackCounts> = {}
  for (const slug of slugs) out[slug] = emptyFeedbackCounts()
  if (slugs.length === 0) return out
  const r = await sql.query(
    `SELECT issue_slug, rating, COUNT(*)::int AS n
       FROM newsletter_feedback
      WHERE issue_slug = ANY($1::text[])
      GROUP BY issue_slug, rating`,
    [slugs]
  )
  for (const row of r.rows as Array<{
    issue_slug: string
    rating: number
    n: number
  }>) {
    const counts = out[row.issue_slug] ?? emptyFeedbackCounts()
    if (row.rating === 1) counts.fire = row.n
    if (row.rating === 2) counts.smile = row.n
    if (row.rating === 3) counts.sleep = row.n
    counts.total = counts.fire + counts.smile + counts.sleep
    out[row.issue_slug] = counts
  }
  return out
}

function emptyFeedbackCounts(): FeedbackCounts {
  return {fire: 0, smile: 0, sleep: 0, total: 0}
}

export type PromoStatus = 'draft' | 'sent'
export type PromoEngagement = 'opened' | 'clicked'

export interface PromoRecord {
  id: string
  publicationId: PublicationId
  subject: string
  previewText: string
  headline: string
  bodyMarkdown: string
  ctaLabel: string
  ctaUrl: string
  brief: string
  windowIssues: number
  engagement: PromoEngagement
  bodyHtml: string | null
  bodyText: string | null
  targetCount: number | null
  broadcastId: string | null
  dashboardUrl: string | null
  status: PromoStatus
  createdAt: number
  sentAt: number | null
}

export interface PromoPatch {
  subject?: string
  previewText?: string
  headline?: string
  bodyMarkdown?: string
  ctaLabel?: string
  ctaUrl?: string
  windowIssues?: number
  engagement?: PromoEngagement
}

interface RawPromoRow {
  id: string
  publication_id: string | null
  subject: string
  preview_text: string
  headline: string
  body_markdown: string
  cta_label: string
  cta_url: string
  brief: string
  window_issues: number
  engagement: string
  body_html: string | null
  body_text: string | null
  target_count: number | null
  broadcast_id: string | null
  dashboard_url: string | null
  status: string
  created_at: string | number
  sent_at: string | number | null
}

function asEngagement(value: string | null | undefined): PromoEngagement {
  return value === 'clicked' ? 'clicked' : 'opened'
}

function asPromoStatus(value: string | null | undefined): PromoStatus {
  return value === 'sent' ? 'sent' : 'draft'
}

function mapPromoRow(r: RawPromoRow): PromoRecord {
  return {
    id: r.id,
    publicationId: asPublicationId(r.publication_id),
    subject: r.subject,
    previewText: r.preview_text,
    headline: r.headline,
    bodyMarkdown: r.body_markdown,
    ctaLabel: r.cta_label,
    ctaUrl: r.cta_url,
    brief: r.brief,
    windowIssues: r.window_issues,
    engagement: asEngagement(r.engagement),
    bodyHtml: r.body_html,
    bodyText: r.body_text,
    targetCount: r.target_count == null ? null : Number(r.target_count),
    broadcastId: r.broadcast_id,
    dashboardUrl: r.dashboard_url,
    status: asPromoStatus(r.status),
    createdAt: Number(r.created_at),
    sentAt: r.sent_at == null ? null : Number(r.sent_at)
  }
}

export async function createPromo(promo: PromoRecord): Promise<void> {
  await sql`
    INSERT INTO newsletter_promos
      (id, publication_id, subject, preview_text, headline, body_markdown,
       cta_label, cta_url, brief, window_issues, engagement,
       body_html, body_text, target_count, broadcast_id, dashboard_url,
       status, created_at, sent_at)
    VALUES
      (${promo.id}, ${promo.publicationId}, ${promo.subject}, ${promo.previewText},
       ${promo.headline}, ${promo.bodyMarkdown}, ${promo.ctaLabel}, ${promo.ctaUrl},
       ${promo.brief}, ${promo.windowIssues}, ${promo.engagement},
       ${promo.bodyHtml}, ${promo.bodyText}, ${promo.targetCount},
       ${promo.broadcastId}, ${promo.dashboardUrl}, ${promo.status},
       ${promo.createdAt}, ${promo.sentAt})
  `
}

export async function getPromo(id: string): Promise<PromoRecord | null> {
  const r = await sql`SELECT * FROM newsletter_promos WHERE id = ${id}`
  const row = r.rows[0] as RawPromoRow | undefined
  return row ? mapPromoRow(row) : null
}

export async function listPromos(
  publicationId?: PublicationId,
  limit = 50
): Promise<PromoRecord[]> {
  const r = publicationId
    ? await sql.query(
        'SELECT * FROM newsletter_promos WHERE publication_id = $1 ORDER BY created_at DESC LIMIT $2',
        [publicationId, limit]
      )
    : await sql.query(
        'SELECT * FROM newsletter_promos ORDER BY created_at DESC LIMIT $1',
        [limit]
      )
  return (r.rows as unknown as RawPromoRow[]).map(mapPromoRow)
}

export async function updatePromo(
  id: string,
  patch: PromoPatch
): Promise<void> {
  if (patch.subject !== undefined) {
    await sql`UPDATE newsletter_promos SET subject = ${patch.subject} WHERE id = ${id}`
  }
  if (patch.previewText !== undefined) {
    await sql`UPDATE newsletter_promos SET preview_text = ${patch.previewText} WHERE id = ${id}`
  }
  if (patch.headline !== undefined) {
    await sql`UPDATE newsletter_promos SET headline = ${patch.headline} WHERE id = ${id}`
  }
  if (patch.bodyMarkdown !== undefined) {
    await sql`UPDATE newsletter_promos SET body_markdown = ${patch.bodyMarkdown} WHERE id = ${id}`
  }
  if (patch.ctaLabel !== undefined) {
    await sql`UPDATE newsletter_promos SET cta_label = ${patch.ctaLabel} WHERE id = ${id}`
  }
  if (patch.ctaUrl !== undefined) {
    await sql`UPDATE newsletter_promos SET cta_url = ${patch.ctaUrl} WHERE id = ${id}`
  }
  if (patch.windowIssues !== undefined) {
    if (
      !Number.isInteger(patch.windowIssues) ||
      patch.windowIssues < 1 ||
      patch.windowIssues > 52
    ) {
      throw new Error('windowIssues must be an integer 1-52')
    }
    await sql`UPDATE newsletter_promos SET window_issues = ${patch.windowIssues} WHERE id = ${id}`
  }
  if (patch.engagement !== undefined) {
    await sql`UPDATE newsletter_promos SET engagement = ${patch.engagement} WHERE id = ${id}`
  }
}

export async function markPromoSent(
  id: string,
  fields: {
    broadcastId: string
    dashboardUrl: string
    bodyHtml: string
    bodyText: string
    targetCount: number
  }
): Promise<void> {
  await sql`
    UPDATE newsletter_promos
       SET status = 'sent',
           broadcast_id = ${fields.broadcastId},
           dashboard_url = ${fields.dashboardUrl},
           body_html = ${fields.bodyHtml},
           body_text = ${fields.bodyText},
           target_count = ${fields.targetCount},
           sent_at = ${Date.now()}
     WHERE id = ${id}
  `
}

export async function getPromoAudienceId(
  publicationId: PublicationId
): Promise<string | null> {
  const r =
    await sql`SELECT audience_id FROM newsletter_promo_audiences WHERE publication_id = ${publicationId}`
  const row = r.rows[0] as {audience_id: string} | undefined
  return row ? row.audience_id : null
}

export async function setPromoAudienceId(
  publicationId: PublicationId,
  audienceId: string
): Promise<void> {
  await sql`
    INSERT INTO newsletter_promo_audiences (publication_id, audience_id, updated_at)
    VALUES (${publicationId}, ${audienceId}, ${Date.now()})
    ON CONFLICT (publication_id) DO UPDATE
      SET audience_id = EXCLUDED.audience_id,
          updated_at = EXCLUDED.updated_at
  `
}

function extractDraft(row: SectionDraftRow): SectionDraft {
  return {
    emojiHeadline: row.emojiHeadline,
    bodyMarkdown: row.bodyMarkdown,
    soWhat: row.soWhat,
    linkUrl: row.linkUrl,
    linkText: row.linkText,
    isTactical: row.isTactical,
    imageUrl: row.imageUrl,
    referenceImageUrl: row.referenceImageUrl,
    selectionJson: row.selectionJson
  }
}
