'use client'

import Link from 'next/link'
import {useCallback, useEffect, useState} from 'react'
import {Alert} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import {PublicationSelect} from '@/components/ui/publication-select'
import {EmptyState, Panel} from '@/components/ui/panel'
import {Page, PageHeader, PageSection} from '@/components/ui/app-shell'
import {H2, Muted} from '@/components/ui/typography'
import {callApi} from '@/lib/api-client'
import type {OperatorIssueDto as IssueRow} from '@/lib/dto'
import type {PublicationId} from '@/publications/types'
import {
  DEFAULT_PUBLICATION_ID,
  publicationDisplay,
  statusLabel
} from '@/publications/display'

interface SettingsDto {
  draftDaysUtc: number[]
  draftHourUtc: number
  sendDaysUtc: number[]
  sendHourUtc: number
  draftEnabled: boolean
  updatedAt: number
}

interface IssueStatsDto {
  slug: string
  issueNumber: number
  subject: string
  status: string
  stats: {
    status: string
    sentAt: number | null
    scheduledAt: number | null
    recipients: number
    delivered: number
    opened: number
    clicked: number
    bounced: number
    complained: number
    unsubscribed: number
    openRate: number
    clickRate: number
  }
  feedback: {
    fire: number
    smile: number
    sleep: number
    total: number
  }
}

const DAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
]

// Convert a UTC weekday+hour to local using a fixed offset (negative = behind
// UTC), taken from the publication's `utcOffsetHours`.
//
// KNOWN LIMITATION: a constant offset is only exact for zones that do not
// observe daylight saving time. For a DST zone (the bundled sample uses
// America/New_York) the displayed schedule is off by an hour for part of the
// year. Stored schedules are UTC and unaffected; only this display conversion
// drifts. Set `utcOffsetHours` to the offset you want shown, or replace this
// with `Intl.DateTimeFormat` zone math if you need it exact year round.
function utcToLocalPair(
  dayUtc: number,
  hourUtc: number,
  offset: number
): {dayLocal: number; hourLocal: number} {
  const hourLocal = (hourUtc + offset + 24) % 24
  // Crossing back past midnight (UTC hour + offset < 0) rolls the weekday back.
  const dayLocal = hourUtc + offset < 0 ? (dayUtc + 6) % 7 : dayUtc
  return {dayLocal, hourLocal}
}

function localToUtcPair(
  dayLocal: number,
  hourLocal: number,
  offset: number
): {dayUtc: number; hourUtc: number} {
  const hourUtc = (hourLocal - offset + 24) % 24
  // Crossing forward past midnight (local hour − offset ≥ 24) rolls forward.
  const dayUtc = hourLocal - offset >= 24 ? (dayLocal + 1) % 7 : dayLocal
  return {dayUtc, hourUtc}
}

// Same day-roll rule as utcToLocalPair/localToUtcPair, applied to a whole
// day-of-week set. The hour is shared across every selected day, so every
// day in the set rolls the same direction.
function utcDaysToLocalDays(
  daysUtc: number[],
  hourUtc: number,
  offset: number
): number[] {
  return daysUtc
    .map(dayUtc => utcToLocalPair(dayUtc, hourUtc, offset).dayLocal)
    .sort((a, b) => a - b)
}

function localDaysToUtcDays(
  daysLocal: number[],
  hourLocal: number,
  offset: number
): number[] {
  return daysLocal
    .map(dayLocal => localToUtcPair(dayLocal, hourLocal, offset).dayUtc)
    .sort((a, b) => a - b)
}

function formatPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

