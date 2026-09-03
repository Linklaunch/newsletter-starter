import assert from 'node:assert/strict'
import test from 'node:test'
import {trySyncContactToHubspot, upsertHubspotContact} from './hubspot-sync'

async function withHubspotEnv(
  vars: {enabled?: string; token?: string},
  run: () => Promise<void>
): Promise<void> {
  const previousEnabled = process.env.HUBSPOT_SYNC_ENABLED
  const previousToken = process.env.HUBSPOT_ACCESS_TOKEN
  process.env.HUBSPOT_SYNC_ENABLED = vars.enabled
  process.env.HUBSPOT_ACCESS_TOKEN = vars.token
  try {
    await run()
  } finally {
    process.env.HUBSPOT_SYNC_ENABLED = previousEnabled
    process.env.HUBSPOT_ACCESS_TOKEN = previousToken
  }
}

test('upsertHubspotContact rejects before network I/O when the sync is disabled', async () => {
  const originalFetch = globalThis.fetch
  let fetchCalls = 0
  globalThis.fetch = (async () => {
    fetchCalls++
    return new Response(null, {status: 500})
  }) as typeof fetch
  try {
    await withHubspotEnv(
      {enabled: 'false', token: 'configured-token'},
      async () => {
        await assert.rejects(() =>
          upsertHubspotContact({email: 'reader@valid.test'})
        )
      }
    )
    assert.equal(fetchCalls, 0)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('upsertHubspotContact rejects when enabled but no token is configured', async () => {
  await withHubspotEnv({enabled: 'true', token: undefined}, async () => {
    await assert.rejects(() =>
      upsertHubspotContact({email: 'reader@valid.test'})
    )
  })
})

test('upsertHubspotContact sends a batch upsert keyed by email with only the provided name fields', async () => {
  const originalFetch = globalThis.fetch
  let capturedUrl: string | undefined
  let capturedInit: RequestInit | undefined
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    capturedUrl = url
    capturedInit = init
    return new Response(null, {status: 200})
  }) as typeof fetch
  try {
    await withHubspotEnv(
      {enabled: 'true', token: 'configured-token'},
      async () => {
        await upsertHubspotContact({
          email: 'reader@valid.test',
          firstName: 'Jane',
          lastName: null
        })
      }
    )
    assert.equal(
      capturedUrl,
      'https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert'
    )
    assert.equal(
      (capturedInit?.headers as Record<string, string>).Authorization,
      'Bearer configured-token'
    )
    const body = JSON.parse(capturedInit?.body as string)
    assert.deepEqual(body, {
      inputs: [
        {
          id: 'reader@valid.test',
          idProperty: 'email',
          properties: {email: 'reader@valid.test', firstname: 'Jane'}
        }
      ]
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('trySyncContactToHubspot swallows failures and returns false instead of throwing', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () =>
    new Response('bad request', {status: 400})) as typeof fetch
  try {
    await withHubspotEnv(
      {enabled: 'true', token: 'configured-token'},
      async () => {
        const result = await trySyncContactToHubspot({
          email: 'reader@valid.test'
        })
        assert.equal(result, false)
      }
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})
