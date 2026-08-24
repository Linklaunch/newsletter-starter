import {createLogger} from '@lib/logger'
import type {Section} from './section-writer'
import type {
  Cta,
  FeedbackCopy,
  FooterCopy,
  PublicationBrand
} from '../publications/types'

const log = createLogger('Newsletter:Composer')

export interface ComposedIssue {
  subject: string
  previewText: string
  plaintext: string
  html: string
  slug: string
}

/**
 * Everything the composer needs from the active publicationId: brand strings (incl.
 * the wordmark/subtitle shown in the email header), locale + timezone for the
 * issue date, the two publication CTAs, and the rating-widget copy.
 */
export interface ComposeBrand extends PublicationBrand {
  locale: string
  timeZone: string
  ctas: {middle: Cta; end: Cta}
  feedbackCopy: FeedbackCopy
  footer: FooterCopy
}

export interface ComposeOptions {
  sections: Section[]
  issueIntro: string
  issueNumber: number
  slugOverride?: string
  issueDate?: Date
  brand: ComposeBrand
  archiveBaseUrl?: string
  unsubscribeUrl?: string
}

export const COLORS = {
  orange: '#E85118',
  orangeDeep: '#B93E12',
  warmWhite: '#FFFDF9',
  callout: '#FFF1E8',
  black: '#111111',
  textMuted: '#5C5C5C',
  ruleSoft: '#EBE6DD'
}

export function composeIssue(opts: ComposeOptions): ComposedIssue {
  const sections = opts.sections
  if (sections.length === 0) {
    throw new Error('composeIssue requires at least one section')
  }
  const brand = opts.brand
  const issueDate = opts.issueDate ?? new Date()
  const slug = opts.slugOverride ?? buildSlug(opts.issueNumber, issueDate)
  const archiveUrl = opts.archiveBaseUrl
    ? `${opts.archiveBaseUrl.replace(/\/$/, '')}/issues/${slug}`
    : ''
  const issueDateLabel = formatIssueDate(
    issueDate,
    brand.locale,
    brand.timeZone
  )

  const subject = buildSubject(opts.issueNumber, brand)
  const previewText = truncate(
    sections.map(s => s.emojiHeadline.trim()).join(' · '),
    140
  )

  const html = renderHtml({
    sections,
    issueIntro: opts.issueIntro,
    issueNumber: opts.issueNumber,
    issueDateLabel,
    brand,
    archiveUrl,
    unsubscribeUrl: opts.unsubscribeUrl ?? '',
    subject,
    previewText,
    slug
  })

  const plaintext = renderPlaintext({
    sections,
    issueIntro: opts.issueIntro,
    issueNumber: opts.issueNumber,
    issueDateLabel,
    brand,
    archiveUrl,
    unsubscribeUrl: opts.unsubscribeUrl ?? '',
    slug
  })

  log.info(
    `composed issue #${opts.issueNumber} (${slug})  -  ${sections.length} section(s), subject: "${subject}"`
  )

  return {subject, previewText, plaintext, html, slug}
}

function buildSubject(issueNumber: number, brand: ComposeBrand): string {
  return `${brand.newsletter} · Issue #${issueNumber}`
}

function buildSlug(issueNumber: number, date: Date): string {
  const yyyy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  return `publication-${yyyy}-${mm}-${dd}-issue-${String(issueNumber).padStart(3, '0')}`
}

function formatIssueDate(date: Date, locale: string, timeZone: string): string {
  return date.toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone
  })
}

