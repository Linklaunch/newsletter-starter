'use client'

import {useActionState, useState} from 'react'
import type {AuthFormState, RequestResetState} from './actions'
import {requestPasswordResetAction, signInAction, signUpAction} from './actions'

const INITIAL_STATE: AuthFormState = {error: null}
const INITIAL_RESET_STATE: RequestResetState = {status: 'idle', error: null}

type Mode = 'sign-in' | 'sign-up' | 'forgot'

export default function SignInPage(): React.JSX.Element {
  const [mode, setMode] = useState<Mode>('sign-in')
  const [signInState, signInFormAction, signInPending] = useActionState(
    signInAction,
    INITIAL_STATE
  )
  const [signUpState, signUpFormAction, signUpPending] = useActionState(
    signUpAction,
    INITIAL_STATE
  )
  const [resetState, resetFormAction, resetPending] = useActionState(
    requestPasswordResetAction,
    INITIAL_RESET_STATE
  )

  if (mode === 'forgot') {
    return (
      <Shell
        title="Reset your password"
        subtitle="Enter your email and we'll send a reset link.">
        {resetState.status === 'sent' ? (
          <p style={{fontSize: 14}}>
            If that email has an account, a reset link is on its way. Check your
            inbox.
          </p>
        ) : (
          <form action={resetFormAction} style={{display: 'grid', gap: 12}}>
            <input
              name="email"
              type="email"
              placeholder="Email"
              required
              style={inputStyle}
            />
            {resetState.error && <ErrorText>{resetState.error}</ErrorText>}
            <button type="submit" disabled={resetPending} style={buttonStyle}>
              {resetPending ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}
        <ModeLink onClick={() => setMode('sign-in')}>Back to sign-in</ModeLink>
      </Shell>
    )
  }

  const state = mode === 'sign-in' ? signInState : signUpState
  const action = mode === 'sign-in' ? signInFormAction : signUpFormAction
  const pending = mode === 'sign-in' ? signInPending : signUpPending

  return (
    <Shell
      title="Operator sign-in"
      subtitle={
        mode === 'sign-in'
          ? 'Sign in with your allowlisted email.'
          : 'Create an account for your allowlisted email, then sign in.'
      }>
      <form action={action} style={{display: 'grid', gap: 12}}>
        {mode === 'sign-up' && (
          <input
            name="name"
            type="text"
            placeholder="Name"
            style={inputStyle}
          />
        )}
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          style={inputStyle}
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          required
          minLength={8}
          style={inputStyle}
        />
        {state.error && <ErrorText>{state.error}</ErrorText>}
        <button type="submit" disabled={pending} style={buttonStyle}>
          {pending
            ? 'Please wait…'
            : mode === 'sign-in'
              ? 'Sign in'
              : 'Create account'}
        </button>
      </form>

      <div style={{display: 'grid', gap: 8, marginTop: 16}}>
        <ModeLink
          onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}>
          {mode === 'sign-in'
            ? "Don't have an account? Create one"
            : 'Already have an account? Sign in'}
        </ModeLink>
        {mode === 'sign-in' && (
          <ModeLink onClick={() => setMode('forgot')}>
            Forgot your password?
          </ModeLink>
        )}
      </div>
    </Shell>
  )
}

function Shell({
  title,
  subtitle,
  children
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <main
      style={{
        maxWidth: 400,
        margin: '80px auto',
        padding: '0 24px',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      }}>
      <h1 style={{fontSize: 24, fontWeight: 700, marginBottom: 4}}>{title}</h1>
      <p style={{color: '#666', fontSize: 14, marginBottom: 24}}>{subtitle}</p>
      {children}
    </main>
  )
}

function ErrorText({children}: {children: string}): React.JSX.Element {
  return <p style={{color: '#c0392b', fontSize: 13, margin: 0}}>{children}</p>
}

function ModeLink({
  onClick,
  children
}: {
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        color: '#2563eb',
        fontSize: 13,
        cursor: 'pointer',
        padding: 0,
        textAlign: 'left'
      }}>
      {children}
    </button>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 14,
  border: '1px solid #ddd',
  borderRadius: 6
}

const buttonStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 14,
  fontWeight: 600,
  color: 'white',
  background: '#2563eb',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer'
}
