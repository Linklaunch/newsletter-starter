import {createLogger} from '@lib/logger'
import {COLORS, escapeHtml, markdownToHtml} from './issue-composer'
import type {FooterCopy, PublicationBrand} from '../publications/types'

const log = createLogger('Newsletter:PromoComposer')

/** Everything the promo composer needs from the active publicationId. */
export interface PromoComposeBrand extends PublicationBrand {
  locale: string
  footer: FooterCopy
}

export interface ComposePromoOptions {
  subject: string
  previewText: string
  headline: string
  bodyMarkdown: string
  ctaLabel: string
  ctaUrl: string
  brand: PromoComposeBrand
  /** Optional per-recipient unsubscribe URL; defaults to Resend's managed token. */
  unsubscribeUrl?: string
}

export interface ComposedPromo {
  subject: string
  previewText: string
  html: string
  plaintext: string
}

export function composePromo(opts: ComposePromoOptions): ComposedPromo {
  const html = renderHtml(opts)
  const plaintext = renderPlaintext(opts)
  log.info(
    `composed promo  -  subject: "${opts.subject}", CTA: "${opts.ctaLabel}"`
  )
  return {subject: opts.subject, previewText: opts.previewText, html, plaintext}
}

function renderHtml(opts: ComposePromoOptions): string {
  const {
    subject,
    previewText,
    headline,
    bodyMarkdown,
    ctaLabel,
    ctaUrl,
    brand
  } = opts
  const bodyHtml = markdownToHtml(bodyMarkdown)

  const unsubHref = opts.unsubscribeUrl
    ? escapeHtml(opts.unsubscribeUrl)
    : '{{{RESEND_UNSUBSCRIBE_URL}}}'
  const unsubLink = `<a href="${unsubHref}" style="color:${COLORS.textMuted};text-decoration:underline;">${escapeHtml(brand.footer.unsubscribeLinkText)}</a>`

  const ctaButton = ctaUrl
    ? `<a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:${COLORS.orange};color:${COLORS.white};padding:16px 40px;font-family:'Open Sans',-apple-system,sans-serif;font-weight:700;font-size:15px;letter-spacing:0.4px;text-decoration:none;">${escapeHtml(ctaLabel)}</a>`
    : ''

  return `<!doctype html>
<html lang="${escapeHtml(brand.locale)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(subject)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
<style>
  body { margin:0; padding:0; background:${COLORS.bg}; }
  a { color:${COLORS.blue}; }
  @media (max-width: 620px) {
    .wrap { width:100% !important; padding:0 16px !important; }
    .wordmark { font-size:32px !important; letter-spacing:-1.4px !important; }
    .promo-headline { font-size:28px !important; line-height:34px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${COLORS.bg};-webkit-text-size-adjust:100%;">
<div style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;font-size:1px;line-height:1px;max-height:0;max-width:0;">
${escapeHtml(previewText)}
</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${COLORS.bg};">
  <tr><td align="center" style="padding:48px 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="wrap" style="width:600px;max-width:600px;background:${COLORS.bg};">

      <tr><td style="padding:0 0 32px 0;border-bottom:1px solid ${COLORS.ruleSoft};">
        <div class="wordmark" style="font-family:'Open Sans',-apple-system,sans-serif;font-weight:800;font-size:38px;line-height:1;letter-spacing:-1.6px;color:${COLORS.white};">
          ${escapeHtml(brand.wordmark)}<span style="color:${COLORS.orange};">.</span>
        </div>
        <div style="margin-top:6px;font-family:'Open Sans',-apple-system,sans-serif;font-weight:700;font-size:18px;letter-spacing:-0.5px;color:${COLORS.textMuted};">
          ${escapeHtml(brand.subtitle)}
        </div>
      </td></tr>

      <tr><td style="padding:40px 0 8px 0;">
        <h1 class="promo-headline" style="margin:0 0 20px 0;font-family:'Open Sans',-apple-system,sans-serif;font-weight:800;font-size:34px;line-height:40px;letter-spacing:-0.8px;color:${COLORS.white};">
          ${escapeHtml(headline)}
        </h1>
        ${bodyHtml}
      </td></tr>

      <tr><td style="padding:24px 0 8px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${COLORS.blue};">
          <tr><td style="padding:40px 28px;text-align:center;">
            ${ctaButton}
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:48px 0 24px 0;border-top:1px solid ${COLORS.ruleSoft};">
        <div style="font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:700;font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:${COLORS.white};">
          Published by ${escapeHtml(brand.parent)}
        </div>
        <p style="margin:12px 0 0 0;font-family:'Open Sans',-apple-system,sans-serif;font-size:14px;line-height:22px;color:${COLORS.textMuted};">
          ${escapeHtml(brand.parent)} ${escapeHtml(brand.footer.blurb)} <a href="https://${escapeHtml(brand.site)}" style="color:${COLORS.textMuted};">${escapeHtml(brand.site)}</a>.
        </p>
        <p style="margin:28px 0 0 0;font-family:'Open Sans',-apple-system,sans-serif;font-size:13px;line-height:20px;color:${COLORS.textMuted};">
          ${escapeHtml(brand.footer.subscribedLine)} ${escapeHtml(brand.newsletter)} at <a href="https://${escapeHtml(brand.site)}" style="color:${COLORS.textMuted};">${escapeHtml(brand.site)}</a>. ${escapeHtml(brand.footer.unsubscribePrefix)} ${unsubLink} ${escapeHtml(brand.footer.unsubscribeTrailer)}
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`
}

function plaintextFromMarkdown(md: string): string {
  return md
    .replace(/\r\n/g, '\n')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\(https?:[^)]+\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function renderPlaintext(opts: ComposePromoOptions): string {
  const {headline, bodyMarkdown, ctaLabel, ctaUrl, brand} = opts
  const lines: string[] = []
  lines.push(`${brand.wordmark.toUpperCase()} ${brand.subtitle.toUpperCase()}`)
  lines.push('━'.repeat(60))
  lines.push('')
  lines.push(headline)
  lines.push('')
  lines.push(plaintextFromMarkdown(bodyMarkdown))
  lines.push('')
  if (ctaUrl) {
    lines.push(`${ctaLabel}: ${ctaUrl}`)
    lines.push('')
  }
  lines.push('━'.repeat(60))
  lines.push(`Published by ${brand.parent} · ${brand.site}`)
  lines.push('')
  lines.push(
    `${brand.footer.subscribedLine} ${brand.newsletter} at ${brand.site}.`
  )
  lines.push(
    `${brand.footer.unsubscribePrefix} ${brand.footer.unsubscribeLinkText}:`
  )
  lines.push(opts.unsubscribeUrl ?? '{{{RESEND_UNSUBSCRIBE_URL}}}')
  return lines.join('\n')
}