function truncate(s: string, max: number): string {
  const trimmed = s.trim().replace(/\s+/g, ' ')
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1).trimEnd()}…`
}

export function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function markdownToHtml(md: string): string {
  const blocks = md.replace(/\r\n/g, '\n').split(/\n{2,}/)
  const out: string[] = []
  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)
    if (lines.length === 0) continue
    if (lines.every(l => /^\d+\.\s+/.test(l))) {
      const items = lines
        .map(l => l.replace(/^\d+\.\s+/, ''))
        .map(l => `<li style="margin-bottom:10px;">${inline(l)}</li>`)
        .join('')
      out.push(
        `<ol style="margin:0 0 16px 0;padding-left:24px;font-family:'Outfit',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:16px;line-height:26px;color:${COLORS.black};">${items}</ol>`
      )
      continue
    }
    out.push(
      `<p style="margin:0 0 16px 0;font-family:'Outfit',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:16px;line-height:26px;color:${COLORS.black};">${inline(lines.join(' '))}</p>`
    )
  }
  return out.join('\n')
}

function inline(s: string): string {
  let out = escapeHtml(s)
  out = out.replace(
    /\*\*(.+?)\*\*/g,
    '<strong style="font-weight:700;color:#111111;">$1</strong>'
  )
  out = out.replace(
    /\[([^\]]+)\]\((https?:[^)]+)\)/g,
    `<a href="$2" style="color:${COLORS.orange};text-decoration:underline;">$1</a>`
  )
  return out
}

function plaintextFromMarkdown(md: string): string {
  return md
    .replace(/\r\n/g, '\n')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\(https?:[^)]+\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

interface RenderHtmlInput {
  sections: Section[]
  issueIntro: string
  issueNumber: number
  issueDateLabel: string
  brand: ComposeBrand
  archiveUrl: string
  unsubscribeUrl: string
  subject: string
  previewText: string
  slug: string
}

function renderHtml(input: RenderHtmlInput): string {
  const {
    sections,
    issueIntro,
    issueNumber,
    issueDateLabel,
    brand,
    archiveUrl,
    unsubscribeUrl,
    subject,
    previewText,
    slug
  } = input

  const midpoint = Math.max(1, Math.floor(sections.length / 2))
  const sectionsHtml = sections
    .map((s, i) => {
      const block = renderSectionHtml(s, i === 0, brand.footer)
      if (i === midpoint - 1 && sections.length > 2) {
        return `${block}\n${renderCtaHtml(brand.ctas.middle)}`
      }
      return block
    })
    .join('\n')

  const archiveLink = archiveUrl
    ? `<a href="${escapeHtml(archiveUrl)}" style="color:${COLORS.textMuted};text-decoration:underline;">${escapeHtml(brand.footer.archiveLinkText)}</a>`
    : ''

  // Resend's broadcast send replaces this token with each recipient's
  // per-contact unsubscribe URL. Wrap the token in an <a> so the link is
  // clickable instead of dropping a bare URL into the footer.
  const unsubHref = unsubscribeUrl
    ? escapeHtml(unsubscribeUrl)
    : '{{{RESEND_UNSUBSCRIBE_URL}}}'
  const unsubLink = `<a href="${unsubHref}" style="color:${COLORS.textMuted};text-decoration:underline;">${escapeHtml(brand.footer.unsubscribeLinkText)}</a>`

  return `<!doctype html>
