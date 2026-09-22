import type {PublicationId} from './types'

/** Client-safe publication metadata for selectors, dates, and status labels. */
export interface PublicationDisplay {
  id: PublicationId
  /** Long label used in headings and audience hints. */
  label: string
  /** Short label used in the publication picker. */
  pickerLabel: string
  /** BCP-47 tag used for dates in the console, for example `en-US`. */
  locale: string
  /** IANA time zone for this publication's schedule. */
  timeZone: string
  /** Display abbreviation for the time zone, for example `ET`. */
  tzLabel: string
  /** Offset used by the schedule form. Keep it aligned with `timeZone`. */
  utcOffsetHours: number
}

/**
 * Register one entry per publication, in picker order. The first entry is the
 * default publication.
 *
 * This is the client-safe half of a publication: it carries no prompts, feeds,
 * or delivery configuration, so React components can import it without pulling
 * server-only code into the browser bundle. Every id registered here needs a
 * matching editorial profile in `publications/index.ts`, and the two lists are
 * checked against each other at startup.
 *
 * Add entries beside `career-signal` for additional publications.
 */
export const PUBLICATION_DISPLAYS: readonly PublicationDisplay[] = [
  {
    id: 'career-signal',
    label: 'CareerSignal, by LinkLaunch',
    pickerLabel: 'CareerSignal',
    locale: 'en-US',
    timeZone: 'America/New_York',
    tzLabel: 'ET',
    utcOffsetHours: -4
  }
]

function firstRegisteredPublication(): PublicationDisplay {
  const first = PUBLICATION_DISPLAYS[0]
  if (!first) {
    throw new Error(
      'PUBLICATION_DISPLAYS is empty  -  register at least one publication'
    )
  }
  return first
}

export const PUBLICATION_DISPLAY: Readonly<
  Partial<Record<PublicationId, PublicationDisplay>>
> = Object.fromEntries(PUBLICATION_DISPLAYS.map(entry => [entry.id, entry]))

export const PUBLICATION_IDS: readonly PublicationId[] =
  PUBLICATION_DISPLAYS.map(entry => entry.id)

export const PUBLICATION_PICKER_LABEL: Readonly<
  Partial<Record<PublicationId, string>>
> = Object.fromEntries(
  PUBLICATION_DISPLAYS.map(entry => [entry.id, entry.pickerLabel])
)

/** The publication used when a request or form does not name one. */
export const DEFAULT_PUBLICATION_ID: PublicationId =
  firstRegisteredPublication().id

/**
 * Look up display metadata by id. Unknown and missing ids fall back to the
 * default publication so a stale stored id cannot break a rendered page.
 */
export function publicationDisplay(
  id: string | null | undefined
): PublicationDisplay {
  const match = id ? PUBLICATION_DISPLAY[id] : undefined
  return match ?? firstRegisteredPublication()
}

export const STATUS_LABEL: Record<string, string> = {
  pending_review: 'Pending review',
  approved: 'Approved',
  scheduled: 'Scheduled',
  sent: 'Sent',
  draft: 'Draft'
}

export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status
}
