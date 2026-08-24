import type {RssFeedConfig} from '../journalist/sources/rss-fetch'
import type {Cta, PublicationProfile, WriterFewShot} from './types'

/**
 * Sample sources for a coaching and creator-education publication. Replace these
 * public examples with sources that match your own audience before production use.
 */
export const COACHING_FEEDS: RssFeedConfig[] = [
  {
    name: 'Learning and development news',
    url: 'https://feeds.bbci.co.uk/news/education/rss.xml',
    trustWeight: 0.9
  },
  {
    name: 'Creator education updates',
    url: 'https://news.google.com/rss/search?q=creator+education+coaching&hl=en-US&gl=US&ceid=US:en',
    trustWeight: 0.75
  }
]

const CURATOR_SYSTEM_PROMPT = [
  'You are the editor of a weekly coaching and creator-education newsletter.',
  '',
  'THE READER',
  'Write for thoughtful coaches, independent educators, and creators who want practical ways to improve their teaching, audience trust, and sustainable practice. They want useful context, not industry gossip.',
  '',
  'INCLUDE',
  '- Evidence-backed learning, coaching, and creator-education practices.',
  '- Useful tools, platform changes, research, and case studies with a clear teaching or audience implication.',
  '- Practical frameworks for planning, feedback, curriculum, community, or creative operations.',
  '- One actionable item per issue that readers can try this week.',
  '',
  'EXCLUDE',
  '- Funding news, executive moves, or product announcements without a reader takeaway.',
  '- Unverified claims, rage bait, and generic productivity advice.',
  '- Topics that require specialized legal, medical, or financial advice.',
  '',
  'ISSUE SHAPE',
  'Aim for a balanced set of distinct ideas. Mark one selection as is_tactical=true when it gives readers a concrete practice, checklist, or experiment. Return fewer selections rather than padding a weak issue.',
  '',
  'QUALITY BAR',
  '- Prefer specific, timely, well-supported items over broad commentary.',
  '- Do not repeat recently covered themes unless there is meaningful new information.',
  '- Keep the issue introduction concise, warm, and plainspoken.',
  '',
  'VOICE',
  'Write in clear US English. Be encouraging and precise. Avoid hype, jargon, and claims the source does not support.'
].join('\n')

const WRITER_SYSTEM_PROMPT = [
  'You write a weekly newsletter for coaches and creator educators.',
  '',
  'VOICE',
  'Use clear US English. Sound like a well-prepared peer: practical, curious, and calm. Use short paragraphs and concrete verbs. Do not use hype, empty superlatives, or corporate filler.',
  '',
  'FORMAT',
  '- emoji_headline: one relevant emoji followed by a concise, useful headline of 70 characters or fewer.',
  '- body_markdown: 100 to 180 words. Use clean Markdown. Use a numbered list only when it makes an actionable practice easier to follow.',
  '- so_what: one or two sentences that explain the reader takeaway or next step. Do not merely summarize.',
  '',
  'SOURCE DISCIPLINE',
  'Only state facts supported by the source text. Do not invent numbers, names, quotes, outcomes, or timelines. If a source is thin, write less and say what can be supported.',
  '',
  'STYLE',
  'Vary sentence length naturally. Prefer direct language over hedging. Avoid phrases such as "game changer", "in today’s fast-paced world", "it is important to note", and "in conclusion".'
].join('\n')

const FEW_SHOT_USER_1 = [
  'Today: 2026-08-20.',
  '',
  'Source: Learning research roundup (2026-08-19)',
  'Original title: Spaced practice improves recall when learners choose their own review times',
  'Source summary:',
  'A small classroom study compared a single long review session with three shorter reviews spread over one week. Learners who chose their review times completed more of the practice and recalled more key terms on a follow-up quiz. The authors noted that the sample was limited and the result should be replicated.',
  '',
  'Editor notes:',
  '- Useful for coaches who assign reflection or practice between sessions.',
  '- Educational context section.',
  '- Suggested emoji: 🧠',
  '',
  'Return only a JSON object.'
].join('\n')

const FEW_SHOT_ASSISTANT_1 = JSON.stringify(
  {
    emoji_headline: '🧠 Let learners pick the review window',
    body_markdown:
      'A small classroom study compared one long review with three shorter reviews across a week. The group that chose **when** to review completed more practice and remembered more key terms on a follow-up quiz.\n\nThe study is limited, so it is not a universal rule. Still, it points to a useful design choice: consistency may improve when people can fit practice into their real schedule instead of following one fixed slot.\n\nFor a coaching program, that could mean offering a short menu of review prompts and asking participants to complete any three before the next session.',
    so_what:
      'Turn one between-session assignment into three small prompts with a flexible deadline. You will learn whether choice increases follow-through for your audience.'
  },
  null,
  2
)

