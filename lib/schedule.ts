import type {NewsletterSettings} from '../journalist/runs-log'

/**
 * Returns the next configured send slot in UTC strictly more than 5 minutes
 * from `now`. Day/hour come from the `newsletter_settings` row and are already
 * in UTC (the stats UI translates local -> UTC on save).
 *
 * Pure and client-safe (no server-only imports)  -  shared by the server
 * schedule path (lib/editor-actions.ts, journalist/run.ts) and the editor UI's
 * "sends <date>" label so the label cannot drift from the actual schedule.
 * scheduled.
 */
export function nextScheduledSendUtc(
  settings: Pick<NewsletterSettings, 'sendDayUtc' | 'sendHourUtc'>,
  now: Date = new Date()
): Date {
  const buffer = 5 * 60 * 1000
  const minTs = now.getTime() + buffer
  const d = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      settings.sendHourUtc,
      0,
      0,
      0
    )
  )
  while (d.getUTCDay() !== settings.sendDayUtc || d.getTime() < minTs) {
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return d
}
