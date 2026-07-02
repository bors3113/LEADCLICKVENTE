'use client'

import { useActionState, useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { login, signup, loginWithGoogle, type AuthState } from './actions'
import { Eye, EyeOff, AlertTriangle, CheckCircle2, ArrowRight, Loader2, Sparkles } from 'lucide-react'

type Mode = 'signin' | 'signup'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

export function LoginForm() {
  const [mode, setMode] = useState<Mode>('signin')
  const [showPw, setShowPw] = useState(false)
  const [visible, setVisible] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const [loginState, loginAction, loginPending] = useActionState<AuthState, FormData>(login, null)
  const [signupState, signupAction, signupPending] = useActionState<AuthState, FormData>(signup, null)

  const state = mode === 'signin' ? loginState : signupState
  const formAction = mode === 'signin' ? loginAction : signupAction
  const isPending = loginPending || signupPending

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60)
    return () => clearTimeout(t)
  }, [])

  const switchMode = (m: Mode) => {
    setMode(m)
    setShowPw(false)
    formRef.current?.reset()
  }

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gradient-to-b from-background via-muted/20 to-background relative overflow-hidden text-foreground">
      {/* Decorative gradient glowing orb (matches Landing page) */}
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
          {mode === 'signin' ? 'Connexion à votre compte' : 'Créer un compte'}
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {mode === 'signin' ? 'Accédez à votre espace ClickVente' : 'Commencez gratuitement dès aujourd\'hui'}
        </p>
      </div>

      <div className={`mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 transition-all duration-500 ease-out delay-75 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className="bg-card border border-border/40 shadow-xl rounded-2xl p-6 sm:p-10 relative z-10 backdrop-blur-sm">
          {/* Tab Selector */}
          <div className="flex border-b border-border/60 mb-6">
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className={`flex-1 pb-3 text-sm font-semibold border-b-2 text-center transition-all cursor-pointer ${
                mode === 'signin'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Se connecter
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={`flex-1 pb-3 text-sm font-semibold border-b-2 text-center transition-all cursor-pointer ${
                mode === 'signup'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              S'inscrire
            </button>
          </div>

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

          {/* Authentication Form */}
          <form action={formAction} ref={formRef} className="space-y-5">
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

            <div>
              <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPw ? 'text' : 'password'}
                  required
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
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

            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold shadow-md shadow-primary/10 hover:bg-primary/95 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer mt-6"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Chargement...
                </>
              ) : mode === 'signin' ? (
                <>
                  Se connecter
                  <ArrowRight size={15} />
                </>
              ) : (
                <>
                  Créer un compte
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="h-px flex-1 bg-border/60" />
            <span className="text-xs text-muted-foreground/60 font-medium">Ou continuer avec</span>
            <div className="h-px flex-1 bg-border/60" />
          </div>

          {/* OAuth Provider */}
          <form action={loginWithGoogle}>
            <button
              type="submit"
              className="w-full bg-card hover:bg-muted/50 border border-border/80 rounded-xl py-2.5 text-sm font-medium text-foreground transition-colors flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <GoogleIcon />
              Google
            </button>
          </form>

          {/* Secure notice */}
          <p className="mt-6 text-center text-[10px] text-muted-foreground/60 font-medium uppercase tracking-wider">
            Sécurisé par Supabase Auth &middot; Données cryptées
          </p>
        </div>
      </div>
    </div>
  )
}
