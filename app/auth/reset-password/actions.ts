'use server'

import {redirect} from 'next/navigation'
import {auth} from '@/lib/auth/server'

export interface ResetPasswordState {
  error: string | null
}

export async function resetPasswordAction(
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  if (!auth) return {error: 'Authentication is not configured.'}
  const token = String(formData.get('token') ?? '')
  const newPassword = String(formData.get('password') ?? '')
  if (!token) return {error: 'This reset link is missing its token.'}
  const {error} = await auth.resetPassword({newPassword, token})
  if (error) return {error: error.message ?? 'Something went wrong.'}
  redirect('/auth/sign-in')
}
