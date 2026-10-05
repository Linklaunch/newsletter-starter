'use client'

import {Suspense, useActionState} from 'react'
import {useSearchParams} from 'next/navigation'
import type {ResetPasswordState} from './actions'
import {resetPasswordAction} from './actions'

const INITIAL_STATE: ResetPasswordState = {error: null}

export default function ResetPasswordPage(): React.JSX.Element {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  )
}

function ResetPasswordForm(): React.JSX.Element {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [state, formAction, pending] = useActionState(
    resetPasswordAction,
    INITIAL_STATE
  )

  return (
    <main
      style={{
        maxWidth: 400,
        margin: '80px auto',
        padding: '0 24px',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      }}>
      <h1 style={{fontSize: 24, fontWeight: 700, marginBottom: 4}}>
        Set a new password
      </h1>
      {!token ? (
        <p style={{color: '#c0392b', fontSize: 14, marginTop: 24}}>
          This link is missing its reset token. Request a new one from the{' '}
          <a href="/auth/sign-in" style={{color: '#2563eb'}}>
            sign-in page
          </a>
          .
        </p>
      ) : (
        <form
          action={formAction}
          style={{display: 'grid', gap: 12, marginTop: 24}}>
          <input type="hidden" name="token" value={token} />
          <input
            name="password"
            type="password"
            placeholder="New password"
            required
            minLength={8}
            style={{
              padding: '10px 12px',
              fontSize: 14,
              border: '1px solid #ddd',
              borderRadius: 6
            }}
          />
          {state.error && (
            <p style={{color: '#c0392b', fontSize: 13, margin: 0}}>
              {state.error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            style={{
              padding: '10px 12px',
              fontSize: 14,
              fontWeight: 600,
              color: 'white',
              background: '#2563eb',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer'
            }}>
            {pending ? 'Saving…' : 'Set new password'}
          </button>
        </form>
      )}
    </main>
  )
}
