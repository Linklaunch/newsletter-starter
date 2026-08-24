'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useCallback, useEffect, useState} from 'react'

import {Alert} from '@/components/ui/alert'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {PublicationSelect} from '@/components/ui/publication-select'
import {EmptyState, Panel} from '@/components/ui/panel'
import {Textarea} from '@/components/ui/textarea'
import {
  Page,
  PageHeader,
  PageSection,
  PageTitle
} from '@/components/ui/app-shell'
import {H2, Muted} from '@/components/ui/typography'
import {callApi} from '@/lib/api-client'
import type {PublicationId} from '@/publications/types'
import {
  DEFAULT_PUBLICATION_ID,
  publicationDisplay,
  statusLabel
} from '@/publications/display'

type Engagement = 'opened' | 'clicked'

interface PromoRow {
  id: string
  publicationId: PublicationId
  subject: string
  headline: string
  status: 'draft' | 'sent'
  windowIssues: number
  engagement: Engagement
  targetCount: number | null
  createdAt: number
  sentAt: number | null
}

interface AudiencePreview {
  reach: number
  excludedUnsub: number
  scannedBroadcasts: number
  engagedInWindow: number
  windowIssues: number
  engagement: Engagement
  windowBroadcasts: Array<{name: string | null; sentAt: number | null}>
}

