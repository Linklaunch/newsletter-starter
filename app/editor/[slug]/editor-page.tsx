'use client'

import Link from 'next/link'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'

import {Alert} from '@/components/ui/alert'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Page, PageHeader, PageSection} from '@/components/ui/app-shell'
import {H2, Muted} from '@/components/ui/typography'
import {callApi} from '@/lib/api-client'
import type {OperatorIssueDto as IssueRow, SectionDraftDto} from '@/lib/dto'
import {nextScheduledSendUtc} from '@/lib/schedule'
import {publicationDisplay, statusLabel} from '@/publications/display'
import type {PublicationId} from '@/publications/types'

interface IssueDetail {
  issue: IssueRow
  sections: SectionDraftDto[]
}

interface SettingsDto {
  draftDayUtc: number
  draftHourUtc: number
  sendDayUtc: number
  sendHourUtc: number
  updatedAt: number
}

export function EditorPage({slug}: {slug: string}): React.JSX.Element {
  const [detail, setDetail] = useState<IssueDetail | null>(null)
  const [settings, setSettings] = useState<SettingsDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [previewBust, setPreviewBust] = useState(0)
  const [approvalBusy, setApprovalBusy] = useState<
    null | 'approving' | 'cancelling'
  >(null)
  const [confirmingApproval, setConfirmingApproval] = useState(false)

  const refresh = useCallback(async () => {
    const res = await callApi<IssueDetail>(`/api/newsletter/issues/${slug}`)
    if (!res.success) {
      setError(res.error)
      setDetail(null)
      return
    }
    setDetail(res.data)
    setError(null)
    // Settings are publication-specific, so the send label follows this issue's schedule.
    const sRes = await callApi<SettingsDto>(
      `/api/newsletter/settings?publicationId=${res.data.issue.publicationId}`
    )
    if (sRes.success) setSettings(sRes.data)
  }, [slug])

  useEffect(() => {
    setLoading(true)
    refresh().finally(() => setLoading(false))
  }, [refresh])

  const onSectionsUpdate = useCallback((sections: SectionDraftDto[]) => {
    setDetail(prev => (prev ? {...prev, sections} : prev))
    setPreviewBust(b => b + 1)
  }, [])

  const onMetaSave = useCallback(
    async (fields: {subject?: string; intro?: string}) => {
      const res = await callApi<IssueRow>(`/api/newsletter/issues/${slug}`, {
        method: 'PUT',
        body: JSON.stringify(fields)
      })
      if (!res.success) {
        setError(res.error)
        return
      }
      setDetail(prev => (prev ? {...prev, issue: res.data} : prev))
      setPreviewBust(b => b + 1)
    },
    [slug]
  )

  const onApprove = useCallback(async () => {
    setApprovalBusy('approving')
    setConfirmingApproval(false)
    const res = await callApi<{
      broadcastId: string
      dashboardUrl: string
      scheduledAt: number
    }>(`/api/newsletter/issues/${slug}/approve`, {method: 'POST'})
    setApprovalBusy(null)
    if (!res.success) {
      setError(res.error)
      return
    }
    await refresh()
  }, [slug, refresh])

  const onCancelApproval = useCallback(async () => {
    setApprovalBusy('cancelling')
    const res = await callApi<IssueRow>(
      `/api/newsletter/issues/${slug}/unapprove`,
      {
        method: 'POST'
      }
    )
    setApprovalBusy(null)
    if (!res.success) {
      setError(res.error)
      return
    }
    await refresh()
  }, [slug, refresh])

  if (loading) {
    return (
      <Page className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col p-6">
        <Muted>Loading issue…</Muted>
      </Page>
    )
  }

  if (error || !detail) {
    return (
      <Page className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col p-6">
        <PageSection>
          <Alert variant="destructive">{error ?? 'Issue not found.'}</Alert>
        </PageSection>
      </Page>
    )
  }

  const {issue, sections} = detail
  const isSent = issue.status === 'sent'
  const isScheduled = issue.status === 'scheduled'
  const isReadOnly = isSent || isScheduled || approvalBusy !== null

  return (
    <Page className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col p-6">
      <PageHeader className="mb-4 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-3">
            <Link
              href="/"
              className="text-xs text-muted-foreground hover:underline">
              ← Console
            </Link>
            <span className="font-mono text-xs text-muted-foreground">
              #{issue.issueNumber}
            </span>
            <Badge
              variant="muted"
              className="rounded-full text-[10px] uppercase tracking-wide">
              {issue.publicationId}
            </Badge>
            <Badge
              variant={isSent ? 'default' : 'muted'}
              className="rounded-full text-[10px] uppercase tracking-wide">
              {statusLabel(issue.status)}
            </Badge>
          </div>
          <SubjectEditor
            initial={issue.subject}
            disabled={isReadOnly}
            onSave={subject => onMetaSave({subject})}
          />
          <IntroEditor
            initial={issue.intro}
            disabled={isReadOnly}
            onSave={intro => onMetaSave({intro})}
          />
        </div>
        <ApproveBox
          issue={issue}
          settings={settings}
          busy={approvalBusy}
          confirming={confirmingApproval}
          recipientHint={`Audience: ${publicationDisplay(issue.publicationId).label}`}
          onAskConfirm={() => setConfirmingApproval(true)}
          onCancelConfirm={() => setConfirmingApproval(false)}
          onApprove={onApprove}
          onCancelApproval={onCancelApproval}
        />
      </PageHeader>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-2">
        <PageSection className="flex min-h-0 flex-col">
          <div className="mb-3 flex items-center justify-between gap-4">
            <H2>Sections</H2>
            <Muted className="text-xs">
              {sections.length} section{sections.length === 1 ? '' : 's'}
            </Muted>
          </div>
          <div className="flex flex-col gap-4">
            {sections.map((s, i) => (
              <SectionCard
                key={`${slug}-${s.linkUrl}-${s.emojiHeadline}`}
                slug={slug}
                section={s}
                isFirst={i === 0}
                isLast={i === sections.length - 1}
                disabled={isReadOnly}
                onUpdated={onSectionsUpdate}
              />
            ))}
          </div>
        </PageSection>

        <PageSection className="flex min-h-0 flex-col">
          <div className="mb-3 flex items-center justify-between gap-4">
            <H2>Preview</H2>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setPreviewBust(b => b + 1)}>
              Reload
            </Button>
          </div>
          <iframe
            key={previewBust}
            src={`/api/newsletter/issues/${slug}/preview?v=${previewBust}`}
            className="h-full min-h-[600px] w-full rounded-xl border border-border bg-white"
            title="Email preview"
          />
        </PageSection>
      </div>
    </Page>
  )
}