export function StatsPage() {
  const [publicationId, setPublication] = useState<PublicationId>(
    DEFAULT_PUBLICATION_ID
  )
  const [settings, setSettings] = useState<SettingsDto | null>(null)
  const [issues, setIssues] = useState<IssueRow[]>([])
  const [statsBySlug, setStatsBySlug] = useState<
    Record<string, IssueStatsDto | {error: string}>
  >({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const loadStatsFor = useCallback(async (slug: string) => {
    const res = await callApi<IssueStatsDto>(
      `/api/newsletter/issues/${slug}/stats`
    )
    setStatsBySlug(prev => ({
      ...prev,
      [slug]: res.success ? res.data : {error: res.error}
    }))
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      callApi<SettingsDto>(
        `/api/newsletter/settings?publicationId=${publicationId}`
      ),
      callApi<IssueRow[]>(
        `/api/newsletter/issues?limit=50&publicationId=${publicationId}`
      )
    ])
      .then(([sRes, iRes]) => {
        if (cancelled) return
        if (sRes.success) setSettings(sRes.data)
        else setError(sRes.error)
        if (iRes.success) {
          setIssues(iRes.data)
          for (const issue of iRes.data) {
            if (issue.status === 'sent') void loadStatsFor(issue.slug)
          }
        } else {
          setError(iRes.error)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [loadStatsFor, publicationId])

  const onSaveSettings = useCallback(
    async (patch: Partial<SettingsDto>) => {
      setSaving(true)
      const res = await callApi<SettingsDto>(
        `/api/newsletter/settings?publicationId=${publicationId}`,
        {
          method: 'PUT',
          body: JSON.stringify(patch)
        }
      )
      setSaving(false)
      if (!res.success) {
        setError(res.error)
        return
      }
      setSettings(res.data)
    },
    [publicationId]
  )

  if (loading) {
    return (
      <Page className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col p-6">
        <Muted>Loading analytics…</Muted>
      </Page>
    )
  }

  return (
    <Page className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-6 p-6">
      <PageHeader className="flex shrink-0 items-baseline justify-between">
        <H2>Analytics</H2>
        <div className="flex items-center gap-3">
          <PublicationSelect value={publicationId} onChange={setPublication} />
          <Link
            href="/"
            className="text-xs text-muted-foreground hover:underline">
            ← Console
          </Link>
        </div>
      </PageHeader>

      {error ? <Alert variant="destructive">{error}</Alert> : null}

      <PageSection>
        <H2 className="mb-3 text-base">Schedule</H2>
        {settings ? (
          <ScheduleForm
            key={publicationId}
            settings={settings}
            publicationId={publicationId}
            saving={saving}
            onSave={onSaveSettings}
          />
        ) : null}
      </PageSection>

      <PageSection>
        <H2 className="mb-3 text-base">Issues</H2>
        <IssuesTable issues={issues} statsBySlug={statsBySlug} />
      </PageSection>
    </Page>
  )
}

function ScheduleForm({
  settings,
  publicationId,
  saving,
  onSave
}: {
  settings: SettingsDto
  publicationId: PublicationId
  saving: boolean
  onSave: (patch: Partial<SettingsDto>) => void
}) {
  const offset = publicationDisplay(publicationId).utcOffsetHours
  const tzLabel = publicationDisplay(publicationId).tzLabel
  const draftHourLocal = utcToLocalPair(
    0,
    settings.draftHourUtc,
    offset
  ).hourLocal
  const sendHourLocal = utcToLocalPair(
    0,
    settings.sendHourUtc,
    offset
  ).hourLocal
  const draftDaysLocal = utcDaysToLocalDays(
    settings.draftDaysUtc,
    settings.draftHourUtc,
    offset
  )
  const sendDaysLocal = utcDaysToLocalDays(
    settings.sendDaysUtc,
    settings.sendHourUtc,
    offset
  )
  const [draftDays, setDraftDays] = useState(draftDaysLocal)
  const [draftHour, setDraftHour] = useState(draftHourLocal)
  const [sendDays, setSendDays] = useState(sendDaysLocal)
  const [sendHour, setSendHour] = useState(sendHourLocal)

  useEffect(() => {
    setDraftDays(
      utcDaysToLocalDays(settings.draftDaysUtc, settings.draftHourUtc, offset)
    )
    setDraftHour(utcToLocalPair(0, settings.draftHourUtc, offset).hourLocal)
    setSendDays(
      utcDaysToLocalDays(settings.sendDaysUtc, settings.sendHourUtc, offset)
    )
    setSendHour(utcToLocalPair(0, settings.sendHourUtc, offset).hourLocal)
  }, [settings, offset])

  const draftEnabled = settings.draftEnabled

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (draftDays.length === 0 || sendDays.length === 0) return
    onSave({
      draftDaysUtc: localDaysToUtcDays(draftDays, draftHour, offset),
      draftHourUtc: localToUtcPair(0, draftHour, offset).hourUtc,
      sendDaysUtc: localDaysToUtcDays(sendDays, sendHour, offset),
      sendHourUtc: localToUtcPair(0, sendHour, offset).hourUtc
    })
  }

  return (
    <Panel>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4"
            checked={draftEnabled}
            disabled={saving}
            onChange={e => onSave({draftEnabled: e.target.checked})}
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">
              Automatically draft each week
            </span>
            <Muted className="text-xs">
              {draftEnabled
                ? 'A draft is generated at the schedule below.'
                : 'Disabled: the newsletter is generated only through the manual Run now action.'}
            </Muted>
          </span>
        </label>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className={draftEnabled ? undefined : 'opacity-50'}>
            <DaysHourPicker
              label="Draft generation"
              help="Days the draft is generated. Review is available after the time below."
              tzLabel={tzLabel}
              days={draftDays}
              hour={draftHour}
              onDaysChange={setDraftDays}
              onHourChange={setDraftHour}
            />
          </div>
          <DaysHourPicker
            label="Newsletter delivery"
            help="Days Resend sends the approved issue."
            tzLabel={tzLabel}
            days={sendDays}
            hour={sendHour}
            onDaysChange={setSendDays}
            onHourChange={setSendHour}
          />
        </div>
        <div className="flex items-center justify-end gap-3">
          <Muted className="text-xs">
            Last updated:{' '}
            {new Date(settings.updatedAt).toLocaleString(
              publicationDisplay(publicationId).locale,
              {
                timeZone: publicationDisplay(publicationId).timeZone
              }
            )}
          </Muted>
          <Button
            type="submit"
            disabled={
              saving || draftDays.length === 0 || sendDays.length === 0
            }>
            {saving ? 'Saving…' : 'Save schedule'}
          </Button>
        </div>
      </form>
    </Panel>
  )
}

function DaysHourPicker({
  label,
  help,
  tzLabel,
  days,
  hour,
  onDaysChange,
  onHourChange
}: {
  label: string
  help: string
  tzLabel: string
  days: number[]
  hour: number
  onDaysChange: (days: number[]) => void
  onHourChange: (n: number) => void
}) {
  const toggleDay = (i: number) => {
    const next = days.includes(i)
      ? days.filter(d => d !== i)
      : [...days, i].sort((a, b) => a - b)
    onDaysChange(next)
  }
  return (
    <div className="rounded-lg border border-border/70 bg-background p-4">
      <div className="mb-1 text-sm font-medium text-foreground">{label}</div>
      <Muted className="mb-3 block text-xs">{help}</Muted>
      <div className="mb-3">
        <span className="mb-1 block font-mono text-xs uppercase tracking-wide text-muted-foreground">
          Days ({tzLabel})
        </span>
        <div className="flex flex-wrap gap-1.5">
          {DAY_LABELS.map((d, i) => {
            const active = days.includes(i)
            return (
              <button
                key={d}
                type="button"
                aria-pressed={active}
                onClick={() => toggleDay(i)}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted/50'
                }`}>
                {d.slice(0, 3)}
              </button>
            )
          })}
        </div>
        {days.length === 0 ? (
          <p className="mt-1.5 text-xs text-destructive">
            Select at least one day.
          </p>
        ) : null}
      </div>
      <label className="flex flex-col text-xs">
        <span className="mb-1 font-mono uppercase tracking-wide text-muted-foreground">
          Hour ({tzLabel})
        </span>
        <select
          value={hour}
          onChange={e => onHourChange(Number(e.target.value))}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm">
          {Array.from({length: 24}, (_, h) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed 0-23 range  -  the index IS the hour value
            <option key={`h-${h}`} value={h}>
              {String(h).padStart(2, '0')}:00
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

function IssuesTable({
  issues,
  statsBySlug
}: {
  issues: IssueRow[]
  statsBySlug: Record<string, IssueStatsDto | {error: string}>
}) {
  if (issues.length === 0) {
    return <EmptyState>No issues yet.</EmptyState>
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left text-xs font-mono uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Subject</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2 text-right">Recipients</th>
            <th className="px-3 py-2 text-right">Open rate</th>
            <th className="px-3 py-2 text-right">Click rate</th>
            <th className="px-3 py-2 text-right">Rating</th>
          </tr>
        </thead>
        <tbody>
          {issues.map(issue => {
            const stats = statsBySlug[issue.slug]
            const hasStats = stats && !('error' in stats)
            const s = hasStats ? stats.stats : null
            const date = s?.sentAt
              ? new Date(s.sentAt)
              : s?.scheduledAt
                ? new Date(s.scheduledAt)
                : issue.scheduledAt
                  ? new Date(issue.scheduledAt)
                  : new Date(issue.createdAt)
            return (
              <tr key={issue.slug} className="border-t border-border align-top">
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                  {issue.issueNumber}
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/editor/${issue.slug}`}
                    className="text-foreground hover:underline">
                    {issue.subject}
                  </Link>
                </td>
                <td className="px-3 py-2 text-xs font-mono uppercase tracking-wide text-muted-foreground">
                  {statusLabel(issue.status)}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {date.toLocaleString(
                    publicationDisplay(issue.publicationId).locale,
                    {
                      timeZone: publicationDisplay(issue.publicationId)
                        .timeZone,
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    }
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {s ? s.recipients : ' - '}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {s
                    ? formatPct(s.openRate)
                    : stats && 'error' in stats
                      ? ' - '
                      : '…'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {s
                    ? formatPct(s.clickRate)
                    : stats && 'error' in stats
                      ? ' - '
                      : '…'}
                </td>
                <td className="px-3 py-2 text-right text-xs tabular-nums">
                  {hasStats && stats.feedback.total > 0 ? (
                    <span
                      title={`${stats.feedback.fire} loved it · ${stats.feedback.smile} helpful · ${stats.feedback.sleep} not for me`}>
                      {`🔥 ${stats.feedback.fire} · 🙂 ${stats.feedback.smile} · 😴 ${stats.feedback.sleep}`}
                    </span>
                  ) : (
                    ' - '
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
