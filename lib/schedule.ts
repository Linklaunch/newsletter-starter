import type {NewsletterSettings} from '../journalist/runs-log'

/**
 * Returns the next configured send slot in UTC strictly more than 5 minutes
 * from `now`. Day-set/hour come from the `newsletter_settings` row and are
 * already in UTC (the stats UI translates local -> UTC on save).
 *
 * Pure and client-safe (no server-only imports)  -  shared by the server
 * schedule path (lib/editor-actions.ts, journalist/run.ts) and the editor UI's
 * "sends <date>" label so the label cannot drift from the actual schedule.
 * scheduled.
 */
export function nextScheduledSendUtc(
  settings: Pick<NewsletterSettings, 'sendDaysUtc' | 'sendHourUtc'>,
  now: Date = new Date()
): Date {
  if (settings.sendDaysUtc.length === 0) {
    throw new Error('sendDaysUtc must be a non-empty array')
  }
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
  // Bounded by construction: within 7 days there's always a day in the set.
  while (!settings.sendDaysUtc.includes(d.getUTCDay()) || d.getTime() < minTs) {
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return d
}
