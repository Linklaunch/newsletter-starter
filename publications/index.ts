import {
  enabledPublicationValues,
  selectedPublication
} from '../lib/server-config'
import {COACHING_PUBLICATION} from './coaching'
import {DEFAULT_PUBLICATION_ID, PUBLICATION_IDS} from './display'
import {
  assertPublicationRegistryMatches,
  indexPublications,
  resolveEnabledPublications
} from './publication-helpers'
import type {PublicationId, PublicationProfile} from './types'

export type {PublicationId, PublicationProfile} from './types'
export type {Cta, FeedbackCopy, PublicationBrand, WriterFewShot} from './types'

/**
 * Register one editorial profile per publication. To add your own, write a
 * profile module beside `coaching.ts`, add it here, and add a matching entry to
 * `PUBLICATION_DISPLAYS` in `display.ts`.
 */
const REGISTERED_PUBLICATIONS: readonly PublicationProfile[] = [
  COACHING_PUBLICATION
]

const PUBLICATIONS = indexPublications(REGISTERED_PUBLICATIONS)

// Fail at startup rather than rendering a console that cannot resolve a
// publication it offers in the picker.
assertPublicationRegistryMatches(Object.keys(PUBLICATIONS), PUBLICATION_IDS)

export const DEFAULT_PUBLICATION: PublicationId = DEFAULT_PUBLICATION_ID

export function isPublicationId(value: string): value is PublicationId {
  return Object.hasOwn(PUBLICATIONS, value)
}

/** Resolve a publication profile by id. */
export function getPublication(id: string): PublicationProfile {
  const publication = PUBLICATIONS[id]
  if (!publication) {
    throw new Error(
      `unknown publication "${id}"  -  expected one of ${Object.keys(PUBLICATIONS).join(', ')}`
    )
  }
  return publication
}

/** The publication used for a manual run. */
export function activePublication(): PublicationProfile {
  const id = selectedPublication()?.toLowerCase()
  return getPublication(id || DEFAULT_PUBLICATION)
}

/**
 * Publications enabled for the scheduled draft job. An unset or blank value is
 * intentionally an empty list, so a fresh deployment cannot draft unexpectedly.
 */
export function enabledPublications(): PublicationProfile[] {
  return resolveEnabledPublications(enabledPublicationValues(), PUBLICATIONS)
}