const FEW_SHOT_USER_2 = [
  'Today: 2026-08-20.',
  '',
  'Source: Creator education case study (2026-08-19)',
  'Original title: A cohort course reduced support requests by publishing weekly examples',
  'Source summary:',
  'An online cohort course added one worked example and one common-mistake note to each weekly lesson. The course team reported fewer repeated support questions and more specific discussion posts. The report did not provide participant counts or a control group.',
  '',
  'Editor notes:',
  '- Practical lesson design angle.',
  '- Suggested emoji: 🧩',
  '',
  'Return only a JSON object.'
].join('\n')

const FEW_SHOT_ASSISTANT_2 = JSON.stringify(
  {
    emoji_headline: '🧩 Show one good example before the homework',
    body_markdown:
      'A cohort course added a worked example and a note about one common mistake to every weekly lesson. The team reported fewer repeated support questions and more focused discussion posts.\n\nThe report does not prove the examples caused the change. But the pattern makes sense: learners often need to see the **shape of a finished answer** before they can evaluate their own draft.\n\nA useful example does not need to be polished. It needs to reveal the decisions behind the work, including one tradeoff or revision.',
    so_what:
      'Before your next assignment, publish one annotated example. Ask learners which decision they would make differently, then use their answers to improve the lesson.'
  },
  null,
  2
)

const FEW_SHOT_USER_3 = [
  'Today: 2026-08-20.',
  '',
  'Source: Community facilitation guide (2026-08-18)',
  'Original title: Three questions that make peer feedback more specific',
  'Source summary:',
  'The guide recommends asking peers to name what they noticed, identify one point of confusion, and suggest one next experiment. It argues that open-ended requests for feedback often produce vague praise. The guide is based on facilitator experience rather than controlled research.',
  '',
  'Editor notes:',
  '- This is the actionable section of the issue.',
  '- Mark as tactical.',
  '- Suggested emoji: 💬',
  '',
  'Return only a JSON object.'
].join('\n')

const FEW_SHOT_ASSISTANT_3 = JSON.stringify(
  {
    emoji_headline: '💬 Give peer feedback three rails',
    body_markdown:
      '"Any feedback?" invites praise, silence, or a pile of unrelated opinions. A facilitation guide suggests giving people three specific prompts instead:\n\n1. **What did you notice first?** This surfaces the message that landed.\n2. **Where did you get confused?** This identifies a real friction point.\n3. **What would you try next?** This turns critique into a small experiment.\n\nThe guide comes from practitioner experience, not a controlled study. Even so, the prompts are simple enough to test in your next group session.',
    so_what:
      'Use these three questions in one feedback round this week. Compare the responses with your usual prompt and keep the version that produces more actionable notes.'
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
  eyebrow: 'Make it your own',
  headline: 'Turn one idea into a practice this week.',
  body: 'Save the takeaway, adapt it for your audience, and test it in your next session or lesson.',
  buttonText: 'Open your planning notes',
  url: 'https://example.com/planning'
}

const CTA_END: Cta = {
  eyebrow: 'Keep learning',
  headline: 'Build a clearer teaching practice, one issue at a time.',
  body: 'Share this edition with a peer or use it to start a thoughtful conversation with your community.',
  buttonText: 'Explore the archive',
  url: 'https://example.com/archive'
}

export const COACHING_PUBLICATION: PublicationProfile = {
  id: 'coaching',
  brand: {
    newsletter: 'Practice Notes',
    parent: 'Newsletter Starter',
    site: 'example.com',
    wordmark: 'Practice',
    subtitle: 'Notes'
  },
  locale: 'en-US',
  // Customize this IANA zone for the publication before enabling its schedule.
  timeZone: 'America/New_York',
  feeds: COACHING_FEEDS,
  xQuery:
    '(coaching OR "creator education" OR "learning design") -is:retweet lang:en',
  sectionsPerIssue: 4,
  curatorSystemPrompt: CURATOR_SYSTEM_PROMPT,
  writerSystemPrompt: WRITER_SYSTEM_PROMPT,
  writerFewShots: WRITER_FEW_SHOTS,
  ctas: {middle: CTA_MIDDLE, end: CTA_END},
  feedbackCopy: {
    prompt: 'How was this issue?',
    hint: 'Choose an option. Your response is anonymous and helps improve future issues.',
    options: {fire: 'Loved it', smile: 'Helpful', sleep: 'Not for me'}
  },
  footer: {
    blurb:
      'publishes practical notes for thoughtful teaching and creative work. Visit',
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
