'use client'

import Link from 'next/link'
import {useCallback, useEffect, useState} from 'react'

import {Alert} from '@/components/ui/alert'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {PublicationSelect} from '@/components/ui/publication-select'
import {EmptyState} from '@/components/ui/panel'
import {
  Page,
  PageHeader,
  PageSection,
  PageTitle
} from '@/components/ui/app-shell'
import {H2, Muted} from '@/components/ui/typography'
import {callApi} from '@/lib/api-client'
import type {OperatorIssueDto as IssueRow} from '@/lib/dto'
import type {PublicationId} from '@/publications/types'
import {
  DEFAULT_PUBLICATION_ID,
  publicationDisplay,
  statusLabel
} from '@/publications/display'

const REFRESH_MS = 15000
const TRIGGERING_REFRESH_MS = 3000

export default function ConsolePage(): React.JSX.Element {
  const [issues, setIssues] = useState<IssueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState(false)
  const [triggerError, setTriggerError] = useState<string | null>(null)
  const [runPublication, setRunPublication] = useState<PublicationId>(
    DEFAULT_PUBLICATION_ID
  )

  const refresh = useCallback(async () => {
    const res = await callApi<IssueRow[]>('/api/newsletter/issues?limit=50')
    if (res.success) setIssues(res.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(
      refresh,
      triggering ? TRIGGERING_REFRESH_MS : REFRESH_MS
    )
    return () => clearInterval(interval)
  }, [refresh, triggering])

  const handleRun = useCallback(async () => {
    setTriggering(true)
    setTriggerError(null)
    const res = await callApi<{triggered: boolean}>('/api/newsletter/run', {
      method: 'POST',
      body: JSON.stringify({publicationId: runPublication})
    })
    if (!res.success) setTriggerError(res.error)
    await refresh()
    setTriggering(false)
  }, [refresh, runPublication])

  return (
    <Page className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col p-6">
      <PageHeader className="mb-6 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <PageTitle>Editorial console</PageTitle>
          <Muted className="text-xs">
            Generate drafts and review pending issues
          </Muted>
        </div>
        <div className="flex items-center gap-3">
          <PublicationSelect
            value={runPublication}
            onChange={setRunPublication}
            disabled={triggering}
          />
          <Button
            type="button"
            disabled={triggering}
            aria-busy={triggering}
            onClick={handleRun}>
            {triggering ? 'Drafting (~50s)…' : 'Generate now'}
          </Button>
        </div>
      </PageHeader>

      {triggerError ? (
        <PageSection className="mb-4">
          <Alert variant="destructive">{triggerError}</Alert>
        </PageSection>
      ) : null}

      <PageSection className="mb-6">
        <H2 className="mb-3">Recent issues</H2>
        {triggering ? (
          <Muted aria-live="polite" className="mb-3">
            Drafting your issue. It will appear here in under a minute.
          </Muted>
        ) : null}
        {loading ? (
          <Muted>Loading issues…</Muted>
        ) : issues.length === 0 ? (
          <EmptyState>
            No issues yet. Select Generate now to create the first one.
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-3">
            {issues.map(issue => (
              <IssueCard key={issue.slug} issue={issue} />
            ))}
          </div>
        )}
      </PageSection>
    </Page>
  )
}

function IssueCard({issue}: {issue: IssueRow}): React.JSX.Element {
  const publicationId = publicationDisplay(issue.publicationId)
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-muted-foreground">
            #{issue.issueNumber}
          </span>
          <Badge
            variant="muted"
            className="rounded-full text-[10px] uppercase tracking-wide">
            {publicationId.id}
          </Badge>
          <Badge
            variant={issue.status === 'sent' ? 'default' : 'muted'}
            className="rounded-full text-[10px] uppercase tracking-wide">
            {statusLabel(issue.status)}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {issue.itemCount} section{issue.itemCount === 1 ? '' : 's'}
          </span>
        </div>
        <div className="font-mono text-xs text-muted-foreground">
          {new Date(issue.createdAt).toLocaleString(publicationId.locale, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: publicationId.timeZone
          })}
        </div>
      </div>

      <div className="mt-3">
        <div className="text-base font-semibold text-foreground">
          {issue.subject}
        </div>
        {issue.intro ? (
          <p className="mt-1 text-sm text-muted-foreground">{issue.intro}</p>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        {issue.status === 'pending_review' ||
        issue.status === 'approved' ||
        issue.status === 'scheduled' ? (
          <Link
            href={`/editor/${issue.slug}`}
            className="font-semibold text-primary underline-offset-2 hover:underline">
            Open editor →
          </Link>
        ) : null}
        {issue.status === 'sent' ? (
          <a
            href={`/issues/${issue.slug}`}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline-offset-2 hover:underline">
            View issue →
          </a>
        ) : null}
        {issue.status === 'scheduled' && issue.scheduledAt ? (
          <span className="text-muted-foreground">
            Sends{' '}
            {new Date(issue.scheduledAt).toLocaleString(publicationId.locale, {
              weekday: 'long',
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
              timeZone: publicationId.timeZone
            })}
          </span>
        ) : null}
      </div>
    </div>
  )
}
