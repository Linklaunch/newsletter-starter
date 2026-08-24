import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import test from 'node:test'
import {
  verifySvixSignature,
  verifyWebhookPayload
} from './resend-webhook-security'

const secretBytes = Buffer.from('test-webhook-secret')
const secret = `whsec_${secretBytes.toString('base64')}`
const body = JSON.stringify({
  type: 'email.bounced',
  data: {to: ['reader@valid.test']}
})

function signedHeaders(payload = body): Headers {
  const id = 'msg_test'
  const timestamp = '1700000000'
  const signature = crypto
    .createHmac('sha256', secretBytes)
    .update(`${id}.${timestamp}.${payload}`)
    .digest('base64')
  return new Headers({
    'svix-id': id,
    'svix-timestamp': timestamp,
    'svix-signature': `v1,${signature}`
  })
}

test('webhook signatures reject malformed or mismatched values', () => {
  assert.equal(verifySvixSignature(body, new Headers(), secret), false)
  assert.equal(verifySvixSignature(`${body}x`, signedHeaders(), secret), false)
  assert.equal(verifySvixSignature(body, signedHeaders(), secret), true)
})

test('invalid signatures are rejected before payload parsing or later mutation work', () => {
  let parseCalls = 0
  const result = verifyWebhookPayload(
    '{not json}',
    new Headers(),
    secret,
    () => {
      parseCalls++
      throw new Error('parser should not run')
    }
  )
  assert.deepEqual(result, {valid: false, error: 'invalid signature'})
  assert.equal(parseCalls, 0)
})

test('a signed invalid JSON payload reports invalid JSON after verification', () => {
  const result = verifyWebhookPayload(
    '{not json}',
    signedHeaders('{not json}'),
    secret
  )
  assert.deepEqual(result, {valid: false, error: 'invalid JSON'})
})
