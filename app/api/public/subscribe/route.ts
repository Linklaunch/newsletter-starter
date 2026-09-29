import {createLogger} from '@lib/logger'
import {
  clientIp,
  preflightResponse,
  publicJson,
  publicRouteError,
  subscribeLimiter,
  tooManyRequests
} from '@/lib/public-api'
import {
  addSubscriber,
  maskEmail,
  resolveSubscribeConfig,
  validateSubscribeBody
} from '@/lib/subscribe'
import {activePublication} from '@/publications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const log = createLogger('Newsletter:Subscribe')

/**
 * The single response a caller gets for any successful-looking submission.
 *
 * A new subscriber, an address already on the list, and a honeypot hit all
 * return exactly this. Anything else would let a stranger use the form to find
 * out whether a given person is subscribed.
 */
const ACCEPTED = {success: true, data: {subscribed: true}} as const

export async function OPTIONS(req: Request): Promise<Response> {
  return preflightResponse(req)
}

export async function POST(req: Request): Promise<Response> {
  try {
    const ip = clientIp(req)
    if (!subscribeLimiter.check(ip)) {
      return tooManyRequests(req, subscribeLimiter.retryAfterSeconds(ip))
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return publicJson(
        req,
        {success: false, error: 'invalid request body'},
        {status: 400}
      )
    }

    const validated = validateSubscribeBody(body)
    if (!validated.ok) {
      // A bot that filled the hidden field is told the same thing as a success,
      // so it has nothing to learn and nothing to retry against.
      if (validated.reason === 'honeypot') {
        log.warn('subscribe rejected: honeypot')
        return publicJson(req, ACCEPTED)
      }
      return publicJson(
        req,
        {success: false, error: 'enter a valid email address'},
        {status: 400}
      )
    }

    const config = resolveSubscribeConfig(activePublication())
    if (!config) {
      // Missing configuration is ours, not the visitor's. Fail loudly in the
      // log and honestly to the caller rather than pretending it worked.
      log.error(
        'subscribe not configured - set the Resend API key and audience id'
      )
      return publicJson(
        req,
        {success: false, error: 'subscriptions are not configured'},
        {status: 503}
      )
    }

    const outcome = await addSubscriber(validated.email, config)
    if (outcome.status === 'failed') {
      log.error(
        `Resend rejected ${maskEmail(validated.email)} with ${outcome.httpStatus}`
      )
      return publicJson(
        req,
        {success: false, error: 'could not complete signup, please try again'},
        {status: 502}
      )
    }

    log.info(`subscribe ${outcome.status}: ${maskEmail(validated.email)}`)
    return publicJson(req, ACCEPTED)
  } catch (error) {
    return publicRouteError(req, error)
  }
}
