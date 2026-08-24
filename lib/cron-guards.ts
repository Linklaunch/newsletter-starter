/** Validate a scheduler request without exposing whether automation is enabled. */
export function isAuthorizedCronRequest(
  authorization: string | null,
  secret: string | null
): boolean {
  return Boolean(secret) && authorization === `Bearer ${secret}`
}

/** Automation never runs until explicitly enabled and at least one publication is selected. */
export function shouldRunAutomation(
  automationEnabled: boolean,
  publicationCount: number
): boolean {
  return automationEnabled && publicationCount > 0
}
