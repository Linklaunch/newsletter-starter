import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addSubscriber,
  maskEmail,
  normalizeEmail,
  resolveSubscribeConfig,
  validateSubscribeBody
} from './subscribe'
import type {PublicationProfile} from '../publications/types'

const publication = {
  resendEnv: {
    apiKey: 'RESEND_API_KEY',
    audienceId: 'RESEND_AUDIENCE_ID',
    fromEmail: 'RESEND_FROM_EMAIL',
    fromName: 'RESEND_FROM_NAME',
    replyTo: 'RESEND_REPLY_TO'
  }
} as unknown as PublicationProfile

function withEnv(
  values: Record<string, string | undefined>,
  run: () => void
): void {
  const previous: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  try {
    run()
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

/**
 * Removes a variable rather than assigning undefined to it: in Node,
 * `process.env.X = undefined` stores the string "undefined", which the
 * capability gates would then read as a configured value.
 */
function unsetEnv(name: string): void {
  delete process.env[name]
}

test('normalizeEmail trims and lowercases', () => {
  assert.equal(normalizeEmail('  A@B.COM '), 'a@b.com')
  assert.equal(normalizeEmail(undefined), '')
  assert.equal(normalizeEmail(42), '')
})

test('validateSubscribeBody accepts a normal address', () => {
  const result = validateSubscribeBody({email: 'reader@example.org'})
  assert.deepEqual(result, {ok: true, email: 'reader@example.org'})
})

test('validateSubscribeBody normalises before accepting', () => {
  const result = validateSubscribeBody({email: '  Reader@Example.ORG  '})
  assert.deepEqual(result, {ok: true, email: 'reader@example.org'})
})

test('validateSubscribeBody rejects a missing address', () => {
  assert.deepEqual(validateSubscribeBody({}), {ok: false, reason: 'missing'})
  assert.deepEqual(validateSubscribeBody({email: '   '}), {
    ok: false,
    reason: 'missing'
  })
  assert.deepEqual(validateSubscribeBody(null), {ok: false, reason: 'missing'})
})

test('validateSubscribeBody rejects malformed addresses', () => {
  for (const email of [
    'not-an-email',
    'missing@domain',
    '@example.org',
    'two@@example.org',
    'spaces in@example.org'
  ]) {
    const result = validateSubscribeBody({email})
    assert.equal(result.ok, false, `${email} should be rejected`)
  }
})

test('validateSubscribeBody rejects an over-long address', () => {
  const email = `${'a'.repeat(250)}@example.org`
  assert.deepEqual(validateSubscribeBody({email}), {
    ok: false,
    reason: 'too_long'
  })
})

test('validateSubscribeBody rejects a filled honeypot even with a valid email', () => {
  const result = validateSubscribeBody({
    email: 'reader@example.org',
    website: 'http://spam.example'
  })
  assert.deepEqual(result, {ok: false, reason: 'honeypot'})
})

test('resolveSubscribeConfig needs both the key and the audience', () => {
  withEnv(
    {RESEND_API_KEY: 'test-key', RESEND_AUDIENCE_ID: 'aud_1'},
    () => {
      assert.deepEqual(resolveSubscribeConfig(publication), {
        apiKey: 'test-key',
        audienceId: 'aud_1'
      })
    }
  )
  withEnv({RESEND_API_KEY: 'test-key', RESEND_AUDIENCE_ID: undefined}, () => {
    assert.equal(resolveSubscribeConfig(publication), null)
  })
  withEnv({RESEND_API_KEY: undefined, RESEND_AUDIENCE_ID: 'aud_1'}, () => {
    assert.equal(resolveSubscribeConfig(publication), null)
  })
})

test('resolveSubscribeConfig does not require send configuration', () => {
  // A signup sends nothing, so a missing from-address must not block it.
  withEnv(
    {
      RESEND_API_KEY: 'test-key',
      RESEND_AUDIENCE_ID: 'aud_1',
      RESEND_FROM_EMAIL: undefined,
      RESEND_REPLY_TO: undefined
    },
    () => {
      assert.ok(resolveSubscribeConfig(publication))
    }
  )
})

test('resolveSubscribeConfig rejects placeholder values', () => {
  withEnv(
    {RESEND_API_KEY: 'replace_me', RESEND_AUDIENCE_ID: 'aud_1'},
    () => {
      assert.equal(resolveSubscribeConfig(publication), null)
    }
  )
})

test('maskEmail keeps the domain and hides the local part', () => {
  assert.equal(maskEmail('reader@example.org'), 're****@example.org')
  assert.equal(maskEmail('broken'), '***')
})

// --- addSubscriber, with the network stubbed -------------------------------

interface StubCall {
  url: string
  init: RequestInit
}

function stubFetch(status: number): {calls: StubCall[]; restore: () => void} {
  const calls: StubCall[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({url: String(url), init})
    return new Response(status === 200 ? '{}' : '', {status})
  }) as unknown as typeof fetch
  return {calls, restore: () => {
    globalThis.fetch = original
  }}
}

test('addSubscriber posts to the audience the broadcast targets', async () => {
  process.env.NEWSLETTER_SUBSCRIPTION_ENABLED = 'true'
  const stub = stubFetch(200)
  try {
    const outcome = await addSubscriber('reader@example.org', {
      apiKey: 'test-key',
      audienceId: 'aud_42'
    })
    assert.deepEqual(outcome, {status: 'added'})
    assert.equal(stub.calls.length, 1)
    const call = stub.calls[0]
    assert.ok(call)
    assert.equal(call.url, 'https://api.resend.com/audiences/aud_42/contacts')
    assert.equal(call.init.method, 'POST')
    assert.deepEqual(JSON.parse(String(call.init.body)), {
      email: 'reader@example.org',
      unsubscribed: false
    })
  } finally {
    stub.restore()
    unsetEnv('NEWSLETTER_SUBSCRIPTION_ENABLED')
  }
})

test('addSubscriber reports 409 as already subscribed, not as a failure', async () => {
  process.env.NEWSLETTER_SUBSCRIPTION_ENABLED = 'true'
  const stub = stubFetch(409)
  try {
    const outcome = await addSubscriber('reader@example.org', {
      apiKey: 'test-key',
      audienceId: 'aud_42'
    })
    assert.deepEqual(outcome, {status: 'already_subscribed'})
  } finally {
    stub.restore()
    unsetEnv('NEWSLETTER_SUBSCRIPTION_ENABLED')
  }
})

test('addSubscriber reports other errors as failures with the status', async () => {
  process.env.NEWSLETTER_SUBSCRIPTION_ENABLED = 'true'
  const stub = stubFetch(422)
  try {
    const outcome = await addSubscriber('reader@example.org', {
      apiKey: 'test-key',
      audienceId: 'aud_42'
    })
    assert.deepEqual(outcome, {status: 'failed', httpStatus: 422})
  } finally {
    stub.restore()
    unsetEnv('NEWSLETTER_SUBSCRIPTION_ENABLED')
  }
})

test('addSubscriber refuses to call Resend while the subscription gate is off', async () => {
  unsetEnv('NEWSLETTER_SUBSCRIPTION_ENABLED')
  const stub = stubFetch(200)
  try {
    await assert.rejects(() =>
      addSubscriber('reader@example.org', {
        apiKey: 'test-key',
        audienceId: 'aud_42'
      })
    )
    assert.equal(stub.calls.length, 0, 'no network call may be made')
  } finally {
    stub.restore()
  }
})

test('addSubscriber is not blocked by the delivery gate', async () => {
  // Adding a contact sends nothing, so it must not require delivery to be on.
  process.env.NEWSLETTER_SUBSCRIPTION_ENABLED = 'true'
  unsetEnv('NEWSLETTER_DELIVERY_ENABLED')
  const stub = stubFetch(200)
  try {
    const outcome = await addSubscriber('reader@example.org', {
      apiKey: 'test-key',
      audienceId: 'aud_42'
    })
    assert.deepEqual(outcome, {status: 'added'})
  } finally {
    stub.restore()
    unsetEnv('NEWSLETTER_SUBSCRIPTION_ENABLED')
  }
})
