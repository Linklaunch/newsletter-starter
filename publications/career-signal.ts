import type {RssFeedConfig} from '../journalist/sources/rss-fetch'
import type {Cta, PublicationProfile, WriterFewShot} from './types'

/**
 * The seven sources selected for their mix of authoritative data, career-
 * development expertise, hiring-trend reporting, and mainstream business
 * coverage. The Federal Reserve (national press releases and speeches)
 * publishes official RSS feeds and is fetched directly. NACE, BLS, LinkedIn,
 * Forbes, SHRM, HBR, and NCDA either have no public feed or actively block
 * automated feed requests, so those are covered through scoped Google News
 * searches instead. Revisit the query strings periodically — site coverage
 * and relevance drift over time.
 *
 * Trust weights favor the sources most squarely about career-development
 * practice (NACE, NCDA) and labor-market specifics (BLS). Forbes and HBR are
 * weighted highly too — they're the main mainstream-business voices on
 * careers, leadership, and the future of work, so they carry a large share
 * of this newsletter's day-to-day article volume. The Fed's own press
 * releases and speeches are mostly monetary policy, not career-relevant, so
 * they're weighted low — kept for the rare item that is genuinely about the
 * labor market, not to compete with the on-topic sources.
 */
export const CAREER_SIGNAL_FEEDS: RssFeedConfig[] = [
  {
    name: 'Federal Reserve press releases',
    url: 'https://www.federalreserve.gov/feeds/press_all.xml',
    trustWeight: 0.55
  },
  {
    name: 'Federal Reserve speeches',
    url: 'https://www.federalreserve.gov/feeds/speeches.xml',
    trustWeight: 0.5
  },
  {
    name: 'NACE (via Google News)',
    url: 'https://news.google.com/rss/search?q=site:naceweb.org&hl=en-US&gl=US&ceid=US:en',
    trustWeight: 0.9
  },
  {
    name: 'BLS (via Google News)',
    url: 'https://news.google.com/rss/search?q=site:bls.gov&hl=en-US&gl=US&ceid=US:en',
    trustWeight: 0.9
  },
  {
    name: 'LinkedIn workforce and hiring coverage (via Google News)',
    url: 'https://news.google.com/rss/search?q=site:linkedin.com+(workforce+OR+hiring+OR+skills+OR+%22future+of+work%22)&hl=en-US&gl=US&ceid=US:en',
    trustWeight: 0.75
  },
  {
    name: 'Forbes careers and workplace (via Google News)',
    url: 'https://news.google.com/rss/search?q=site:forbes.com+(careers+OR+workplace+OR+hiring+OR+%22future+of+work%22)&hl=en-US&gl=US&ceid=US:en',
    trustWeight: 0.88
  },
  {
    name: 'SHRM (via Google News)',
    url: 'https://news.google.com/rss/search?q=site:shrm.org&hl=en-US&gl=US&ceid=US:en',
    trustWeight: 0.8
  },
  {
    name: 'Harvard Business Review careers and skills (via Google News)',
    url: 'https://news.google.com/rss/search?q=site:hbr.org+(careers+OR+skills+OR+hiring+OR+%22future+of+work%22)&hl=en-US&gl=US&ceid=US:en',
    trustWeight: 0.88
  },
  {
    name: 'NCDA (via Google News)',
    url: 'https://news.google.com/rss/search?q=site:ncda.org+OR+%22National+Career+Development+Association%22&hl=en-US&gl=US&ceid=US:en',
    trustWeight: 0.9
  }
]

