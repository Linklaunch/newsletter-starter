import {createLogger} from '@lib/logger'
import {assertDeliveryEnabled} from '../lib/server-config'

const log = createLogger('Newsletter:ResendHttp')

const RESEND_API = 'https://api.resend.com'

/*
 * Resend enforces an account-wide 10 requests/second limit. The promo flow is
 * bursty in two ways: `collectEngagedContacts()` pages the email log and the
 * audience contacts IN PARALLEL, and `addContactsToAudience` /
 * `suppressContactsInAudience` loop one request per contact. Unthrottled,
 * those blow past the cap and Resend returns 429s.
 *
 * This module is the single funnel for Resend HTTP. It uses a SLIDING-WINDOW
 * limiter, not a fixed per-request delay: up to MAX_PER_WINDOW requests are
 * allowed in any rolling WINDOW_MS, and a request only waits when that window
 * is actually full. This matters because the engaged-contacts scan pages the
 * global email log sequentially (each page needs the prior page's cursor)  -
 * with a fixed 150ms-per-request spacer that serial scan took long enough to
 * hit the serverless function timeout (504). A sliding window adds no delay to
 * sequential calls whose own latency already keeps them under the cap, and
 * only throttles genuine bursts (the parallel paginators, the per-contact
 * loops). 429s are still retried with the server's `retry-after` hint.
 */

// 8 req/s ceiling  -  headroom under Resend's 10/s account cap for webhooks/crons
// sharing the account, while never delaying naturally-paced sequential calls.
const MAX_PER_WINDOW = 8
const WINDOW_MS = 1000
const MAX_RETRIES = 5

// Timestamps (ms) of the most recent admitted requests, oldest first.
let recent: number[] = []
// Serializes only the admission decision (a few microseconds), not the fetch.
let admissionChain: Promise<void> = Promise.resolve()

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Reserve a slot in the sliding window. Resolves immediately if fewer than
 * MAX_PER_WINDOW requests fired in the last WINDOW_MS; otherwise waits just
 * long enough for the oldest in-window request to age out.
 */
function acquireSlot(): Promise<void> {
  const turn = admissionChain.then(async () => {
    const now = Date.now()
    recent = recent.filter(t => now - t < WINDOW_MS)
    if (recent.length >= MAX_PER_WINDOW) {
      const oldest = recent[0] ?? now
      const wait = WINDOW_MS - (now - oldest)
      if (wait > 0) await sleep(wait)
      const after = Date.now()
      recent = recent.filter(t => after - t < WINDOW_MS)
    }
    recent.push(Date.now())
  })
  admissionChain = turn.catch(() => {})
  return turn
}

/**
 * Throttled, 429-retrying fetch against the Resend API. `path` starts with
 * `/`; the Authorization header is added from `apiKey` (any headers in `init`
 * are preserved). Non-429 responses  -  including other errors  -  are returned
 * as-is for the caller to interpret.
 */
export async function resendFetch(
  path: string,
  init: RequestInit,
  apiKey: string
): Promise<Response> {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    ...((init.headers as Record<string, string> | undefined) ?? {})
  }
  for (let attempt = 0; ; attempt++) {
    await acquireSlot()
    if (
      ['POST', 'PATCH', 'PUT', 'DELETE'].includes(
        (init.method ?? 'GET').toUpperCase()
      )
    ) {
      assertDeliveryEnabled()
    }
    const res = await fetch(`${RESEND_API}${path}`, {...init, headers})
    if (res.status !== 429 || attempt >= MAX_RETRIES) return res
    const retryAfterHeader = Number(res.headers.get('retry-after'))
    const delayMs =
      Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
        ? retryAfterHeader * 1000
        : 1000 * 2 ** attempt
    log.warn(
      `Resend 429 on ${init.method ?? 'GET'} ${path}  -  retrying in ${delayMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
    )
    await res.body?.cancel().catch(() => {})
    await sleep(delayMs)
  }
}

/** Mutation-only Resend funnel. Every POST/PATCH/DELETE checks the explicit delivery gate immediately before network I/O. */
export async function resendMutationFetch(
  path: string,
  init: RequestInit,
  apiKey: string
): Promise<Response> {
  assertDeliveryEnabled()
  return resendFetch(path, init, apiKey)
}
