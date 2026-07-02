import { Hero } from '@/components/Hero';
import { Features } from '@/components/Features';
import { ChromeExtensionSection } from '@/components/ChromeExtensionSection';
import { Pricing } from '@/components/Pricing';
import { Contact } from '@/components/Contact';
import { Integrations } from '@/components/Integrations';
import { FAQ } from '@/components/FAQ';
import Link from 'next/link';
import { ArrowRight, Sparkles, MapPin, Database, Mail, Terminal, ShieldAlert } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen scroll-smooth bg-background text-foreground antialiased selection:bg-primary/15 font-sans">
      
      {/* Top Promotional Banner */}
      <div className="w-full bg-linear-to-r from-indigo-900 via-indigo-950 to-slate-950 text-white py-2.5 px-4 text-center text-xs font-medium border-b border-indigo-800/40 relative z-50">
        <span className="inline-flex items-center gap-1.5">
          <span className="bg-primary/20 text-primary-400 px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider border border-primary/30">
            Nouveau
          </span>
          Recherchez et enrichissez vos prospects B2B à la vitesse de l'Edge.
          <Link href="/login" className="underline hover:text-indigo-200 inline-flex items-center gap-0.5 font-semibold transition-colors">
            Commencer gratuitement (50 leads offerts) <ArrowRight className="h-3 w-3" />
          </Link>
        </span>
      </div>

      {/* Sticky Premium Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/30 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
        <nav className="mx-auto max-w-7xl flex items-center justify-between p-4 lg:px-8" aria-label="Global">
          
          {/* Brand Logo */}
          <div className="flex lg:flex-1">
            <Link href="/" className="flex items-center gap-2 font-extrabold text-xl tracking-tight text-foreground hover:opacity-90 transition-opacity">
              <span className="bg-primary text-primary-foreground p-1.5 rounded-lg flex items-center justify-center shadow-sm">
                <Sparkles className="h-5 w-5 fill-primary-foreground" />
              </span>
              <span className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                ClickVente
              </span>
            </Link>
          </div>

          {/* Navigation Middle Links */}
          <div className="hidden md:flex md:gap-x-8">
            <a href="#features" className="text-sm font-semibold leading-6 text-muted-foreground hover:text-foreground transition-colors relative after:absolute after:bottom-[-4px] after:left-0 after:h-[2px] after:w-0 hover:after:w-full after:bg-primary after:transition-all">
              Fonctionnalités
            </a>
            <a href="#integrations" className="text-sm font-semibold leading-6 text-muted-foreground hover:text-foreground transition-colors relative after:absolute after:bottom-[-4px] after:left-0 after:h-[2px] after:w-0 hover:after:w-full after:bg-primary after:transition-all">
              Intégrations
            </a>
            <a href="#pricing" className="text-sm font-semibold leading-6 text-muted-foreground hover:text-foreground transition-colors relative after:absolute after:bottom-[-4px] after:left-0 after:h-[2px] after:w-0 hover:after:w-full after:bg-primary after:transition-all">
              Tarifs
            </a>
            <a href="#faq" className="text-sm font-semibold leading-6 text-muted-foreground hover:text-foreground transition-colors relative after:absolute after:bottom-[-4px] after:left-0 after:h-[2px] after:w-0 hover:after:w-full after:bg-primary after:transition-all">
              FAQ
            </a>
          </div>

          {/* Auth Actions */}
          <div className="flex flex-1 justify-end items-center gap-x-4">
            <Link href="/login" className="text-sm font-semibold leading-6 text-muted-foreground hover:text-foreground transition-colors">
              Connexion
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/95 transition-all transform hover:-translate-y-0.5"
            >
              Essayer gratuitement <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </nav>
      </header>

      {/* Page Sections */}
      <main className="flex-grow">
        <Hero />
        <Features />
        <ChromeExtensionSection />
        <Integrations />
        <Pricing />
        <FAQ />
        <Contact />
      </main>

      {/* Rich Premium Footer */}
      <footer className="bg-background border-t border-border/40 py-16 px-6 lg:px-8 relative overflow-hidden">
        {/* Background gradient flare */}
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-primary/5 blur-3xl -z-10" />
        
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-border/40">
            
            {/* Branding Column */}
            <div className="lg:col-span-2 space-y-4">
              <Link href="/" className="flex items-center gap-2 font-extrabold text-xl tracking-tight text-foreground">
                <span className="bg-primary text-primary-foreground p-1 rounded-md">
                  <Sparkles className="h-4.5 w-4.5 fill-primary-foreground" />
                </span>
                <span>ClickVente</span>
              </Link>
              <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                La plateforme de prospection B2B tout-en-un. Extrayez depuis Google Maps, enrichissez via LinkedIn, nettoyez en ligne et lancez vos campagnes de cold email en quelques clics.
              </p>
              
              {/* Trust Badge */}
              <div className="pt-2 flex items-center gap-3">
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Statut : Opérationnel
                </span>
                <span className="text-xs text-muted-foreground">Version 2.4.1 (Edge)</span>
              </div>
            </div>

            {/* Product Column */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground tracking-wider uppercase">Produit</h3>
              <ul className="space-y-2.5">
                <li>
                  <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> Scraper Google Maps
                  </a>
                </li>
                <li>
                  <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                    <Database className="h-3.5 w-3.5" /> Enrichisseur LinkedIn
                  </a>
                </li>
                <li>
                  <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                    <Terminal className="h-3.5 w-3.5" /> Éditeur de Données
                  </a>
                </li>
                <li>
                  <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" /> Cold Email Outreach
                  </a>
                </li>
              </ul>
            </div>

            {/* Solutions Column */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground tracking-wider uppercase">Solutions</h3>
              <ul className="space-y-2.5">
                <li>
                  <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Pour les Sales & BizDev
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Pour les Growth Marketers
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Pour les Agences LeadGen
                  </Link>
                </li>
              </ul>
            </div>

            {/* Support / Legal Column */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground tracking-wider uppercase font-semibold">Légal & Support</h3>
              <ul className="space-y-2.5">
                <li>
                  <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Mentions Légales
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Confidentialité (RGPD)
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Centre d'assistance
                  </Link>
                </li>
                <li>
                  <a href="mailto:support@clickvente.com" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                    <ShieldAlert className="h-3.5 w-3.5" /> Signaler un problème
                  </a>
                </li>
              </ul>
            </div>

          </div>

          {/* Bottom Footer Section */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground text-center sm:text-left">
              &copy; {new Date().getFullYear()} ClickVente. Conçu pour maximiser votre conversion de vente. Tous droits réservés.
            </p>
            <div className="flex gap-6 text-xs text-muted-foreground">
              <span className="hover:text-foreground transition-colors cursor-pointer">LinkedIn</span>
              <span className="hover:text-foreground transition-colors cursor-pointer">Twitter</span>
              <span className="hover:text-foreground transition-colors cursor-pointer">YouTube</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