export function PromotionsPage(): React.JSX.Element {
  const router = useRouter()
  const [promos, setPromotions] = useState<PromoRow[]>([])
  const [publicationId, setPublication] = useState<PublicationId>(
    DEFAULT_PUBLICATION_ID
  )
  const [windowIssues, setWindowIssues] = useState(4)
  const [engagement, setEngagement] = useState<Engagement>('opened')
  const [brief, setBrief] = useState('')

  const [preview, setPreview] = useState<AudiencePreview | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const res = await callApi<PromoRow[]>('/api/newsletter/promos')
    if (res.success) setPromotions(res.data)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // A change to targeting invalidates the previously computed reach. The deps
  // are the trigger, not values read inside  -  biome wants them removed, but
  // without them a stale reach would survive a publicationId/window/engagement change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: deps are the reset trigger
  useEffect(() => {
    setPreview(null)
  }, [publicationId, windowIssues, engagement])

  const handlePreview = useCallback(async () => {
    setPreviewing(true)
    setError(null)
    const res = await callApi<AudiencePreview>(
      '/api/newsletter/promos/preview-audience',
      {
        method: 'POST',
        body: JSON.stringify({publicationId, windowIssues, engagement})
      }
    )
    if (res.success) setPreview(res.data)
    else setError(res.error)
    setPreviewing(false)
  }, [publicationId, windowIssues, engagement])

  const handleDraft = useCallback(async () => {
    if (brief.trim().length === 0) {
      setError('Write a brief for the email.')
      return
    }
    setDrafting(true)
    setError(null)
    const res = await callApi<PromoRow>('/api/newsletter/promos/draft', {
      method: 'POST',
      body: JSON.stringify({publicationId, brief, windowIssues, engagement})
    })
    if (res.success) {
      router.push(`/promos/${res.data.id}`)
      return
    }
    setError(res.error)
    setDrafting(false)
  }, [brief, publicationId, windowIssues, engagement, router])

  return (
    <Page className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col p-6">
      <PageHeader className="mb-6 flex shrink-0 flex-col gap-1">
        <PageTitle>Promotions</PageTitle>
        <Muted className="text-xs">
          Send a promotional email to readers who engage with your newsletter
        </Muted>
      </PageHeader>

      {error ? (
        <PageSection className="mb-4">
          <Alert variant="destructive">{error}</Alert>
        </PageSection>
      ) : null}

      <PageSection className="mb-8">
        <H2 className="mb-3">New promotion</H2>
        <Panel>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="promo-publicationId">Publication</Label>
              <PublicationSelect
                value={publicationId}
                onChange={setPublication}
                className="px-2 py-2"
                aria-label="Publication"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="promo-window">Recent issues to include</Label>
              <Input
                id="promo-window"
                type="number"
                min={1}
                max={52}
                value={windowIssues}
                onChange={e =>
                  setWindowIssues(Math.max(1, Number(e.target.value) || 1))
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="promo-engagement">Minimum engagement</Label>
              <select
                id="promo-engagement"
                value={engagement}
                onChange={e => setEngagement(e.target.value as Engagement)}
                className="rounded-md border border-border bg-background px-2 py-2 text-sm">
                <option value="opened">Opened (includes clicks)</option>
                <option value="clicked">Clicked</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={previewing}
              onClick={handlePreview}>
              {previewing ? 'Calculating…' : 'Preview reach'}
            </Button>
            {preview ? (
              <span className="text-sm text-foreground">
                <strong>{preview.reach}</strong> contact
                {preview.reach === 1 ? '' : 's'} engaged reader
                {preview.reach === 1 ? '' : 's'} across the latest{' '}
                {preview.scannedBroadcasts} issues
                {preview.excludedUnsub > 0 ? (
                  <span className="text-muted-foreground">
                    {' '}
                    · {preview.excludedUnsub} unsubscribed contacts excluded
                  </span>
                ) : null}
              </span>
            ) : (
              <Muted className="text-xs">
                Reach is calculated from current Resend engagement data.
              </Muted>
            )}
          </div>

          <div className="mt-5 flex flex-col gap-1.5">
            <Label htmlFor="promo-brief">Email brief</Label>
            <Textarea
              id="promo-brief"
              rows={4}
              placeholder="Example: Invite readers to a live workshop where they can practice a new feedback method. Link: https://example.com/workshop"
              value={brief}
              onChange={e => setBrief(e.target.value)}
            />
            <Muted className="text-xs">
              The model drafts copy in the publication voice. You can edit it
              afterward.
            </Muted>
          </div>

          <div className="mt-4">
            <Button type="button" disabled={drafting} onClick={handleDraft}>
              {drafting ? 'Drafting (~15s)…' : 'Draft promotion →'}
            </Button>
          </div>
        </Panel>
      </PageSection>

      <PageSection className="mb-6">
        <H2 className="mb-3">Recent promotions</H2>
        {promos.length === 0 ? (
          <EmptyState>
            No promotions yet. Create the first one above.
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-3">
            {promos.map(p => (
              <PromoCard key={p.id} promo={p} />
            ))}
          </div>
        )}
      </PageSection>
    </Page>
  )
}

function PromoCard({promo}: {promo: PromoRow}): React.JSX.Element {
  const publicationId = publicationDisplay(promo.publicationId)
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Badge
            variant="muted"
            className="rounded-full text-[10px] uppercase tracking-wide">
            {publicationId.id}
          </Badge>
          <Badge
            variant={promo.status === 'sent' ? 'default' : 'muted'}
            className="rounded-full text-[10px] uppercase tracking-wide">
            {statusLabel(promo.status)}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {promo.engagement === 'clicked' ? 'clicks' : 'opens'} · latest{' '}
            {promo.windowIssues}
          </span>
          {promo.targetCount != null ? (
            <span className="text-xs text-muted-foreground">
              → {promo.targetCount} recipients
            </span>
          ) : null}
        </div>
        <div className="font-mono text-xs text-muted-foreground">
          {new Date(promo.createdAt).toLocaleString(publicationId.locale, {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: publicationId.timeZone
          })}
        </div>
      </div>

      <div className="mt-3">
        <div className="text-base font-semibold text-foreground">
          {promo.subject}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{promo.headline}</p>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        {promo.status === 'draft' ? (
          <Link
            href={`/promos/${promo.id}`}
            className="font-semibold text-primary underline-offset-2 hover:underline">
            Open editor →
          </Link>
        ) : null}
      </div>
    </div>
  )
}
