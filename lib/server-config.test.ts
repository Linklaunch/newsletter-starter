import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isConfiguredValue,
  parseCommaList,
  parseEmailAllowlist,
  parseOptIn,
  resolveImageGenerationCredentials
} from './server-config-core'

test('opt-in parsing only enables exact true or 1', () => {
  assert.equal(parseOptIn('true'), true)
  assert.equal(parseOptIn(' 1 '), true)
  assert.equal(parseOptIn('TRUE'), true)
  assert.equal(parseOptIn('yes'), false)
  assert.equal(parseOptIn('on'), false)
  assert.equal(parseOptIn(undefined), false)
})

test('configured values reject common placeholders', () => {
  assert.equal(isConfiguredValue('replace_me'), false)
  assert.equal(isConfiguredValue('replace-with-value'), false)
  assert.equal(isConfiguredValue('your-token'), false)
  assert.equal(isConfiguredValue('operator@example.com'), false)
  assert.equal(isConfiguredValue('configured-value'), true)
})

test('lists trim values and email allowlists discard invalid entries', () => {
  assert.deepEqual(parseCommaList(' one, , two '), ['one', 'two'])
  assert.deepEqual(
    [
      ...parseEmailAllowlist(' Operator@valid.test, invalid, test@example.com ')
    ],
    ['operator@valid.test']
  )
})

test('image capability requires opt-in and every non-placeholder credential', () => {
  const configured = {
    enabled: 'true',
    apiKey: 'configured-image-key',
    baseUrl: 'https://images.valid.test/v1',
    model: 'image-model',
    blobToken: 'configured-blob-token'
  }
  assert.deepEqual(resolveImageGenerationCredentials(configured), {
    apiKey: configured.apiKey,
    baseUrl: configured.baseUrl,
    model: configured.model,
    blobToken: configured.blobToken
  })
  assert.equal(
    resolveImageGenerationCredentials({...configured, enabled: 'false'}),
    null
  )
  assert.equal(
    resolveImageGenerationCredentials({...configured, apiKey: 'replace_me'}),
    null
  )
  assert.equal(
    resolveImageGenerationCredentials({
      ...configured,
      baseUrl: 'https://example.com'
    }),
    null
  )
  assert.equal(
    resolveImageGenerationCredentials({...configured, model: ''}),
    null
  )
  assert.equal(
    resolveImageGenerationCredentials({...configured, blobToken: 'your-token'}),
    null
  )
})
