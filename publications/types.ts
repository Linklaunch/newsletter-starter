import type {RssFeedConfig} from '../journalist/sources/rss-fetch'

/**
 * A publication's stable identifier, for example `coaching`. Ids are plain
 * strings so adding a publication never means editing a type: register the
 * profile in `publications/index.ts` and its display entry in
 * `publications/display.ts`. Use `isPublicationId` to validate untrusted input.
 */
export type PublicationId = string

/** A configurable newsletter publication with its own editorial voice and delivery settings. */
export interface PublicationProfile {
  id: PublicationId
  brand: PublicationBrand
  /** BCP-47 tag used for dates and email markup, for example `en-US`. */
  locale: string
  /** IANA time zone. Customize this for the publication's operating schedule. */
  timeZone: string
  feeds: RssFeedConfig[]
  /** Optional X search query. Omit it to run from RSS sources only. */
  xQuery?: string
  sectionsPerIssue: number
  curatorSystemPrompt: string
  writerSystemPrompt: string
  writerFewShots: WriterFewShot[]
  ctas: {middle: Cta; end: Cta}
  feedbackCopy: FeedbackCopy
  footer: FooterCopy
  /** Environment-variable names that supply this publication's email settings. */
  resendEnv: ResendEnvVars
}

export interface PublicationBrand {
  newsletter: string
  parent: string
  site: string
  wordmark: string
  subtitle: string
}

export interface WriterFewShot {
  user: string
  assistant: string
}

export interface Cta {
  eyebrow: string
  headline: string
  body: string
  buttonText: string
  url: string
}

export interface FeedbackCopy {
  prompt: string
  hint: string
  options: {fire: string; smile: string; sleep: string}
}

export interface FooterCopy {
  blurb: string
  subscribedLine: string
  unsubscribePrefix: string
  unsubscribeTrailer: string
  unsubscribeLinkText: string
  archiveLinkText: string
  soWhatEyebrow: string
  tacticalBadge: string
}

export interface ResendEnvVars {
  apiKey: string
  audienceId: string
  fromEmail: string
  fromName: string
  replyTo: string
}
