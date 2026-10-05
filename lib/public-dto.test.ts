import assert from 'node:assert/strict'
import test from 'node:test'
import {toPublicIssueDetailDto, toPublicIssueDto} from './dto'
import type {IssueRow} from '../journalist/runs-log'

const sentIssue = {
  slug: 'career-signal-2026-09-17-issue-001',
  issueNumber: 1,
  subject: 'CareerSignal · Issue #1',
  intro: 'What shifted in hiring this week.',
  bodyHtml: '<h1>Issue</h1>',
  bodyText: 'Issue',
  broadcastId: 'bc_secret',
  dashboardUrl: 'https://resend.com/broadcasts/bc_secret',
  status: 'sent',
  scheduledAt: null,
  createdAt: 1_789_000_000_000,
  publicationId: 'career-signal',
  itemCount: 3,
  sectionDraftCount: 3
} as unknown as IssueRow

test('the public DTO exposes only the published fields', () => {
  const dto = toPublicIssueDto(sentIssue)
  assert.deepEqual(Object.keys(dto).sort(), [
    'intro',
    'issueNumber',
    'publicationId',
    'publishedAt',
    'slug',
    'subject'
  ])
})

test('the public DTO never carries provider identifiers', () => {
  const serialized = JSON.stringify(toPublicIssueDto(sentIssue))
  assert.ok(!serialized.includes('bc_secret'))
  assert.ok(!serialized.includes('resend.com'))
})

test('the public DTO does not expose status or the body', () => {
  const dto = toPublicIssueDto(sentIssue) as unknown as Record<string, unknown>
  assert.equal(dto.status, undefined)
  assert.equal(dto.bodyHtml, undefined)
  assert.equal(dto.bodyText, undefined)
  assert.equal(dto.scheduledAt, undefined)
})

test('a new column on the row cannot leak into the public DTO', () => {
  const withExtra = {
    ...sentIssue,
    internalNote: 'do not publish'
  } as unknown as IssueRow
  const serialized = JSON.stringify(toPublicIssueDto(withExtra))
  assert.ok(!serialized.includes('do not publish'))
})

test('the detail DTO adds the rendered body', () => {
  const dto = toPublicIssueDetailDto(sentIssue)
  assert.ok(dto)
  assert.equal(dto?.bodyHtml, '<h1>Issue</h1>')
  assert.equal(
    (dto as unknown as Record<string, unknown>).broadcastId,
    undefined
  )
})

test('the detail DTO refuses an issue with no rendered body', () => {
  const noBody = {...sentIssue, bodyHtml: null} as unknown as IssueRow
  assert.equal(toPublicIssueDetailDto(noBody), null)
})
