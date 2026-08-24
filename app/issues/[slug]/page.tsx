import {notFound} from 'next/navigation'
import {ensureSchema, getIssue} from '@/journalist/runs-log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{slug: string}>
}

export default async function ArchivedIssue({
  params
}: PageProps): Promise<React.JSX.Element> {
  const {slug} = await params
  if (!/^[a-z0-9-]+$/.test(slug)) notFound()
  try {
    await ensureSchema()
    const issue = await getIssue(slug)
    if (!issue || issue.status !== 'sent' || !issue.bodyHtml) notFound()
    // biome-ignore lint/security/noDangerouslySetInnerHtml: server-composed trusted HTML from our own composer
    return <div dangerouslySetInnerHTML={{__html: issue.bodyHtml}} />
  } catch {
    notFound()
  }
}
