import assert from 'node:assert/strict'
import test from 'node:test'
import {composeIssue} from '../journalist/issue-composer'
import type {Section} from '../journalist/section-writer'
import {CAREER_SIGNAL_PUBLICATION} from './career-signal'

test('career signal publication targets career-development professionals', () => {
  assert.equal(CAREER_SIGNAL_PUBLICATION.locale, 'en-US')
  assert.match(
    CAREER_SIGNAL_PUBLICATION.curatorSystemPrompt,
    /career-services staff|career coaches|workforce-development/i
  )
  assert.match(
    CAREER_SIGNAL_PUBLICATION.writerSystemPrompt,
    /clear US English/i
  )
  assert.equal(CAREER_SIGNAL_PUBLICATION.xQuery?.includes('@'), false)
  assert.ok(CAREER_SIGNAL_PUBLICATION.feeds.length > 0)
})

test('composer renders a branded issue for the career signal publication', () => {
  const section: Section = {
    hash: 'test-section',
    emojiHeadline: 'A labor-market data point worth sharing',
    bodyMarkdown: 'Job growth concentrated in a few sectors this month.',
    soWhat: 'Set expectations with clients accordingly.',
    linkUrl: 'https://source.valid.test/article',
    linkText: 'Read the source',
    isTactical: false,
    imageUrl: null
  }
  const composed = composeIssue({
    sections: [section],
    issueIntro: 'One data point worth sharing this week.',
    issueNumber: 1,
    issueDate: new Date('2026-01-15T12:00:00Z'),
    archiveBaseUrl: 'https://archive.valid.test',
    brand: {
      ...CAREER_SIGNAL_PUBLICATION.brand,
      locale: CAREER_SIGNAL_PUBLICATION.locale,
      timeZone: 'UTC',
      ctas: CAREER_SIGNAL_PUBLICATION.ctas,
      feedbackCopy: CAREER_SIGNAL_PUBLICATION.feedbackCopy,
      footer: CAREER_SIGNAL_PUBLICATION.footer
    }
  })
  assert.equal(composed.subject, 'CareerSignal · Issue #1')
  assert.match(composed.html, /A labor-market data point worth sharing/)
  assert.match(composed.html, /RESEND_UNSUBSCRIBE_URL/)
  assert.match(composed.plaintext, /Set expectations with clients accordingly/)
  assert.match(composed.html, /100% free/)
  assert.match(
    composed.html,
    /https:\/\/give\.conservation\.org\/page\/EVER-WEB-TOPNAV/
  )
})
