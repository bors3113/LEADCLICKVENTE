'use client';

import { useState } from 'react';
import { Loader2, Mail, Send, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export function Contact() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Une erreur est survenue.');

      toast.success('Vous êtes inscrit(e) ! Nous vous tiendrons au courant.');
      setEmail('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Une erreur est survenue';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="contact" className="bg-background py-16 sm:py-24 relative overflow-hidden">
      
      {/* Background glow effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary/5 blur-3xl -z-10" />

      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        
        {/* Banner container */}
        <div className="relative isolate overflow-hidden bg-linear-to-r from-slate-950 via-indigo-950 to-slate-950 border border-indigo-500/20 px-6 py-16 rounded-3xl sm:px-24 xl:py-20 flex flex-col items-center text-center shadow-2xl">
          
          {/* Subtle Decorative Circle shapes */}
          <div className="absolute -top-24 -left-20 w-80 h-80 rounded-full bg-primary/10 blur-3xl -z-10" />
          <div className="absolute -bottom-24 -right-20 w-80 h-80 rounded-full bg-indigo-500/15 blur-3xl -z-10" />

          <div className="mx-auto max-w-2xl">
            
            {/* Newsletter Badge Icon */}
            <div className="inline-flex p-3 rounded-2xl bg-primary/10 border border-primary/20 text-primary mb-6 animate-bounce">
              <Mail className="h-6 w-6" />
            </div>
            
            <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl leading-tight">
              Rejoignez plus de 5 000 professionnels de la croissance
            </h2>
            
            <p className="mt-4 text-sm sm:text-base text-slate-300 max-w-lg mx-auto leading-relaxed">
              Recevez nos guides de Cold Emailing ultra-performants et soyez alerté en exclusivité lors de la sortie de nos intégrations HubSpot & Salesforce en un clic.
            </p>
            
            {/* Form */}
            <form className="mx-auto mt-8 flex max-w-md flex-col sm:flex-row gap-3 w-full" onSubmit={handleSubmit}>
              <div className="relative flex-auto">
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/50 text-white placeholder-slate-400 px-4 py-3.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  placeholder="Saisissez votre adresse email pro"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-6 py-3.5 text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/95 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    S'inscrire <Send className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </form>
            
            {/* Core benefits summary */}
            <div className="mt-6 flex flex-wrap justify-center items-center gap-4 text-xxs font-semibold text-slate-400">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Pas de spam
              </span>
              <span className="h-3 w-px bg-slate-800" />
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Désinscription facile
              </span>
              <span className="h-3 w-px bg-slate-800" />
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Updates mensuels uniquement
              </span>
            </div>
            
          </div>
          
        </div>
      </div>
    </div>
  );
}