function SubjectEditor({
  initial,
  disabled,
  onSave
}: {
  initial: string
  disabled: boolean
  onSave: (subject: string) => void
}) {
  const [value, setValue] = useState(initial)
  useEffect(() => setValue(initial), [initial])
  return (
    <input
      type="text"
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={() => value !== initial && onSave(value.trim())}
      disabled={disabled}
      placeholder="Email subject"
      aria-label="Email subject"
      className="w-full bg-transparent text-2xl font-bold leading-tight tracking-tight text-foreground outline-none placeholder:text-muted-foreground/60 focus:ring-0"
      style={{letterSpacing: '-0.5px'}}
    />
  )
}

function IntroEditor({
  initial,
  disabled,
  onSave
}: {
  initial: string
  disabled: boolean
  onSave: (intro: string) => void
}) {
  const [value, setValue] = useState(initial)
  useEffect(() => setValue(initial), [initial])
  return (
    <textarea
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={() => value !== initial && onSave(value.trim())}
      disabled={disabled}
      placeholder="Issue introduction…"
      aria-label="Issue introduction"
      rows={2}
      className="mt-2 w-full resize-none bg-transparent text-base leading-relaxed text-muted-foreground outline-none placeholder:text-muted-foreground/40 focus:ring-0"
    />
  )
}

function publicationTimeFormatter(
  publicationId: PublicationId
): Intl.DateTimeFormat {
  const d = publicationDisplay(publicationId)
  return new Intl.DateTimeFormat(d.locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: d.timeZone
  })
}