<html lang="${escapeHtml(brand.locale)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(subject)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
<style>
  body { margin:0; padding:0; background:${COLORS.warmWhite}; }
  a { color:${COLORS.orange}; }
  @media (max-width: 620px) {
    .wrap { width:100% !important; padding:0 16px !important; }
    .wordmark { font-size:32px !important; letter-spacing:-1.4px !important; }
    .section h2 { font-size:22px !important; line-height:28px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${COLORS.warmWhite};-webkit-text-size-adjust:100%;">
<div style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;font-size:1px;line-height:1px;max-height:0;max-width:0;">
${escapeHtml(previewText)}
</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${COLORS.warmWhite};">
  <tr><td align="center" style="padding:48px 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="wrap" style="width:600px;max-width:600px;background:${COLORS.warmWhite};">

      <tr><td style="padding:0 0 32px 0;border-bottom:2px solid ${COLORS.black};">
        <div class="wordmark" style="font-family:'Outfit',-apple-system,sans-serif;font-weight:800;font-size:38px;line-height:1;letter-spacing:-1.6px;color:${COLORS.black};">
          ${escapeHtml(brand.wordmark)}<span style="color:${COLORS.orange};">.</span>
        </div>
        <div style="margin-top:6px;font-family:'Outfit',-apple-system,sans-serif;font-weight:700;font-size:18px;letter-spacing:-0.5px;color:${COLORS.black};">
          ${escapeHtml(brand.subtitle)}
        </div>
        <div style="margin-top:14px;font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:500;font-size:11px;letter-spacing:0.6px;text-transform:uppercase;color:${COLORS.textMuted};">
          Issue #${issueNumber} · ${escapeHtml(issueDateLabel)}
        </div>
      </td></tr>

      ${
        issueIntro
          ? `<tr><td style="padding:32px 0 8px 0;font-family:'Outfit',-apple-system,sans-serif;font-size:18px;line-height:28px;color:${COLORS.black};">
        ${escapeHtml(issueIntro)}
      </td></tr>`
          : ''
      }

      ${sectionsHtml}

      ${renderCtaHtml(brand.ctas.end)}

      ${renderRatingHtml(archiveUrl, slug, brand.feedbackCopy)}

      <tr><td style="padding:48px 0 24px 0;border-top:2px solid ${COLORS.black};">
        <div style="font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:700;font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:${COLORS.black};">
          Published by ${escapeHtml(brand.parent)}
        </div>
        <p style="margin:12px 0 0 0;font-family:'Outfit',-apple-system,sans-serif;font-size:14px;line-height:22px;color:${COLORS.textMuted};">
          ${escapeHtml(brand.parent)} ${escapeHtml(brand.footer.blurb)} <a href="https://${escapeHtml(brand.site)}" style="color:${COLORS.textMuted};">${escapeHtml(brand.site)}</a>.
        </p>
        <p style="margin:28px 0 0 0;font-family:'Outfit',-apple-system,sans-serif;font-size:13px;line-height:20px;color:${COLORS.textMuted};">
          ${escapeHtml(brand.footer.subscribedLine)} ${escapeHtml(brand.newsletter)} at <a href="https://${escapeHtml(brand.site)}" style="color:${COLORS.textMuted};">${escapeHtml(brand.site)}</a>. ${escapeHtml(brand.footer.unsubscribePrefix)} ${unsubLink} ${escapeHtml(brand.footer.unsubscribeTrailer)}
        </p>
        ${archiveLink ? `<p style="margin:14px 0 0 0;font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:18px;color:${COLORS.textMuted};">${archiveLink}</p>` : ''}
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`
}

function renderCtaHtml(cta: Cta): string {
  return `<tr><td style="padding:32px 0;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${COLORS.orange};">
    <tr><td style="padding:36px 28px;text-align:center;">
      <div style="font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:700;font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:${COLORS.warmWhite};opacity:0.85;">
        ${escapeHtml(cta.eyebrow)}
      </div>
      <div style="margin-top:14px;font-family:'Outfit',-apple-system,sans-serif;font-weight:700;font-size:26px;line-height:32px;letter-spacing:-0.6px;color:${COLORS.warmWhite};">
        ${escapeHtml(cta.headline)}
      </div>
      <p style="margin:14px auto 24px auto;max-width:440px;font-family:'Outfit',-apple-system,sans-serif;font-size:15px;line-height:22px;color:${COLORS.warmWhite};opacity:0.92;">
        ${escapeHtml(cta.body)}
      </p>
      <a href="${escapeHtml(cta.url)}" style="display:inline-block;background:${COLORS.warmWhite};color:${COLORS.black};padding:14px 32px;margin:6px 5px 0 5px;font-family:'Outfit',-apple-system,sans-serif;font-weight:700;font-size:14px;letter-spacing:0.4px;text-decoration:none;">${escapeHtml(cta.buttonText)}</a>
    </td></tr>
  </table>
</td></tr>`
}

function renderRatingHtml(
  archiveUrl: string,
  slug: string,
  copy: FeedbackCopy
): string {
  const baseUrl = feedbackBaseUrl(archiveUrl)
  const options = [
    {rating: 1, emoji: '🔥', label: copy.options.fire},
    {rating: 2, emoji: '🙂', label: copy.options.smile},
    {rating: 3, emoji: '😴', label: copy.options.sleep}
  ]
  const cells = options
    .map(option => {
      const url = `${baseUrl}/api/newsletter/feedback?slug=${encodeURIComponent(slug)}&rating=${option.rating}`
      return `<td align="center" width="33.33%" style="padding:0 5px;">
        <a href="${escapeHtml(url)}" style="display:block;padding:14px 8px;background:${COLORS.warmWhite};border:1px solid ${COLORS.ruleSoft};text-decoration:none;color:${COLORS.black};">
          <span style="display:block;font-size:32px;line-height:40px;">${option.emoji}</span>
          <span style="display:block;margin-top:6px;font-family:'Outfit',-apple-system,sans-serif;font-weight:700;font-size:12px;line-height:16px;color:${COLORS.black};">${escapeHtml(option.label)}</span>
        </a>
      </td>`
    })
    .join('')
  return `<tr><td style="padding:18px 0 42px 0;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${COLORS.callout};border-left:4px solid ${COLORS.orange};">
    <tr><td style="padding:24px 22px;text-align:center;">
      <div style="font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:700;font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:${COLORS.orange};">
        ${escapeHtml(copy.prompt)}
      </div>
      <p style="margin:8px 0 18px 0;font-family:'Outfit',-apple-system,sans-serif;font-size:14px;line-height:20px;color:${COLORS.textMuted};">
        ${escapeHtml(copy.hint)}
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>${cells}</tr></table>
    </td></tr>
  </table>
</td></tr>`
}

function renderRatingPlaintext(
  archiveUrl: string,
  slug: string,
  copy: FeedbackCopy
): string {
  const baseUrl = feedbackBaseUrl(archiveUrl)
  return [
    '',
    copy.prompt,
    `🔥 ${copy.options.fire}: ${baseUrl}/api/newsletter/feedback?slug=${encodeURIComponent(slug)}&rating=1`,
    `🙂 ${copy.options.smile}: ${baseUrl}/api/newsletter/feedback?slug=${encodeURIComponent(slug)}&rating=2`,
    `😴 ${copy.options.sleep}: ${baseUrl}/api/newsletter/feedback?slug=${encodeURIComponent(slug)}&rating=3`,
    ''
  ].join('\n')
}

function feedbackBaseUrl(archiveUrl: string): string {
  if (!archiveUrl) return ''
  try {
    const u = new URL(archiveUrl)
    return `${u.protocol}//${u.host}`
  } catch {
    return archiveUrl.replace(/\/issues\/.*$/, '').replace(/\/$/, '')
  }
}

