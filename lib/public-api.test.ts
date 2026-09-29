import assert from 'node:assert/strict'
import test from 'node:test'
import {RateLimiter, clientIp, corsHeaders} from './public-api'

const allowed = new Set(['https://www.linklaunch.ai', 'https://linklaunch.ai'])

test('corsHeaders allows a listed origin', () => {
  const headers = corsHeaders('https://www.linklaunch.ai', allowed)
  assert.equal(
    headers['Access-Control-Allow-Origin'],
    'https://www.linklaunch.ai'
  )
  assert.equal(headers.Vary, 'Origin')
})

test('corsHeaders ignores case and a trailing slash', () => {
  assert.ok(corsHeaders('https://WWW.LinkLaunch.ai/', allowed)[
    'Access-Control-Allow-Origin'
  ])
})

test('corsHeaders returns nothing for an origin that is not listed', () => {
  assert.deepEqual(corsHeaders('https://evil.example', allowed), {})
})

test('corsHeaders never falls back to a wildcard', () => {
  const headers = corsHeaders('https://evil.example', allowed)
  assert.equal(headers['Access-Control-Allow-Origin'], undefined)
})

test('corsHeaders returns nothing when there is no origin header', () => {
  assert.deepEqual(corsHeaders(null, allowed), {})
})

test('corsHeaders with an empty allowlist blocks everything', () => {
  assert.deepEqual(corsHeaders('https://www.linklaunch.ai', new Set()), {})
})

test('RateLimiter permits up to the limit and then refuses', () => {
  const limiter = new RateLimiter(3, 1000)
  const now = 1_000_000
  assert.equal(limiter.check('ip', now), true)
  assert.equal(limiter.check('ip', now + 1), true)
  assert.equal(limiter.check('ip', now + 2), true)
  assert.equal(limiter.check('ip', now + 3), false)
})

test('RateLimiter allows again once the window has passed', () => {
  const limiter = new RateLimiter(2, 1000)
  const now = 2_000_000
  limiter.check('ip', now)
  limiter.check('ip', now + 10)
  assert.equal(limiter.check('ip', now + 20), false)
  assert.equal(limiter.check('ip', now + 1500), true)
})

test('RateLimiter counts each caller separately', () => {
  const limiter = new RateLimiter(1, 1000)
  const now = 3_000_000
  assert.equal(limiter.check('a', now), true)
  assert.equal(limiter.check('b', now), true)
  assert.equal(limiter.check('a', now), false)
})

test('retryAfterSeconds reports at least one second while blocked', () => {
  const limiter = new RateLimiter(1, 10_000)
  const now = 4_000_000
  limiter.check('ip', now)
  const wait = limiter.retryAfterSeconds('ip', now + 1000)
  assert.ok(wait >= 1 && wait <= 10, `unexpected wait: ${wait}`)
})

test('clientIp takes the first forwarded address', () => {
  const req = new Request('https://example.org', {
    headers: {'x-forwarded-for': '203.0.113.9, 70.41.3.18'}
  })
  assert.equal(clientIp(req), '203.0.113.9')
})

test('clientIp falls back to x-real-ip, then to unknown', () => {
  assert.equal(
    clientIp(
      new Request('https://example.org', {headers: {'x-real-ip': '198.51.100.7'}})
    ),
    '198.51.100.7'
  )
  assert.equal(clientIp(new Request('https://example.org')), 'unknown')
})