function formatSendTime(ts: number, publicationId: PublicationId): string {
  return publicationTimeFormatter(publicationId).format(new Date(ts))
}

function ApproveBox({
  issue,
  settings,
  busy,
  confirming,
  recipientHint,
  onAskConfirm,
  onCancelConfirm,
  onApprove,
  onCancelApproval
}: {
  issue: IssueRow
  settings: SettingsDto | null
  busy: null | 'approving' | 'cancelling'
  confirming: boolean
  recipientHint: string
  onAskConfirm: () => void
  onCancelConfirm: () => void
  onApprove: () => void
  onCancelApproval: () => void
}) {
  if (issue.status === 'sent') {
    return (
      <div className="flex shrink-0 flex-col items-end gap-2 rounded-md border border-border bg-background p-3 text-xs">
        <div className="font-mono uppercase tracking-wide text-muted-foreground">
          Sent
        </div>
      </div>
    )
  }

  if (issue.status === 'scheduled') {
    const when = issue.scheduledAt
      ? formatSendTime(issue.scheduledAt, issue.publicationId)
      : 'the configured send time'
    return (
      <div className="flex shrink-0 flex-col items-end gap-2 rounded-md border border-primary/40 bg-accent p-3 text-sm">
        <div className="font-mono text-[10px] uppercase tracking-wide text-primary">
          Scheduled
        </div>
        <div className="text-right text-foreground">{when}</div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy !== null}
          onClick={onCancelApproval}>
          {busy === 'cancelling' ? 'Cancelling…' : 'Cancel schedule'}
        </Button>
      </div>
    )
  }

  const sendAt = settings ? nextScheduledSendUtc(settings) : null
  const sendAtLabel = sendAt
    ? formatSendTime(sendAt.getTime(), issue.publicationId)
    : 'loading…'

  if (confirming) {
    return (
      <div className="flex shrink-0 flex-col items-end gap-2 rounded-md border border-primary/30 bg-accent p-3 text-sm">
        <div className="text-right text-foreground">
          Approve and schedule for {sendAtLabel}?
        </div>
        <div className="text-xs text-muted-foreground">{recipientHint}</div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy !== null}
            onClick={onCancelConfirm}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy !== null}
            onClick={onApprove}>
            {busy === 'approving' ? 'Scheduling…' : 'Yes, approve'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <Button type="button" disabled={busy !== null} onClick={onAskConfirm}>
        Approve and schedule →
      </Button>
      <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
        sends {sendAtLabel}
      </span>
    </div>
  )
}

interface SectionCardProps {
  slug: string
  section: SectionDraftDto
  isFirst: boolean
  isLast: boolean
  disabled: boolean
  onUpdated: (sections: SectionDraftDto[]) => void
}

