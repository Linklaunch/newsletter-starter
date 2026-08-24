import assert from 'node:assert/strict'
import test from 'node:test'
import {resolveEnabledPublications} from './publication-helpers'

const registry = {
  coaching: {id: 'coaching', label: 'Coaching'},
  research: {id: 'research', label: 'Research'}
}

test('publication parsing trims, lowercases, and deduplicates enabled ids', () => {
  assert.deepEqual(
    resolveEnabledPublications(
      [' Coaching ', 'research', 'COACHING'],
      registry
    ).map(item => item.id),
    ['coaching', 'research']
  )
})

test('an empty enabled publication list resolves to no publications', () => {
  assert.deepEqual(resolveEnabledPublications([], registry), [])
  assert.deepEqual(resolveEnabledPublications(['', '  '], registry), [])
})

test('unknown enabled publication ids fail closed', () => {
  assert.throws(
    () => resolveEnabledPublications(['unknown'], registry),
    /NEWSLETTER_ENABLED_PUBLICATIONS contains unknown publication/
  )
})
