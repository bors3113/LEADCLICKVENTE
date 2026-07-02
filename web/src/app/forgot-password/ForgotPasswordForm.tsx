'use client'

import { useActionState, useState, useEffect } from 'react'
import Link from 'next/link'
import { requestPasswordReset, type ForgotPasswordState } from './actions'
import { AlertTriangle, CheckCircle2, ArrowRight, Loader2, Sparkles, ArrowLeft } from 'lucide-react'

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState<ForgotPasswordState, FormData>(requestPasswordReset, null)
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
          Mot de passe oublié ?
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Entrez votre e-mail pour recevoir un lien de réinitialisation
        </p>
      </div>

      <div className={`mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 transition-all duration-500 ease-out delay-75 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className="bg-card border border-border/40 shadow-xl rounded-2xl p-6 sm:p-10 relative z-10 backdrop-blur-sm">
          {/* Feedback Alerts */}
          {state?.error && (
            <div className="mb-5 flex gap-2 items-start bg-red-500/5 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl p-3.5 text-xs leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{state.error}</span>
            </div>
          )}

          {state?.message && (
            <div className="mb-5 flex gap-2 items-start bg-emerald-500/5 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl p-3.5 text-xs leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{state.message}</span>
            </div>
          )}

          <form action={formAction} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Adresse e-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="nom@entreprise.com"
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
                  Envoi...
                </>
              ) : (
                <>
                  Envoyer le lien
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 flex justify-center">
            <Link href="/login" className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              <ArrowLeft size={14} />
              Retour à la connexion
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
