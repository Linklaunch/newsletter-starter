import assert from 'node:assert/strict'
import test from 'node:test'
import {sendPromo} from '../lib/promo-actions'
import {
  cancelBroadcast,
  deleteBroadcast,
  deleteContactByEmail
} from './email-sender'
import {resendFetch, resendMutationFetch} from './resend-http'

async function withDeliveryDisabled(run: () => Promise<void>): Promise<void> {
  const previous = process.env.NEWSLETTER_DELIVERY_ENABLED
  const originalFetch = globalThis.fetch
  let fetchCalls = 0
  process.env.NEWSLETTER_DELIVERY_ENABLED = 'false'
  globalThis.fetch = (async () => {
    fetchCalls++
    return new Response(null, {status: 500})
  }) as typeof fetch
  try {
    await run()
    assert.equal(fetchCalls, 0)
  } finally {
    globalThis.fetch = originalFetch
    if (previous === undefined)
      process.env.NEWSLETTER_DELIVERY_ENABLED = undefined
    else process.env.NEWSLETTER_DELIVERY_ENABLED = previous
  }
}

test('every Resend mutation funnel rejects before network I/O when delivery is disabled', async () => {
  await withDeliveryDisabled(async () => {
    await assert.rejects(() =>
      resendMutationFetch('/broadcasts', {method: 'POST'}, 'configured-key')
    )
    await assert.rejects(() =>
      resendFetch('/broadcasts/id', {method: 'PATCH'}, 'configured-key')
    )
    await assert.rejects(() =>
      resendFetch('/broadcasts/id', {method: 'PUT'}, 'configured-key')
    )
    await assert.rejects(() =>
      resendFetch('/broadcasts/id', {method: 'DELETE'}, 'configured-key')
    )
  })
})

test('contact deletion and promo delivery fail before database or Resend work when delivery is disabled', async () => {
  await withDeliveryDisabled(async () => {
    await assert.rejects(() =>
      deleteContactByEmail('audience-id', 'reader@valid.test', 'configured-key')
    )
    await assert.rejects(() =>
      cancelBroadcast('broadcast-id', 'configured-key')
    )
    await assert.rejects(() =>
      deleteBroadcast('broadcast-id', 'configured-key')
    )
    await assert.rejects(() => sendPromo('promo-id'))
  })
})
