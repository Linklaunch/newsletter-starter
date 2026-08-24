'use client'

import Link from 'next/link'
import {useCallback, useEffect, useId, useState} from 'react'

import {Alert} from '@/components/ui/alert'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
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
import {publicationDisplay, statusLabel} from '@/publications/display'

type Engagement = 'opened' | 'clicked'

interface PromoRow {
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
  engagement: Engagement
  status: 'draft' | 'sent'
  targetCount: number | null
  createdAt: number
  sentAt: number | null
}

interface SendResult {
  status: 'draft' | 'sent' | 'scheduled'
  targetCount: number
}

type EditableField =
  | 'subject'
  | 'previewText'
  | 'headline'
  | 'bodyMarkdown'
  | 'ctaLabel'
  | 'ctaUrl'

export function PromoEditorPage({id}: {id: string}): React.JSX.Element {
  const [promo, setPromo] = useState<PromoRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingField, setSavingField] = useState<EditableField | null>(null)
  const [previewBust, setPreviewBust] = useState(0)
  const [sending, setSending] = useState(false)
  const [confirmingSend, setConfirmingSend] = useState(false)
  const [sendResult, setSendResult] = useState<SendResult | null>(null)

  const refresh = useCallback(async () => {
    const res = await callApi<PromoRow>(`/api/newsletter/promos/${id}`)
    if (res.success) {
      setPromo(res.data)
      setError(null)
    } else {
      setError(res.error)
    }
  }, [id])

  useEffect(() => {
    setLoading(true)
    refresh().finally(() => setLoading(false))
  }, [refresh])

  const saveField = useCallback(
    async (field: EditableField, value: string) => {
      setSavingField(field)
      const res = await callApi<PromoRow>(`/api/newsletter/promos/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({[field]: value})
      })
      setSavingField(null)
      if (res.success) {
        setPromo(res.data)
        setError(null)
        setPreviewBust(b => b + 1)
      } else {
        setError(res.error)
      }
    },
    [id]
  )

  const handleSend = useCallback(async () => {
    setSending(true)
    setError(null)
    const res = await callApi<SendResult>(`/api/newsletter/promos/${id}/send`, {
      method: 'POST'
    })
    if (res.success) {
      setSendResult(res.data)
      setConfirmingSend(false)
      await refresh()
    } else {
      setError(res.error)
    }
    setSending(false)
  }, [id, refresh])

  if (loading) {
    return (
      <Page className="mx-auto w-full max-w-5xl p-6">
        <Muted>Loading…</Muted>
      </Page>
    )
  }

  if (!promo) {
    return (
      <Page className="mx-auto w-full max-w-5xl p-6">
        <Alert variant="destructive">{error ?? 'Promo not found'}</Alert>
        <Link
          href="/promos"
          className="mt-4 inline-block text-sm text-primary hover:underline">
          ← Back to promos
        </Link>
      </Page>
    )
  }

  const publicationId = publicationDisplay(promo.publicationId)
  const isSent = promo.status === 'sent'

  return (
    <Page className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col p-6">
      <PageHeader className="mb-6 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <PageTitle>Edit promotion</PageTitle>
          <div className="mt-1 flex items-center gap-2">
            <Badge
              variant="muted"
              className="rounded-full text-[10px] uppercase tracking-wide">
              {publicationId.id}
            </Badge>
            <Badge
              variant={isSent ? 'default' : 'muted'}
              className="rounded-full text-[10px] uppercase tracking-wide">
              {statusLabel(promo.status)}
            </Badge>
            <Muted className="text-xs">
              {promo.engagement === 'clicked' ? 'clicks' : 'opens'} · latest{' '}
              {promo.windowIssues} issues
            </Muted>
          </div>
        </div>
        <Link href="/promos" className="text-sm text-primary hover:underline">
          ← Back
        </Link>
      </PageHeader>

      {error ? (
        <PageSection className="mb-4">
          <Alert variant="destructive">{error}</Alert>
        </PageSection>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-2">
        <PageSection className="flex flex-col gap-4">
          <H2>Content</H2>
          <FieldRow
            label="Subject"
            value={promo.subject}
            disabled={isSent}
            saving={savingField === 'subject'}
            onSave={v => saveField('subject', v)}
          />
          <FieldRow
            label="Inbox preview text"
            value={promo.previewText}
            disabled={isSent}
            saving={savingField === 'previewText'}
            onSave={v => saveField('previewText', v)}
          />
          <FieldRow
            label="Headline"
            value={promo.headline}
            disabled={isSent}
            saving={savingField === 'headline'}
            onSave={v => saveField('headline', v)}
          />
          <FieldRow
            label="Body (Markdown)"
            value={promo.bodyMarkdown}
            multiline
            disabled={isSent}
            saving={savingField === 'bodyMarkdown'}
            onSave={v => saveField('bodyMarkdown', v)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow
              label="Button label"
              value={promo.ctaLabel}
              disabled={isSent}
              saving={savingField === 'ctaLabel'}
              onSave={v => saveField('ctaLabel', v)}
            />
            <FieldRow
              label="Button link"
              value={promo.ctaUrl}
              disabled={isSent}
              saving={savingField === 'ctaUrl'}
              onSave={v => saveField('ctaUrl', v)}
            />
          </div>

          <div className="mt-2 rounded-xl border border-border bg-muted/20 p-4">
            {isSent ? (
              <div className="flex flex-col gap-2">
                <Muted className="text-sm">
                  Sent
                  {promo.targetCount != null
                    ? ` to ${promo.targetCount} recipients`
                    : ''}
                  .
                </Muted>
              </div>
            ) : sendResult ? (
              <div className="flex flex-col gap-2">
                <div className="text-sm font-semibold text-foreground">
                  {sendResult.status === 'sent'
                    ? `Sent a ${sendResult.targetCount} contacts.`
                    : `Draft created in Resend for ${sendResult.targetCount} contacts.`}
                </div>
                <Muted className="text-xs">
                  {sendResult.status === 'sent'
                    ? 'The broadcast was sent to the engaged audience.'
                    : 'Review it in Resend, then select Send when ready.'}
                </Muted>
              </div>
            ) : confirmingSend ? (
              <div className="flex flex-col gap-3">
                <div className="text-sm text-foreground">
                  A Resend broadcast will be created for the{' '}
                  <strong>engaged readers</strong> (
                  {promo.engagement === 'clicked' ? 'clicks' : 'opens'}, latest{' '}
                  {promo.windowIssues} issues). By default it remains a{' '}
                  <strong>draft</strong> for review before sending.
                </div>
                <div className="flex gap-3">
                  <Button type="button" disabled={sending} onClick={handleSend}>
                    {sending ? 'Preparing…' : 'Yes, create broadcast'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={sending}
                    onClick={() => setConfirmingSend(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Button type="button" onClick={() => setConfirmingSend(true)}>
                  Create broadcast →
                </Button>
                <Muted className="text-xs">
                  Recalculates engaged readers using current data and creates
                  the Resend broadcast.
                </Muted>
              </div>
            )}
          </div>
        </PageSection>

        <PageSection className="flex min-h-0 flex-col">
          <H2 className="mb-3">Preview</H2>
          <div className="min-h-[600px] flex-1 overflow-hidden rounded-xl border border-border bg-white">
            <iframe
              key={previewBust}
              title="Email preview"
              src={`/api/newsletter/promos/${id}/preview?v=${previewBust}`}
              className="h-full min-h-[600px] w-full"
            />
          </div>
        </PageSection>
      </div>
    </Page>
  )
}

function FieldRow({
  label,
  value,
  multiline,
  disabled,
  saving,
  onSave
}: {
  label: string
  value: string
  multiline?: boolean
  disabled?: boolean
  saving?: boolean
  onSave: (value: string) => void
}): React.JSX.Element {
  const inputId = useId()
  const [draft, setDraft] = useState(value)
  useEffect(() => {
    setDraft(value)
  }, [value])
  const dirty = draft !== value

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={inputId}>{label}</Label>
        {dirty && !disabled ? (
          <Button
            type="button"
            variant="outline"
            className="h-7 px-2 text-xs"
            disabled={saving}
            onClick={() => onSave(draft)}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        ) : null}
      </div>
      {multiline ? (
        <Textarea
          id={inputId}
          rows={6}
          value={draft}
          disabled={disabled}
          onChange={e => setDraft(e.target.value)}
        />
      ) : (
        <Input
          id={inputId}
          value={draft}
          disabled={disabled}
          onChange={e => setDraft(e.target.value)}
        />
      )}
    </div>
  )
}
