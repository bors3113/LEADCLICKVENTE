'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export type ResetPasswordState = { error?: string } | null

export async function resetPassword(prevState: ResetPasswordState, formData: FormData): Promise<ResetPasswordState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/forgot-password')
  }

  const newPassword = String(formData.get('new_password') ?? '')
  const confirmPassword = String(formData.get('confirm_password') ?? '')

  if (newPassword.length < 8) {
    return { error: 'Le mot de passe doit contenir au moins 8 caractères.' }
  }

  if (newPassword !== confirmPassword) {
    return { error: 'Les mots de passe ne correspondent pas.' }
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword })

  if (error) {
    return { error: error.message }
  }

  redirect('/dashboard')
}
