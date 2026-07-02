'use server'

import { createClient } from '@/utils/supabase/server'

export type ForgotPasswordState = { error?: string; message?: string } | null

export async function requestPasswordReset(prevState: ForgotPasswordState, formData: FormData): Promise<ForgotPasswordState> {
  const email = formData.get('email') as string
  if (!email) return { error: 'Veuillez saisir votre adresse e-mail.' }

  const supabase = await createClient()
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  })

  // Always return the same message regardless of `error` so the response
  // never reveals whether an account exists for this email.
  if (error) {
    console.error('resetPasswordForEmail error:', error.message)
  }

  return { message: 'Si un compte existe avec cette adresse, un e-mail de réinitialisation vient de vous être envoyé.' }
}