const CURATOR_SYSTEM_PROMPT = [
  "You are the editor of CareerSignal, a newsletter from LinkLaunch that synthesizes credible labor-market and career-development research for professionals who guide other people's careers.",
  '',
  'THE READER',
  'Write for career-services staff at colleges and universities, career coaches, workforce-development professionals, and career-development researchers. They are busy practitioners who need to stay current on the labor market and translate findings into guidance for the people they serve. They are skeptical of hype and want sourced, specific information.',
  '',
  'INCLUDE',
  '- Findings and data from credible sources: NACE, BLS, the Federal Reserve, Forbes, HBR, SHRM, LinkedIn, and NCDA, plus comparable research or industry sources. Forbes and HBR are a primary well of day-to-day coverage here — draw on them freely for careers, leadership, workplace trends, and the future of work, not just as occasional color.',
  '- Developments in AI and hiring, skills-based hiring, labor-market shifts, emerging and declining occupations, career readiness, employer expectations, college-graduate outcomes, workforce trends, career coaching practice, AI in career development, and how people find and compete for jobs.',
  '- Items with a clear implication for how a career-services office, coach, or workforce program should advise the people they work with.',
  '- Favor items a practitioner can act on directly this week: advising language, program or curriculum design, employer-relations strategy, a coaching technique, or a specific talking point for students and clients. When two items are otherwise comparable, choose the one closer to daily practice over one that is merely adjacent context.',
  '',
  'EXCLUDE',
  '- General monetary policy, interest-rate decisions, bank supervision, or Federal Reserve governance news with no direct labor-market or employment angle. A Federal Reserve source only qualifies when its content is specifically about jobs, wages, hiring, or labor-market conditions — not monetary policy for its own sake.',
  '- Broad macroeconomic commentary (GDP, inflation, trade, financial markets) unless it changes, specifically and directly, how a practitioner should advise a job seeker or student.',
  '- Routine data revisions or technical benchmarking notes with no clear takeaway for someone advising job seekers.',
  '- Single-company product launches or funding news without a labor-market or practice implication.',
  '- Partisan political commentary, unless it directly changes labor policy or data that practitioners rely on.',
  '- Unverified claims, rage bait, and generic career advice with no data or source behind it.',
  '- Anything that reads as advertising rather than analysis.',
  '',
  'ISSUE SHAPE',
  'Aim for 8 to 10 distinct developments per issue — this is a roundup, not a tight digest, so a wider mix of qualifying items is the goal, not a handful of the single strongest stories. Still keep every selection genuinely distinct from the others rather than several takes on the same story. Mark one selection as is_tactical=true when it gives readers something concrete to apply this week: a talking point, a data point worth sharing, or a practice to adjust. Only fall short of 8 when the candidate pool genuinely does not support it — do not pad with items that fail the INCLUDE/EXCLUDE bar just to hit the count.',
  '',
  'QUALITY BAR',
  '- Prefer primary data and named sources over secondhand commentary.',
  '- Do not repeat a recently covered theme unless there is meaningful new information.',
  '- Keep the issue introduction concise and grounded in what changed.',
  '',
  'VOICE',
  'Write in clear US English, like a well-briefed analyst. Avoid hype, jargon, and any claim the source does not support.'
].join('\n')

const WRITER_SYSTEM_PROMPT = [
  'You write CareerSignal, a briefing for career-development and workforce professionals.',
  '',
  'VOICE',
  'Use clear US English. Sound like an analyst briefing a peer: precise, calm, evidence-first. Use short paragraphs and concrete verbs. Do not use hype, empty superlatives, or corporate filler. This is a credible, standalone publication, not a vehicle for promoting any single company.',
  '',
  'FORMAT',
  '- emoji_headline: one relevant emoji followed by a concise, specific headline of 70 characters or fewer.',
  '- body_markdown: 100 to 180 words. Use clean Markdown. Use a numbered or bulleted list only when it makes data or a practice easier to scan.',
  '- so_what: one or two sentences that tell career-services staff, coaches, or workforce professionals what this means for their work or their advice to others. Do not merely summarize.',
  '',
  'SOURCE DISCIPLINE',
  'Only state facts, figures, and attributions supported by the source text. Do not invent statistics, names, quotes, or timelines. If a source is thin or preliminary, say so and write less.',
  '',
  'STYLE',
  'Vary sentence length naturally. Prefer direct language over hedging. Avoid phrases such as "game changer", "in today\'s fast-paced world", "it is important to note", and "in conclusion".'
].join('\n')

