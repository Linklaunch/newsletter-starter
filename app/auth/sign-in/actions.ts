'use server'

import {redirect} from 'next/navigation'
import {auth} from '@/lib/auth/server'

export interface AuthFormState {
  error: string | null
}

function readCredentials(formData: FormData): {
  email: string
  password: string
} {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  return {email, password}
}

export async function signInAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  if (!auth) return {error: 'Authentication is not configured.'}
  const {email, password} = readCredentials(formData)
  const {error} = await auth.signIn.email({email, password})
  if (error) return {error: error.message ?? 'Something went wrong.'}
  redirect('/')
}

export async function signUpAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  if (!auth) return {error: 'Authentication is not configured.'}
  const {email, password} = readCredentials(formData)
  const name = String(formData.get('name') ?? '').trim() || email
  const {error} = await auth.signUp.email({email, password, name})
  if (error) return {error: error.message ?? 'Something went wrong.'}
  redirect('/')
}

export interface RequestResetState {
  status: 'idle' | 'sent'
  error: string | null
}

export async function requestPasswordResetAction(
  _prevState: RequestResetState,
  formData: FormData
): Promise<RequestResetState> {
  if (!auth) {
    return {status: 'idle', error: 'Authentication is not configured.'}
  }
  const email = String(formData.get('email') ?? '').trim()
  if (!email) return {status: 'idle', error: 'Enter your email first.'}
  const {error} = await auth.requestPasswordReset({
    email,
    redirectTo: '/auth/reset-password'
  })
  if (error) {
    return {status: 'idle', error: error.message ?? 'Something went wrong.'}
  }
  return {status: 'sent', error: null}
}
