import assert from 'node:assert/strict'
import test from 'node:test'
import {isAuthorizedCronRequest, shouldRunAutomation} from './cron-guards'

test('cron authorization requires a configured secret and exact bearer value', () => {
  assert.equal(isAuthorizedCronRequest('Bearer configured-secret', null), false)
  assert.equal(isAuthorizedCronRequest(null, 'configured-secret'), false)
  assert.equal(
    isAuthorizedCronRequest('Bearer wrong-secret', 'configured-secret'),
    false
  )
  assert.equal(
    isAuthorizedCronRequest('Bearer configured-secret', 'configured-secret'),
    true
  )
})

test('automation skips when disabled or no publication is enabled', () => {
  assert.equal(shouldRunAutomation(false, 1), false)
  assert.equal(shouldRunAutomation(true, 0), false)
  assert.equal(shouldRunAutomation(true, 2), true)
})