function renderCtaPlaintext(cta: Cta): string {
  return [
    '',
    '━'.repeat(60),
    '',
    `  ${cta.eyebrow.toUpperCase()}`,
    '',
    `  ${cta.headline}`,
    '',
    `  ${cta.body}`,
    '',
    `  → ${cta.buttonText}: ${cta.url}`,
    '',
    '━'.repeat(60),
    ''
  ].join('\n')
}

function renderSectionHtml(
  section: Section,
  isFirst: boolean,
  footer: FooterCopy
): string {
  const bodyHtml = markdownToHtml(section.bodyMarkdown)
  const imageHtml = section.imageUrl
    ? `<a href="${escapeHtml(section.linkUrl)}" style="display:block;margin:0 0 20px 0;text-decoration:none;">
      <img src="${escapeHtml(section.imageUrl)}" width="600" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;" />
    </a>`
    : ''
  const tacticalBadge = section.isTactical
    ? `<div style="display:inline-block;margin-bottom:12px;padding:4px 10px;background:${COLORS.black};color:${COLORS.warmWhite};font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:700;font-size:10px;letter-spacing:1.2px;text-transform:uppercase;">${escapeHtml(footer.tacticalBadge)}</div>`
    : ''
  const topBorder = isFirst ? '' : `border-top:1px solid ${COLORS.ruleSoft};`
  return `<tr><td class="section" style="padding:40px 0 32px 0;${topBorder}">
  ${tacticalBadge}
  <h2 style="margin:0 0 16px 0;font-family:'Outfit',-apple-system,sans-serif;font-weight:700;font-size:28px;line-height:32px;letter-spacing:-0.6px;color:${COLORS.black};">
    ${escapeHtml(section.emojiHeadline)}
  </h2>
  ${imageHtml}
  ${bodyHtml}
  <div style="margin:20px 0 0 0;padding:18px 20px;background:${COLORS.callout};border-left:4px solid ${COLORS.orange};">
    <div style="font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:700;font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:${COLORS.orange};">
      ${escapeHtml(footer.soWhatEyebrow)}
    </div>
    <p style="margin:8px 0 0 0;font-family:'Outfit',-apple-system,sans-serif;font-size:16px;line-height:25px;color:${COLORS.black};">
      ${escapeHtml(section.soWhat)}
    </p>
  </div>
  <p style="margin:20px 0 0 0;font-family:'Outfit',-apple-system,sans-serif;font-size:14px;line-height:22px;">
    <a href="${escapeHtml(section.linkUrl)}" style="color:${COLORS.orange};text-decoration:none;font-weight:600;">
      ${escapeHtml(section.linkText)} →
    </a>
  </p>
</td></tr>`
}

