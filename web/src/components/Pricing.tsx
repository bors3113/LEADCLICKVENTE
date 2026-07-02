'use client';

import { Check, Info, Sparkles, HelpCircle, Coins, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const plans = [
  {
    name: 'Gratuit / Hobby',
    price: '0€',
    period: 'à vie',
    description: 'Parfait pour tester le scraper Google Maps et démarrer vos campagnes d\'outreach.',
    features: [
      '50 extractions Google Maps / mois',
      '1 000 emails d\'outreach gratuits / mois',
      'Accès à l\'extension Chrome (Options de base)',
      'Accès complet à l\'éditeur CSV/Excel',
      'Exports au format CSV uniquement',
      'Support communautaire standard',
    ],
    cta: 'Commencer gratuitement',
    href: '/login',
    popular: false,
    color: 'bg-card border-border/60 text-foreground'
  },
  {
    name: 'Pro Growth',
    price: '49€',
    period: 'par mois',
    description: 'La puissance de scraping maps illimitée et d\'enrichissement IA pour les équipes de croissance.',
    features: [
      '10 000 extractions Google Maps / mois',
      '1 000 emails d\'outreach gratuits / mois',
      'Accès complet à l\'extension Chrome (LinkedIn Copilot)',
      'Rédaction de DMs LinkedIn par IA',
      'Enrichissement LinkedIn & Décideurs (PAYG)',
      'Accès complet à l\'éditeur CSV/Excel',
      'Exports illimités Excel (.xlsx) et CSV',
      'Filtres de recherche avancés multicritères',
      'Gestion de campagnes d\'emails pro (Rédacteur IA)',
      'Support client prioritaire 7j/7 (chat & mail)',
    ],
    cta: 'Démarrer l\'essai gratuit Pro',
    href: '/login',
    popular: true,
    color: 'bg-background border-primary shadow-xl ring-1 ring-primary/40'
  },
];

export function Pricing() {
  return (
    <div id="pricing" className="bg-muted/10 py-24 sm:py-32 border-b border-border/40 relative overflow-hidden">
      
      {/* Background circles */}
      <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-primary/5 blur-3xl -z-10" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full bg-indigo-500/5 blur-3xl -z-10" />

      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        
        {/* Header Title */}
        <div className="mx-auto max-w-3xl text-center mb-16">
          <h2 className="text-sm font-semibold leading-7 text-primary flex items-center justify-center gap-1.5 uppercase tracking-widest font-bold">
            Tarifs transparents
          </h2>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Un abonnement simple, adapté à votre rythme
          </p>
          <p className="mt-4 text-base text-muted-foreground">
            Que vous soyez solopreneur ou une équipe commerciale structurée, sélectionnez le plan idéal pour accélérer votre prospection commerciale.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="mx-auto mt-16 grid max-w-md grid-cols-1 gap-y-8 sm:mt-20 lg:mx-0 lg:max-w-none lg:grid-cols-2 lg:gap-x-8 items-stretch">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-3xl p-8 xl:p-10 flex flex-col justify-between border transition-all hover:scale-[1.01] ${plan.color}`}
            >
              {/* Popular ribbon */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-bold leading-5 text-primary-foreground flex items-center gap-1 shadow-md">
                  <Sparkles className="h-3.5 w-3.5 fill-primary-foreground" /> Recommandé pour les Sales
                </div>
              )}

              <div>
                <div className="flex items-center justify-between gap-x-4">
                  <h3 className={`text-xl font-extrabold leading-8 ${plan.popular ? 'text-primary' : 'text-foreground'}`}>
                    {plan.name}
                  </h3>
                </div>
                
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground min-h-[48px]">
                  {plan.description}
                </p>

                <p className="mt-6 flex items-baseline gap-x-1 border-b border-border/40 pb-6">
                  <span className="text-5xl font-black tracking-tight text-foreground">{plan.price}</span>
                  <span className="text-sm font-semibold leading-6 text-muted-foreground">/ {plan.period}</span>
                </p>

                {/* Features list */}
                <ul role="list" className="mt-8 space-y-4 text-sm leading-6 text-muted-foreground">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-x-3 text-xs text-foreground font-medium">
                      <Check className="h-4.5 w-4.5 flex-none text-primary bg-primary/10 p-0.5 rounded-full mt-0.5" aria-hidden="true" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Call to action & alerts */}
              <div className="mt-8">
                <Link
                  href={plan.href}
                  className={`block w-full rounded-xl py-3.5 px-4 text-center text-xs font-extrabold leading-6 transition-all shadow-md cursor-pointer ${
                    plan.popular
                      ? 'bg-primary text-primary-foreground shadow-primary/20 hover:bg-primary/95 hover:scale-[1.02] active:scale-[0.98]'
                      : 'bg-muted/80 text-foreground hover:bg-muted border border-border/60 hover:scale-[1.02] active:scale-[0.98]'
                  }`}
                >
                  {plan.cta}
                </Link>
                
                {plan.popular && (
                  <div className="mt-4 flex items-start gap-2 text-[10px] text-muted-foreground bg-indigo-50/5 dark:bg-indigo-950/15 border border-indigo-500/10 p-3 rounded-xl">
                    <Info className="h-4.5 w-4.5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-foreground font-bold block mb-0.5">Enrichissement Pay-As-You-Go :</strong>
                      L'extraction Maps est incluse. La recherche d'emails nominatifs & profils LinkedIn utilise des crédits prépayés rechargeables selon vos besoins réels (sans gaspillage).
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Pricing Help / PAYG Credit System Explainer */}
        <div className="mt-12 bg-card border border-border/50 rounded-2xl p-6 lg:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 text-primary border border-primary/20 rounded-xl shrink-0">
              <Coins className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground">Comment fonctionne le système de crédits d'enrichissement ?</h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                Chaque recherche Google Maps est 100% gratuite. Si vous décidez de l'enrichir pour trouver le décideur et son adresse mail pro validée, cela consomme 1 crédit d'enrichissement. Vous recevez 50 crédits gratuits lors de votre inscription.
              </p>
            </div>
          </div>
          <Link href="/login" className="text-xs font-bold text-primary hover:underline flex items-center gap-1 shrink-0 whitespace-nowrap">
            Acheter des crédits supplémentaires <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

      </div>
    </div>
  );
}
