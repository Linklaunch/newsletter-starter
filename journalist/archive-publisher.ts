import type {IssueRow} from './runs-log'
import {getPublication} from '../publications'

const COLORS = {
  orange: '#E85118',
  warmWhite: '#FFFDF9',
  black: '#111111',
  textMuted: '#5C5C5C',
  ruleSoft: '#EBE6DD'
}

export function renderArchiveIndexHtml(issues: IssueRow[]): string {
  const rows = issues
    .map(issue => {
      const publication = getPublication(issue.publicationId)
      const dateLabel = new Date(issue.createdAt).toLocaleDateString(
        publication.locale,
        {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          timeZone: publication.timeZone
        }
      )
      const badge = `<span style="font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${COLORS.orange};margin-right:8px;">${escapeHtml(publication.id)}</span>`
      return `<li style="display:flex;align-items:baseline;justify-content:space-between;gap:16px;padding:18px 0;border-bottom:1px solid ${COLORS.ruleSoft};">
  <a href="/issues/${escapeHtml(issue.slug)}" style="flex:1;min-width:0;color:${COLORS.black};text-decoration:none;font-family:'Outfit',-apple-system,sans-serif;font-weight:600;font-size:18px;line-height:24px;">
    ${badge}${escapeHtml(issue.subject)}
  </a>
  <span style="font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:${COLORS.textMuted};white-space:nowrap;">
    ${escapeHtml(dateLabel)}
  </span>
</li>`
    })
    .join('\n')

  const empty =
    issues.length === 0
      ? `<p style="font-family:'Outfit',-apple-system,sans-serif;color:${COLORS.textMuted};">No published issues yet.</p>`
      : ''

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Newsletter Starter Archive</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
<style>body{margin:0;background:${COLORS.warmWhite};}</style>
</head>
<body style="margin:0;background:${COLORS.warmWhite};">
<main style="max-width:680px;margin:0 auto;padding:64px 24px;">
  <div style="font-family:'Outfit',sans-serif;font-weight:800;font-size:38px;line-height:1;letter-spacing:-1.6px;color:${COLORS.black};">
    Newsletter<span style="color:${COLORS.orange};">.</span>
  </div>
  <div style="margin-top:6px;font-family:'Outfit',sans-serif;font-weight:700;font-size:18px;letter-spacing:-0.5px;color:${COLORS.black};">
    Starter Archive
  </div>
  <p style="margin:24px 0 48px 0;font-family:'Outfit',sans-serif;font-size:16px;line-height:25px;color:${COLORS.textMuted};max-width:520px;">
    Published issues from configured newsletter publications.
  </p>
  ${empty}
  <ul style="margin:0;padding:0;list-style:none;">
${rows}
  </ul>
</main>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