interface RenderPlaintextInput {
  sections: Section[]
  issueIntro: string
  issueNumber: number
  issueDateLabel: string
  brand: ComposeBrand
  archiveUrl: string
  unsubscribeUrl: string
  slug: string
}

function renderPlaintext(input: RenderPlaintextInput): string {
  const {
    sections,
    issueIntro,
    issueNumber,
    issueDateLabel,
    brand,
    archiveUrl,
    unsubscribeUrl,
    slug
  } = input
  const lines: string[] = []
  lines.push(`${brand.wordmark.toUpperCase()} ${brand.subtitle.toUpperCase()}`)
  lines.push(`Issue #${issueNumber} · ${issueDateLabel}`)
  lines.push('━'.repeat(60))
  lines.push('')
  if (issueIntro) {
    lines.push(issueIntro)
    lines.push('')
  }
  const tacticalLabel = `[ ${brand.footer.tacticalBadge.toUpperCase()} ]`
  const soWhatLabel = brand.footer.soWhatEyebrow.toUpperCase()
  const midpoint = Math.max(1, Math.floor(sections.length / 2))
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i]!
    if (s.isTactical) lines.push(tacticalLabel)
    lines.push(s.emojiHeadline.toUpperCase())
    lines.push('─'.repeat(60))
    lines.push(plaintextFromMarkdown(s.bodyMarkdown))
    lines.push('')
    lines.push(soWhatLabel)
    lines.push(s.soWhat)
    lines.push('')
    lines.push(`${s.linkText}: ${s.linkUrl}`)
    lines.push('')
    lines.push('')
    if (i === midpoint - 1 && sections.length > 2) {
      lines.push(renderCtaPlaintext(brand.ctas.middle))
    }
  }
  lines.push(renderCtaPlaintext(brand.ctas.end))
  lines.push(renderRatingPlaintext(archiveUrl, slug, brand.feedbackCopy))
  lines.push('━'.repeat(60))
  lines.push(`Published by ${brand.parent} · ${brand.site}`)
  lines.push('')
  lines.push(
    `${brand.footer.subscribedLine} ${brand.newsletter} at ${brand.site}.`
  )
  lines.push(
    `${brand.footer.unsubscribePrefix} ${brand.footer.unsubscribeLinkText}:`
  )
  lines.push(unsubscribeUrl ?? '{{{RESEND_UNSUBSCRIBE_URL}}}')
  if (archiveUrl) {
    lines.push('')
    lines.push(`Archive: ${archiveUrl}`)
  }
  return lines.join('\n')
}
