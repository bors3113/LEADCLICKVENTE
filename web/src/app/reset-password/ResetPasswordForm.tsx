'use client'

import { useActionState, useState, useEffect } from 'react'
import Link from 'next/link'
import { resetPassword, type ResetPasswordState } from './actions'
import { Eye, EyeOff, AlertTriangle, ArrowRight, Loader2, Sparkles } from 'lucide-react'

export function ResetPasswordForm() {
  const [state, formAction, isPending] = useActionState<ResetPasswordState, FormData>(resetPassword, null)
  const [showPw, setShowPw] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gradient-to-b from-background via-muted/20 to-background relative overflow-hidden text-foreground">
      {/* Decorative gradient glowing orb (matches Login page) */}
      <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80" aria-hidden="true">
        <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-indigo-200 to-primary/20 opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
      </div>

      <div className={`sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center transition-all duration-500 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-1.5 font-extrabold text-2xl tracking-tight text-foreground hover:opacity-90 transition-all mb-6">
          <span className="bg-primary text-primary-foreground p-1.5 rounded-lg flex items-center justify-center shadow-sm">
            <Sparkles className="h-5 w-5 fill-primary-foreground animate-pulse" />
          </span>
          <span>ClickVente</span>
        </Link>
        <h2 className="text-center text-3xl font-extrabold tracking-tight text-foreground">
          Choisissez un nouveau mot de passe
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Ce lien est valide une seule fois. Définissez votre nouveau mot de passe ci-dessous.
        </p>
      </div>

      <div className={`mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 transition-all duration-500 ease-out delay-75 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className="bg-card border border-border/40 shadow-xl rounded-2xl p-6 sm:p-10 relative z-10 backdrop-blur-sm">
          {state?.error && (
            <div className="mb-5 flex gap-2 items-start bg-red-500/5 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl p-3.5 text-xs leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{state.error}</span>
            </div>
          )}

          <form action={formAction} className="space-y-5">
            <div>
              <label htmlFor="new_password" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Nouveau mot de passe
              </label>
              <div className="relative">
                <input
                  id="new_password"
                  name="new_password"
                  type={showPw ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="w-full bg-background border border-border/80 rounded-xl pl-4 pr-11 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all duration-200 focus:border-primary/80 focus:ring-2 focus:ring-primary/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirm_password" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Confirmer le mot de passe
              </label>
              <input
                id="confirm_password"
                name="confirm_password"
                type={showPw ? 'text' : 'password'}
                required
                autoComplete="new-password"
                placeholder="••••••••"
                className="w-full bg-background border border-border/80 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all duration-200 focus:border-primary/80 focus:ring-2 focus:ring-primary/10"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold shadow-md shadow-primary/10 hover:bg-primary/95 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer mt-6"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  Réinitialiser le mot de passe
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