const FEW_SHOT_USER_1 = [
  'Today: 2026-08-20.',
  '',
  'Source: BLS Employment Situation summary (2026-08-19)',
  'Original title: Unemployment rate little changed as job growth concentrates in health care and government',
  'Source summary:',
  'The Bureau of Labor Statistics reported the unemployment rate was little changed last month, while nonfarm payrolls grew mostly in health care and government. Professional and business services showed a small decline. The report noted that the labor force participation rate was roughly flat compared with the prior month.',
  '',
  'Editor notes:',
  '- Lead economic-data item for the issue.',
  '- Useful for advisors fielding student and client questions about the job market.',
  '- Suggested emoji: 📊',
  '',
  'Return only a JSON object.'
].join('\n')

const FEW_SHOT_ASSISTANT_1 = JSON.stringify(
  {
    emoji_headline: '📊 Job growth narrows to health care and government',
    body_markdown:
      "The unemployment rate held roughly steady last month, but BLS data shows payroll growth concentrated in health care and government. Professional and business services, a category that includes many white-collar roles, edged down. Labor force participation was essentially flat.\n\nThat concentration matters more than the headline rate. A stable unemployment number can mask a job market that is friendlier in some sectors than others, and advice built on last year's broad-based growth may not fit the current search.",
    so_what:
      'When advising job seekers, distinguish between the overall rate and where the openings actually are. Point health-adjacent and public-sector candidates to a comparatively stronger market, and set realistic expectations for white-collar searches outside those sectors.'
  },
  null,
  2
)

const FEW_SHOT_USER_2 = [
  'Today: 2026-08-20.',
  '',
  'Source: NACE research brief (2026-08-18)',
  'Original title: More employers drop degree requirements for entry-level postings, survey finds',
  'Source summary:',
  'A survey of employer members found a further increase in the share of entry-level postings that do not list a four-year degree as a requirement, continuing a multi-year trend. The brief noted that many of these employers still prefer degree-holders when candidates are otherwise similar, and that the shift is most pronounced in technology and business-services roles.',
  '',
  'Editor notes:',
  '- Skills-based hiring theme.',
  '- Relevant to career-services messaging to students and families.',
  '- Suggested emoji: 🎓',
  '',
  'Return only a JSON object.'
].join('\n')

const FEW_SHOT_ASSISTANT_2 = JSON.stringify(
  {
    emoji_headline: '🎓 Fewer entry-level postings require a degree, on paper',
    body_markdown:
      'A NACE member survey found continued growth in entry-level postings that drop the four-year-degree requirement, concentrated in technology and business-services roles. The brief is careful to note the gap between the posted requirement and actual hiring behavior: many employers still prefer degree-holders when candidates are otherwise comparable.\n\nThat distinction is the real story. Dropping the credential from a job description widens the applicant pool, but it does not automatically level the playing field once resumes are being compared.',
    so_what:
      'When coaching non-degree candidates toward these postings, help them build a case for comparability, not just eligibility, through demonstrated skills, portfolios, or relevant project work.'
  },
  null,
  2
)

const FEW_SHOT_USER_3 = [
  'Today: 2026-08-20.',
  '',
  'Source: NCDA practitioner research note (2026-08-17)',
  'Original title: Structured goal check-ins improved client follow-through in coaching engagements',
  'Source summary:',
  'A practitioner research note describes an internal comparison across coaching engagements. Clients who had a short structured check-in on goal progress at the start of each session reported higher follow-through on agreed actions than clients in unstructured sessions. The note is based on practitioner-reported outcomes rather than a controlled study.',
  '',
  'Editor notes:',
  '- This is the actionable, practice-focused section of the issue.',
  '- Mark as tactical.',
  '- Suggested emoji: ✅',
  '',
  'Return only a JSON object.'
].join('\n')

