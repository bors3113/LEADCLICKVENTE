import Link from 'next/link'
import { AlertTriangle, Sparkles } from 'lucide-react'

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gradient-to-b from-background via-muted/20 to-background relative overflow-hidden text-foreground">
      {/* Decorative gradient glowing orb (matches Login page) */}
      <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80" aria-hidden="true">
        <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-indigo-200 to-primary/20 opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center">
        <Link href="/" className="flex items-center gap-1.5 font-extrabold text-2xl tracking-tight text-foreground hover:opacity-90 transition-all mb-6">
          <span className="bg-primary text-primary-foreground p-1.5 rounded-lg flex items-center justify-center shadow-sm">
            <Sparkles className="h-5 w-5 fill-primary-foreground animate-pulse" />
          </span>
          <span>ClickVente</span>
        </Link>
        <h2 className="text-center text-3xl font-extrabold tracking-tight text-foreground">
          Lien invalide ou expiré
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Ce lien n&apos;est plus valide. Il a peut-être déjà été utilisé ou a expiré.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-card border border-border/40 shadow-xl rounded-2xl p-6 sm:p-10 relative z-10 backdrop-blur-sm">
          <div className="mb-6 flex gap-2 items-start bg-red-500/5 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl p-3.5 text-xs leading-relaxed">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Ce lien n&apos;est plus valide. Il a peut-être déjà été utilisé ou a expiré.</span>
          </div>

          <div className="flex flex-col gap-3">
            <Link
              href="/forgot-password"
              className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold shadow-md shadow-primary/10 hover:bg-primary/95 transition-all text-center"
            >
              Demander un nouveau lien
            </Link>
            <Link
              href="/login"
              className="w-full bg-card hover:bg-muted/50 border border-border/80 rounded-xl py-2.5 text-sm font-medium text-foreground transition-colors text-center"
            >
              Retour à la connexion
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
