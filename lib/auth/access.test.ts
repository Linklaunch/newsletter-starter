import assert from 'node:assert/strict'
import test from 'node:test'
import {hasOperatorAccessConfiguration, isAllowlistedOperator} from './access'

const configuredAuth = {
  baseUrl: 'https://auth.valid.test',
  cookieSecret: 'configured-cookie-secret'
}
const allowlist = new Set(['operator@valid.test'])

test('operator access configuration denies by default', () => {
  assert.equal(hasOperatorAccessConfiguration(null, allowlist), false)
  assert.equal(hasOperatorAccessConfiguration(configuredAuth, new Set()), false)
  assert.equal(hasOperatorAccessConfiguration(configuredAuth, allowlist), true)
})

test('only a normalized allowlisted identity is accepted', () => {
  assert.equal(isAllowlistedOperator(undefined, allowlist), false)
  assert.equal(isAllowlistedOperator('other@valid.test', allowlist), false)
  assert.equal(isAllowlistedOperator(' Operator@Valid.Test ', allowlist), true)
})
