import assert from 'node:assert/strict'
import test from 'node:test'
import {nextScheduledSendUtc} from './schedule'

test('nextScheduledSendUtc picks the nearest day in the set, same day if the hour has not passed', () => {
  // Wednesday 2026-09-02 10:00 UTC, target hour 12:00, days Mon/Wed/Fri.
  const now = new Date(Date.UTC(2026, 8, 2, 10, 0, 0))
  const next = nextScheduledSendUtc(
    {sendDaysUtc: [1, 3, 5], sendHourUtc: 12},
    now
  )
  assert.equal(next.toISOString(), '2026-09-02T12:00:00.000Z')
})

test('nextScheduledSendUtc rolls to the next day in the set once the hour has passed today', () => {
  // Wednesday 2026-09-02 13:00 UTC (past the 12:00 slot) -> next is Friday.
  const now = new Date(Date.UTC(2026, 8, 2, 13, 0, 0))
  const next = nextScheduledSendUtc(
    {sendDaysUtc: [1, 3, 5], sendHourUtc: 12},
    now
  )
  assert.equal(next.toISOString(), '2026-09-04T12:00:00.000Z')
})

test('nextScheduledSendUtc wraps across the week boundary', () => {
  // Friday 2026-09-04 13:00 UTC (past the 12:00 slot) -> next is Monday.
  const now = new Date(Date.UTC(2026, 8, 4, 13, 0, 0))
  const next = nextScheduledSendUtc(
    {sendDaysUtc: [1, 3, 5], sendHourUtc: 12},
    now
  )
  assert.equal(next.toISOString(), '2026-09-07T12:00:00.000Z')
})

test('nextScheduledSendUtc works with a single-day set (backward-compatible case)', () => {
  const now = new Date(Date.UTC(2026, 8, 2, 10, 0, 0))
  const next = nextScheduledSendUtc({sendDaysUtc: [3], sendHourUtc: 14}, now)
  assert.equal(next.toISOString(), '2026-09-02T14:00:00.000Z')
})

test('nextScheduledSendUtc rejects an empty day set instead of looping forever', () => {
  assert.throws(() => nextScheduledSendUtc({sendDaysUtc: [], sendHourUtc: 12}))
})
