/** Index registered publications by id, rejecting duplicate registrations. */
export function indexPublications<T extends {id: string}>(
  publications: readonly T[]
): Record<string, T> {
  const indexed: Record<string, T> = {}
  for (const publication of publications) {
    if (indexed[publication.id]) {
      throw new Error(
        `duplicate publication id "${publication.id}" is registered twice`
      )
    }
    indexed[publication.id] = publication
  }
  if (publications.length === 0) {
    throw new Error('no publications are registered')
  }
  return indexed
}

/**
 * Check that the server-side profile registry and the client-safe display
 * registry describe the same set of publications. A mismatch means the console
 * would offer a publication it cannot draft, or hide one it can.
 */
export function assertPublicationRegistryMatches(
  profileIds: readonly string[],
  displayIds: readonly string[]
): void {
  const missingDisplay = profileIds.filter(id => !displayIds.includes(id))
  const missingProfile = displayIds.filter(id => !profileIds.includes(id))
  if (missingDisplay.length === 0 && missingProfile.length === 0) return
  const problems = [
    missingDisplay.length > 0
      ? `missing from PUBLICATION_DISPLAYS: ${missingDisplay.join(', ')}`
      : '',
    missingProfile.length > 0
      ? `missing an editorial profile: ${missingProfile.join(', ')}`
      : ''
  ].filter(Boolean)
  throw new Error(`publication registries disagree  -  ${problems.join('; ')}`)
}

/** Resolve configured publication ids without reading environment variables. */
export function resolveEnabledPublications<T extends {id: string}>(
  values: readonly string[],
  publications: Readonly<Partial<Record<string, T>>>
): T[] {
  const seen = new Set<string>()
  const resolved: T[] = []
  for (const value of values) {
    const id = value.trim().toLowerCase()
    if (!id) continue
    const publication = publications[id]
    if (!publication) {
      throw new Error(
        `NEWSLETTER_ENABLED_PUBLICATIONS contains unknown publication "${id}"`
      )
    }
    if (seen.has(id)) continue
    seen.add(id)
    resolved.push(publication)
  }
  return resolved
}
