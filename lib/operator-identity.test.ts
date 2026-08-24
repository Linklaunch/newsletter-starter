import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)

test('proxy and server configuration contain no hardcoded operator email identity', async () => {
  const [proxySource, configSource] = await Promise.all([
    readFile(new URL('proxy.ts', root), 'utf8'),
    readFile(new URL('lib/server-config.ts', root), 'utf8')
  ])
  const emailLiteral = /['"`][^'"`\s]+@[^'"`\s]+['"`]/
  assert.doesNotMatch(proxySource, emailLiteral)
  assert.doesNotMatch(configSource, emailLiteral)
  assert.match(proxySource, /operatorEmailAllowlist/)
  assert.match(configSource, /OPERATOR_EMAIL_ALLOWLIST/)
})