function SectionCard({
  slug,
  section,
  isFirst,
  isLast,
  disabled,
  onUpdated
}: SectionCardProps) {
  const [headline, setHeadline] = useState(section.emojiHeadline)
  const [body, setBody] = useState(section.bodyMarkdown)
  const [soWhat, setSoWhat] = useState(section.soWhat)
  const [imageUrl, setImageUrl] = useState(section.imageUrl ?? '')
  const [imageBroken, setImageBroken] = useState(false)
  const [sectionError, setSectionError] = useState<string | null>(null)
  const [busy, setBusy] = useState<
    null | 'regenerate' | 'generate-image' | 'drop' | 'reorder'
  >(null)
  const [regenOpen, setRegenOpen] = useState(false)
  const [imagePromptOpen, setImagePromptOpen] = useState(false)
  const [angleHint, setAngleHint] = useState('')
  const [imageSystemPrompt, setImageSystemPrompt] = useState(() =>
    defaultImageSystemPrompt()
  )
  const [imagePrompt, setImagePrompt] = useState(() =>
    defaultImagePrompt(section)
  )

  // Reset locals when the upstream section identity changes (regenerate / reorder)
  const sigRef = useRef('')
  useMemo(() => {
    const sig = `${section.index}|${section.emojiHeadline}|${section.bodyMarkdown.length}|${section.imageUrl ?? ''}`
    if (sig !== sigRef.current) {
      setHeadline(section.emojiHeadline)
      setBody(section.bodyMarkdown)
      setSoWhat(section.soWhat)
      setImageUrl(section.imageUrl ?? '')
      setImageBroken(false)
      setSectionError(null)
      setImageSystemPrompt(defaultImageSystemPrompt())
      setImagePrompt(defaultImagePrompt(section))
      sigRef.current = sig
    }
    return null
  }, [section])

  const patch = useCallback(
    async (fields: Partial<SectionDraftDto>) => {
      const res = await callApi<SectionDraftDto[]>(
        `/api/newsletter/issues/${slug}/sections/${section.index}`,
        {method: 'PATCH', body: JSON.stringify(fields)}
      )
      if (res.success) onUpdated(res.data)
      else setSectionError(res.error)
    },
    [slug, section.index, onUpdated]
  )

  const reorder = useCallback(
    async (direction: -1 | 1) => {
      setBusy('reorder')
      try {
        // Build the new order: swap section.index with section.index + direction
        const target = section.index + direction
        // We need the full count, but we don't have it here. Best: re-fetch sections and reorder.
        const detailRes = await callApi<IssueDetail>(
          `/api/newsletter/issues/${slug}`
        )
        if (!detailRes.success) return
        const order = detailRes.data.sections.map(s => s.index)
        const i = order.indexOf(section.index)
        if (i === -1 || target < 0 || target >= order.length) return
        ;[order[i], order[target]] = [order[target]!, order[i]!]
        const res = await callApi<SectionDraftDto[]>(
          `/api/newsletter/issues/${slug}/sections/reorder`,
          {method: 'POST', body: JSON.stringify({order})}
        )
        if (res.success) onUpdated(res.data)
        else setSectionError(res.error)
      } finally {
        setBusy(null)
      }
    },
    [slug, section.index, onUpdated]
  )

  const drop = useCallback(async () => {
    if (
      !confirm(`Delete this section? "${section.emojiHeadline.slice(0, 60)}"`)
    )
      return
    setBusy('drop')
    try {
      const res = await callApi<SectionDraftDto[]>(
        `/api/newsletter/issues/${slug}/sections/${section.index}`,
        {method: 'DELETE'}
      )
      if (res.success) onUpdated(res.data)
      else setSectionError(res.error)
    } finally {
      setBusy(null)
    }
  }, [slug, section.index, section.emojiHeadline, onUpdated])

  const regenerate = useCallback(async () => {
    setBusy('regenerate')
    try {
      const res = await callApi<SectionDraftDto[]>(
        `/api/newsletter/issues/${slug}/sections/${section.index}/regenerate`,
        {
          method: 'POST',
          body: JSON.stringify(
            angleHint.trim() ? {angle: angleHint.trim()} : {}
          )
        }
      )
      if (res.success) {
        onUpdated(res.data)
        setRegenOpen(false)
        setAngleHint('')
      } else {
        setSectionError(res.error)
      }
    } finally {
      setBusy(null)
    }
  }, [slug, section.index, angleHint, onUpdated])

  const generateImage = useCallback(async () => {
    setBusy('generate-image')
    try {
      setSectionError(null)
      const res = await callApi<SectionDraftDto[]>(
        `/api/newsletter/issues/${slug}/sections/${section.index}/generate-image`,
        {
          method: 'POST',
          body: JSON.stringify({
            systemPrompt: imageSystemPrompt,
            imagePrompt
          })
        }
      )
      if (res.success) onUpdated(res.data)
      else setSectionError(res.error)
    } finally {
      setBusy(null)
    }
  }, [slug, section.index, imageSystemPrompt, imagePrompt, onUpdated])

  return (
    <div
      className={`rounded-xl border bg-background p-4 transition-opacity ${
        busy ? 'opacity-60' : ''
      } ${section.isTactical ? 'border-primary/40' : 'border-border'}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            #{section.index + 1}
          </span>
          {section.isTactical ? (
            <span className="rounded-sm bg-foreground px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-background">
              tactical
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={isFirst || disabled || !!busy}
            onClick={() => reorder(-1)}
            aria-label="Move section up">
            ↑
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={isLast || disabled || !!busy}
            onClick={() => reorder(1)}
            aria-label="Move section down">
            ↓
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || !!busy}
            onClick={() => setImagePromptOpen(o => !o)}>
            Image prompt
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || !!busy}
            onClick={generateImage}>
            {busy === 'generate-image'
              ? 'Generating image…'
              : 'Generate 3D image'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || !!busy}
            onClick={() => setRegenOpen(o => !o)}>
            {busy === 'regenerate' ? 'Regenerating…' : 'Regenerate'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || !!busy}
            onClick={drop}>
            Delete
          </Button>
        </div>
      </div>

      {sectionError ? (
        <Alert variant="destructive" className="mb-3">
          {sectionError}
        </Alert>
      ) : null}

      {imagePromptOpen ? (
        <div className="mb-3 rounded-md border border-primary/30 bg-accent p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Image prompts
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!!busy}
              onClick={() => {
                setImageSystemPrompt(defaultImageSystemPrompt())
                setImagePrompt(
                  defaultImagePrompt({
                    ...section,
                    emojiHeadline: headline,
                    bodyMarkdown: body,
                    soWhat
                  })
                )
              }}>
              Reset
            </Button>
          </div>
          <label
            htmlFor={`image-system-${section.index}`}
            className="mb-1 block text-[10px] font-mono font-bold uppercase tracking-[1.4px] text-muted-foreground">
            System prompt
          </label>
          <textarea
            id={`image-system-${section.index}`}
            value={imageSystemPrompt}
            onChange={e => setImageSystemPrompt(e.target.value)}
            disabled={disabled || !!busy}
            rows={7}
            className="mb-3 w-full resize-y rounded-md border border-border bg-background p-2 font-mono text-xs leading-relaxed text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
          <label
            htmlFor={`image-prompt-${section.index}`}
            className="mb-1 block text-[10px] font-mono font-bold uppercase tracking-[1.4px] text-muted-foreground">
            Image prompt
          </label>
          <textarea
            id={`image-prompt-${section.index}`}
            value={imagePrompt}
            onChange={e => setImagePrompt(e.target.value)}
            disabled={disabled || !!busy}
            rows={8}
            className="w-full resize-y rounded-md border border-border bg-background p-2 font-mono text-xs leading-relaxed text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
          <Muted className="mt-2 block text-xs">
            These prompts apply only to this generation and do not change the
            issue text.
          </Muted>
        </div>
      ) : null}

      {regenOpen ? (
        <div className="mb-3 rounded-md border border-primary/30 bg-accent p-3">
          <label
            htmlFor={`angle-${section.index}`}
            className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Angle guidance (optional)
          </label>
          <textarea
            id={`angle-${section.index}`}
            value={angleHint}
            onChange={e => setAngleHint(e.target.value)}
            placeholder="For example: focus on newcomers to the topic, make it more concise, or reduce jargon…"
            rows={2}
            className="w-full resize-none rounded-md border border-border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!!busy}
              onClick={() => {
                setRegenOpen(false)
                setAngleHint('')
              }}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!!busy}
              onClick={regenerate}>
              {busy === 'regenerate' ? 'Regenerating…' : 'Regenerate section'}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mb-3 rounded-md border border-border bg-card p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <label
            htmlFor={`img-${section.index}`}
            className="text-[10px] font-mono font-bold uppercase tracking-[1.4px] text-muted-foreground">
            Image (URL)
          </label>
          {section.imageUrl ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled || !!busy}
              onClick={() => {
                setImageUrl('')
                setImageBroken(false)
                void patch({imageUrl: null})
              }}>
              Remove image
            </Button>
          ) : null}
        </div>
        <div className="mb-2 text-xs text-muted-foreground">
          {section.referenceImageUrl
            ? 'Reference: source image detected.'
            : 'No reference image. The headline and text will guide generation.'}
        </div>
        <input
          id={`img-${section.index}`}
          type="url"
          value={imageUrl}
          onChange={e => {
            setImageUrl(e.target.value)
            setImageBroken(false)
          }}
          onBlur={() => {
            const next = imageUrl.trim()
            if (next !== (section.imageUrl ?? ''))
              patch({imageUrl: next || null})
          }}
          disabled={disabled || !!busy}
          placeholder="https://…"
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
        />
        {imageUrl.trim() ? (
          <div className="mt-3">
            {imageBroken ? (
              <Muted className="text-xs">The image did not load.</Muted>
            ) : (
              <img
                src={imageUrl}
                alt="Section illustration"
                className="max-h-[200px] w-full rounded-md object-cover"
                onError={() => setImageBroken(true)}
              />
            )}
          </div>
        ) : null}
      </div>

      <input
        type="text"
        value={headline}
        onChange={e => setHeadline(e.target.value)}
        onBlur={() =>
          headline !== section.emojiHeadline && patch({emojiHeadline: headline})
        }
        disabled={disabled || !!busy}
        placeholder="💡 Headline with emoji"
        aria-label="Section headline"
        className="mb-3 w-full bg-transparent text-xl font-semibold text-foreground outline-none placeholder:text-muted-foreground/60 focus:ring-0"
      />

      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        onBlur={() =>
          body !== section.bodyMarkdown && patch({bodyMarkdown: body})
        }
        disabled={disabled || !!busy}
        placeholder="Section body in Markdown…"
        aria-label="Section body"
        rows={Math.max(6, Math.ceil(body.length / 80))}
        className="mb-3 w-full resize-y rounded-md border border-border bg-card p-3 font-mono text-sm leading-relaxed text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
      />

      <label
        htmlFor={`sw-${section.index}`}
        className="mb-1 block text-[10px] font-mono font-bold uppercase tracking-[1.4px] text-primary">
        Why it matters
      </label>
      <textarea
        id={`sw-${section.index}`}
        value={soWhat}
        onChange={e => setSoWhat(e.target.value)}
        onBlur={() => soWhat !== section.soWhat && patch({soWhat})}
        disabled={disabled || !!busy}
        rows={3}
        className="w-full resize-y rounded-md border border-border bg-card p-3 text-sm leading-relaxed text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
      />

      <div className="mt-3 text-xs">
        <a
          href={section.linkUrl}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline-offset-2 hover:underline">
          {section.linkText} →
        </a>
      </div>
    </div>
  )
}

function defaultImageSystemPrompt(): string {
  return [
    'You are the art director for an editorial newsletter.',
    'Create a clear, original editorial illustration that supports the section idea.',
    'Style: warm studio background, simple dimensional objects, soft shadows, approachable composition, and strong contrast at email size.',
    'Palette: warm coral accent, soft cream background, muted blue and green accents, and charcoal details only when necessary.',
    'Subject matter: derive the visual metaphor from the section text. Prefer simple symbolic objects over literal scenes, for example notebooks, calendars, simple charts, sticky notes, and light bulbs.',
    'Avoid readable text, logos, screenshots, UI, photorealistic faces, clutter, watermarks, harsh gradients, and photo collages.',
    'Composition: square 1024x1024, one central object group, generous whitespace.'
  ].join('\n')
}

function defaultImagePrompt(
  section: Pick<
    SectionDraftDto,
    | 'emojiHeadline'
    | 'bodyMarkdown'
    | 'soWhat'
    | 'linkUrl'
    | 'referenceImageUrl'
  >
): string {
  const reference = section.referenceImageUrl
    ? `Use the attached source image as loose visual/context reference, not as a photo collage. Source URL: ${section.referenceImageUrl}`
    : `No source image is available; infer the visual metaphor from the section text and source URL: ${section.linkUrl}`
  return [
    'Create one branded 3D editorial image for this newsletter section.',
    reference,
    '',
    `Section headline: ${section.emojiHeadline}`,
    `Section body: ${section.bodyMarkdown.slice(0, 900)}`,
    `Reader takeaway: ${section.soWhat}`
  ].join('\n')
}
