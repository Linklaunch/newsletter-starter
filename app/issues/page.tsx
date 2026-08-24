import {ensureSchema, listIssues} from '@/journalist/runs-log'
import {renderArchiveIndexHtml} from '@/journalist/archive-publisher'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function IssuesArchive(): Promise<React.JSX.Element> {
  await ensureSchema()
  const issues = await listIssues(undefined, 200)
  // Reuse the same brand-tight HTML the email composer ships  -  render it as
  // dangerouslySetInnerHTML on a barebones body so the styles are inline and
  // don't conflict with the operator console's Tailwind layer.
  const html = renderArchiveIndexHtml(issues)
  // biome-ignore lint/security/noDangerouslySetInnerHtml: server-composed trusted HTML from our own composer
  return <div dangerouslySetInnerHTML={{__html: html}} />
}
