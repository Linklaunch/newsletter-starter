import assert from 'node:assert/strict'
import test from 'node:test'
import {composeIssue} from '../journalist/issue-composer'
import type {Section} from '../journalist/section-writer'
import {COACHING_PUBLICATION} from './coaching'

test('sample coaching publication is generic English and does not require social sources', () => {
  assert.equal(COACHING_PUBLICATION.locale, 'en-US')
  assert.match(
    COACHING_PUBLICATION.curatorSystemPrompt,
    /coaches, independent educators, and creators/i
  )
  assert.match(COACHING_PUBLICATION.writerSystemPrompt, /clear US English/i)
  assert.equal(COACHING_PUBLICATION.xQuery?.includes('@'), false)
  assert.ok(COACHING_PUBLICATION.feeds.length > 0)
})

test('composer renders a branded issue with optional absent social content', () => {
  const section: Section = {
    hash: 'test-section',
    emojiHeadline: 'A practical review habit',
    bodyMarkdown: 'Try one short review before the next session.',
    soWhat: 'Use the result to improve the next lesson.',
    linkUrl: 'https://source.valid.test/article',
    linkText: 'Read the source',
    isTactical: true,
    imageUrl: null
  }
  const composed = composeIssue({
    sections: [section],
    issueIntro: 'One useful idea for your teaching practice.',
    issueNumber: 1,
    issueDate: new Date('2026-01-15T12:00:00Z'),
    archiveBaseUrl: 'https://archive.valid.test',
    brand: {
      ...COACHING_PUBLICATION.brand,
      locale: COACHING_PUBLICATION.locale,
      timeZone: 'UTC',
      ctas: COACHING_PUBLICATION.ctas,
      feedbackCopy: COACHING_PUBLICATION.feedbackCopy,
      footer: COACHING_PUBLICATION.footer
    }
  })
  assert.equal(composed.subject, 'Practice Notes · Issue #1')
  assert.match(composed.html, /A practical review habit/)
  assert.match(composed.html, /RESEND_UNSUBSCRIBE_URL/)
  assert.match(composed.plaintext, /Use the result to improve the next lesson/)
})