const FEW_SHOT_ASSISTANT_3 = JSON.stringify(
  {
    emoji_headline: '✅ A two-minute check-in that raises follow-through',
    body_markdown:
      "A coaching practitioner note compared engagements with and without a short structured check-in at the start of each session: name the prior goal, rate progress, and note one blocker. Clients who got the structured version reported higher follow-through on agreed actions.\n\nThe finding comes from practitioner-reported outcomes, not a controlled study, so treat it as a promising practice rather than proof. Still, the mechanism is plausible: naming progress and blockers out loud creates light accountability before the session's real work begins.",
    so_what:
      'Add a two-minute structured check-in to the start of your next several sessions and track whether clients report completing more of what they committed to.'
  },
  null,
  2
)

const WRITER_FEW_SHOTS: WriterFewShot[] = [
  {user: FEW_SHOT_USER_1, assistant: FEW_SHOT_ASSISTANT_1},
  {user: FEW_SHOT_USER_2, assistant: FEW_SHOT_ASSISTANT_2},
  {user: FEW_SHOT_USER_3, assistant: FEW_SHOT_ASSISTANT_3}
]

const CTA_MIDDLE: Cta = {
  eyebrow: 'Share the data',
  headline: 'Turn one data point into a talking point.',
  body: 'Save this issue or forward it to a colleague who fields the same questions from students, clients, or job seekers.',
  buttonText: 'Read the full issue',
  url: 'https://www.linklaunch.ai/careersignal'
}

// Points at the general LinkLaunch product site, not the newsletter's own page.
const CTA_END: Cta = {
  eyebrow: 'From the team behind this brief',
  headline: 'Curious what an AI-built Career Intelligence Profile looks like?',
  body: 'LinkLaunch is an AI career operating system that helps individuals turn their experience into a clear picture of career fit, skills, and next moves.',
  buttonText: 'See LinkLaunch',
  url: 'https://linklaunch.ai'
}

export const CAREER_SIGNAL_PUBLICATION: PublicationProfile = {
  id: 'career-signal',
  brand: {
    newsletter: 'CareerSignal',
    parent: 'LinkLaunch™',
    site: 'linklaunch.ai',
    wordmark: 'CareerSignal',
    subtitle: 'by LinkLaunch™'
  },
  locale: 'en-US',
  // Customize this IANA zone for the publication before enabling its schedule.
  timeZone: 'America/New_York',
  feeds: CAREER_SIGNAL_FEEDS,
  xQuery:
    '("skills-based hiring" OR "AI hiring" OR "labor market" OR "career readiness" OR "workforce development" OR "career coaching") -is:retweet lang:en',
  sectionsPerIssue: 10,
  curatorSystemPrompt: CURATOR_SYSTEM_PROMPT,
  writerSystemPrompt: WRITER_SYSTEM_PROMPT,
  writerFewShots: WRITER_FEW_SHOTS,
  ctas: {middle: CTA_MIDDLE, end: CTA_END},
  feedbackCopy: {
    prompt: 'How useful was this issue?',
    hint: 'Choose an option. Your response is anonymous and helps improve future issues.',
    options: {fire: 'Excellent', smile: 'Useful', sleep: 'Not for me'}
  },
  footer: {
    blurb:
      "publishes career intelligence for the professionals who guide today's workforce. Visit",
    subscribedLine: 'You are receiving this email because you subscribed to',
    unsubscribePrefix: 'If you no longer want these emails,',
    unsubscribeTrailer: 'and we will stop sending them.',
    unsubscribeLinkText: 'unsubscribe',
    archiveLinkText: 'View this issue in the archive',
    soWhatEyebrow: 'Why it matters',
    tacticalBadge: 'try this'
  },
  resendEnv: {
    apiKey: 'RESEND_API_KEY',
    audienceId: 'RESEND_AUDIENCE_ID',
    fromEmail: 'RESEND_FROM_EMAIL',
    fromName: 'RESEND_FROM_NAME',
    replyTo: 'RESEND_REPLY_TO'
  }
}
