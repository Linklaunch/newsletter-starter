/**
 * Shared client-side API helper for the operator console. Every page used to
 * carry its own copy of this `callApi` + `ApiResp` block; they now import this
 * one so the request shape and error handling stay consistent.
 *
 * Guards against the two failure modes the per-page copies missed:
 *  - a non-2xx response (e.g. the auth proxy 307-redirecting to the sign-in
 *    HTML page), and
 *  - a body that isn't valid JSON,
 * both of which previously threw an unhandled SyntaxError inside `res.json()`.
 * Here they collapse into a normal `{success:false, error}` the caller renders.
 */

export interface ApiOk<T> {
  success: true
  data: T
}

export interface ApiErr {
  success: false
  error: string
}

export type ApiResp<T> = ApiOk<T> | ApiErr

export async function callApi<T>(
  url: string,
  init: RequestInit = {}
): Promise<ApiResp<T>> {
  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        ...(init.body ? {'Content-Type': 'application/json'} : {}),
        ...(init.headers ?? {})
      }
    })
  } catch (err) {
    return {success: false, error: 'request failed'}
  }

  let json: unknown
  try {
    json = await res.json()
  } catch {
    // Non-JSON body  -  most often an auth-proxy redirect to the sign-in HTML.
    return {
      success: false,
      error: res.ok
        ? `non-JSON response from ${url} (HTTP ${res.status})`
        : `HTTP ${res.status} from ${url}`
    }
  }

  if (json && typeof json === 'object' && 'success' in json) {
    return json as ApiResp<T>
  }
  return {success: false, error: `unexpected response from ${url}`}
}
