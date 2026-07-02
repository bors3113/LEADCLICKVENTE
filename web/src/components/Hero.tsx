'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Search, 
  MapPin, 
  Sparkles, 
  Download, 
  Check, 
  ExternalLink, 
  Star, 
  ArrowRight, 
  Play, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';

interface MockLead {
  name: string;
  rating: number;
  reviews: number;
  phone: string;
  website: string;
  category: string;
  decisionMaker?: string;
  role?: string;
  email?: string;
  linkedin?: string;
  enriched: boolean;
}

function LinkedinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

export function Hero() {
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [step, setStep] = useState<'idle' | 'searching' | 'scraped' | 'enriching' | 'enriched' | 'exported'>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [scrapedCount, setScrapedCount] = useState(0);

  // Auto-typing animation for the simulator on first mount
  useEffect(() => {
    let active = true;
    const animateDemo = async () => {
      // Small delay before start
      await new Promise(r => setTimeout(r, 1200));
      if (!active) return;

      // Type Query "Architectes"
      const qText = "Architectes";
      for (let i = 1; i <= qText.length; i++) {
        if (!active) return;
        setQuery(qText.slice(0, i));
        await new Promise(r => setTimeout(r, 60));
      }

      await new Promise(r => setTimeout(r, 300));

      // Type Location "Lyon"
      const lText = "Lyon";
      for (let i = 1; i <= lText.length; i++) {
        if (!active) return;
        setLocation(lText.slice(0, i));
        await new Promise(r => setTimeout(r, 60));
      }

      await new Promise(r => setTimeout(r, 400));
      if (!active) return;
      
      // Auto run search
      runSearchSimulation();
    };

    animateDemo();
    return () => { active = false; };
  }, []);

  const runSearchSimulation = () => {
    setStep('searching');
    setLogs([
      "🔋 [15:35:10] Démarrage du moteur ClickVente...",
      "🔗 [15:35:11] Connexion au réseau de 250 proxies Edge...",
      "🛰️ [15:35:12] Recherche sur Google Maps API (Bypass Actif)..."
    ]);

    setTimeout(() => {
      setLogs(prev => [
        ...prev,
        "🔍 [15:35:13] Établissements découverts : 3 (Limite Démo)",
        "📋 [15:35:13] Récupération des données publiques (Téléphone, Site, Notes)..."
      ]);
      setScrapedCount(3);
    }, 900);

    setTimeout(() => {
      setStep('scraped');
      setLogs(prev => [
        ...prev,
        "✨ [15:35:14] Scraping terminé. 3 établissements trouvés avec succès."
      ]);
    }, 1800);
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (step !== 'idle') return;
    runSearchSimulation();
  };

  const handleEnrich = () => {
    if (step !== 'scraped') return;
    setStep('enriching');
    setLogs(prev => [
      ...prev,
      "⚡ [15:35:16] Lancement de l'enrichissement B2B par IA...",
      "🔍 [15:35:17] Scraping social et recherche de LinkedIn Décideurs..."
    ]);

    setTimeout(() => {
      setLogs(prev => [
        ...prev,
        "📧 [15:35:18] Génération d'emails nominatifs & requêtes DNS...",
        "🟢 [15:35:19] Validation SMTP en temps réel : 3/3 adresses délivrables"
      ]);
    }, 800);

    setTimeout(() => {
      setStep('enriched');
      setLogs(prev => [
        ...prev,
        "🎉 [15:35:20] Enrichissement terminé ! Décideurs, LinkedIn & Mails OK."
      ]);
    }, 1600);
  };

  const handleExport = () => {
    if (step !== 'enriched') return;
    setStep('exported');
    setLogs(prev => [
      ...prev,
      "📦 [15:35:22] Génération du fichier Excel (.xlsx)...",
      "💾 [15:35:23] Fichier 'ClickVente_Architectes_Lyon.xlsx' exporté avec succès !"
    ]);

    setTimeout(() => {
      setStep('enriched');
    }, 3000);
  };

  const resetSimulator = () => {
    setQuery('');
    setLocation('');
    setStep('idle');
    setLogs([]);
    setScrapedCount(0);
  };

  const mockScrapedLeads: MockLead[] = [
    { name: 'ArchiDesign Studio', rating: 4.9, reviews: 28, phone: '04 72 40 10 12', website: 'archidesign-lyon.fr', category: 'Cabinet d\'architecture', enriched: false },
    { name: 'Espace & Lumière', rating: 4.7, reviews: 14, phone: '04 78 30 55 90', website: 'espacelumiere-archi.com', category: 'Architecte d\'intérieur', enriched: false },
    { name: 'Atelier Vert Lyon', rating: 4.5, reviews: 9, phone: '06 88 12 34 56', website: 'ateliervert-archi.fr', category: 'Cabinet d\'architecture', enriched: false },
  ];

  const mockEnrichedLeads: MockLead[] = [
    { name: 'ArchiDesign Studio', rating: 4.9, reviews: 28, phone: '04 72 40 10 12', website: 'archidesign-lyon.fr', category: 'Cabinet d\'architecture', decisionMaker: 'Marc Dupuis', role: 'CEO & Fondateur', email: 'm.dupuis@archidesign-lyon.fr', linkedin: '#', enriched: true },
    { name: 'Espace & Lumière', rating: 4.7, reviews: 14, phone: '04 78 30 55 90', website: 'espacelumiere-archi.com', category: 'Architecte d\'intérieur', decisionMaker: 'Claire Vautier', role: 'Directrice Générale', email: 'c.vautier@espacelumiere-archi.com', linkedin: '#', enriched: true },
    { name: 'Atelier Vert Lyon', rating: 4.5, reviews: 9, phone: '06 88 12 34 56', website: 'ateliervert-archi.fr', category: 'Cabinet d\'architecture', decisionMaker: 'Nicolas Brun', role: 'Architecte Associé', email: 'nicolas@ateliervert-archi.fr', linkedin: '#', enriched: true },
  ];

  const currentLeads = step === 'enriched' || step === 'exported' ? mockEnrichedLeads : mockScrapedLeads;

  return (
    <div className="relative isolate pt-24 pb-20 px-6 lg:px-8 bg-gradient-to-b from-background via-indigo-950/5 to-background overflow-hidden border-b border-border/40">
      
      {/* Visual background lights */}
      <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80" aria-hidden="true">
        <div className="relative left-[calc(50%-15rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-indigo-500 to-primary/30 opacity-20 sm:left-[calc(50%-35rem)] sm:w-[72.1875rem]" />
      </div>

      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center py-6">
          
          {/* Left: Copywriting area */}
          <div className="lg:col-span-5 text-left flex flex-col justify-center">
            
            {/* Trust badge ratings */}
            <div className="inline-flex items-center gap-x-2.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary mb-6 w-fit animate-pulse">
              <span className="flex h-2 w-2 rounded-full bg-primary" />
              Extraction Google Maps v2.4 (Performance Edge)
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl mb-6 leading-[1.05] bg-gradient-to-br from-foreground via-foreground to-foreground/80 bg-clip-text">
              Générez des leads B2B qualifiés en 3 clics
            </h1>

            {/* Sub-Headline */}
            <p className="text-base sm:text-lg leading-relaxed text-muted-foreground mb-8 max-w-lg">
              Scrapez n'importe quel commerce ou établissement sur Google Maps. Enrichissez automatiquement leurs coordonnées avec des emails nominatifs vérifiés et des profils LinkedIn de décideurs B2B.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
              <Link 
                href="/login" 
                className="rounded-xl bg-primary px-6 py-4 text-center text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/95 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-1.5"
              >
                Essayer gratuitement <ArrowRight className="h-4 w-4" />
              </Link>
              <a 
                href="#features" 
                className="rounded-xl border border-border bg-background/50 backdrop-blur-xs px-6 py-4 text-center text-sm font-bold text-foreground hover:bg-muted/60 transition-colors"
              >
                Découvrir le pipeline
              </a>
            </div>

            {/* Sub CTAs features check */}
            <div className="mt-8 grid grid-cols-2 gap-4 text-xs font-medium text-muted-foreground border-t border-border/40 pt-6 max-w-md">
              <span className="flex items-center gap-1.5">
                <Check className="h-4.5 w-4.5 text-emerald-500 bg-emerald-500/10 p-0.5 rounded-full" /> 
                Sans carte bancaire
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="h-4.5 w-4.5 text-emerald-500 bg-emerald-500/10 p-0.5 rounded-full" /> 
                50 crédits + Extension Chrome
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="h-4.5 w-4.5 text-emerald-500 bg-emerald-500/10 p-0.5 rounded-full" /> 
                Proxies inclus & sans blocage
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="h-4.5 w-4.5 text-emerald-500 bg-emerald-500/10 p-0.5 rounded-full" /> 
                1 000 emails d'outreach / mois
              </span>
            </div>

          </div>

          {/* Right: Live simulation widget */}
          <div className="lg:col-span-7">
            <div className="relative rounded-2xl border border-border bg-card shadow-2xl overflow-hidden transition-all duration-300 hover:shadow-primary/10">
              
              {/* Window Header */}
              <div className="bg-muted/40 px-4 py-3 border-b border-border/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-yellow-500/80 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-green-500/80 inline-block" />
                  <span className="ml-2 text-xs font-mono text-muted-foreground">ClickVente Simulator v2.4</span>
                </div>
                <div className="text-xxs text-primary font-bold uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded-full flex items-center gap-1.5 animate-pulse">
                  <Sparkles className="h-3 w-3" /> Démo Interactive
                </div>
              </div>

              {/* Input Form section inside the Mock Console */}
              <div className="p-4 bg-muted/10 border-b border-border/50">
                <form onSubmit={handleManualSearch} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                  <div className="sm:col-span-5 relative">
                    <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      disabled={step !== 'idle'}
                      placeholder="Ex: Architectes, Hôtels, Cabinets..."
                      className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-75"
                    />
                  </div>
                  <div className="sm:col-span-4 relative">
                    <MapPin className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      disabled={step !== 'idle'}
                      placeholder="Ex: Paris, Lyon, Marseille..."
                      className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-75"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <button
                      type="submit"
                      disabled={step !== 'idle'}
                      className="w-full bg-primary text-primary-foreground py-2.5 px-3 text-sm font-bold rounded-xl hover:bg-primary/95 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                    >
                      {step === 'searching' ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Recherche...
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5 fill-primary-foreground" />
                          Scraper
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Main Content Area */}
              <div className="p-5 min-h-[260px] flex flex-col justify-between">
                
                {/* 1. Idle state info card */}
                {step === 'idle' && (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="p-4 bg-primary/10 rounded-full text-primary mb-4 border border-primary/20">
                      <Search className="h-7 w-7" />
                    </div>
                    <h3 className="font-bold text-base text-foreground">Testez l'extraction en direct</h3>
                    <p className="text-xs text-muted-foreground max-w-sm mt-1.5">
                      Attendez l'animation de saisie automatique ou lancez directement avec vos propres filtres ci-dessus.
                    </p>
                  </div>
                )}

                {/* 2. Loading state */}
                {step === 'searching' && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="relative w-12 h-12 mb-4">
                      <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-ping" />
                      <div className="absolute inset-0 rounded-full border-t-4 border-primary animate-spin" />
                    </div>
                    <h3 className="font-bold text-base text-foreground">Extraction Google Maps...</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Initialisation des navigateurs cloud et rotation des proxies résidentiels.
                    </p>
                  </div>
                )}

                {/* 3. Scraped Leads List / Table (Both Scraped & Enriched States) */}
                {(step === 'scraped' || step === 'enriching' || step === 'enriched' || step === 'exported') && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border/80 text-muted-foreground pb-2">
                          <th className="py-2.5 font-bold">Entreprise</th>
                          <th className="py-2.5 font-bold">Site & Téléphone</th>
                          <th className="py-2.5 font-bold">Décideur (LinkedIn)</th>
                          <th className="py-2.5 font-bold">Statut</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {currentLeads.map((lead, idx) => (
                          <tr key={idx} className="hover:bg-muted/20 transition-colors">
                            <td className="py-3">
                              <div className="font-bold text-foreground text-sm">{lead.name}</div>
                              <div className="flex items-center gap-1 text-[10px] text-amber-500 font-medium mt-0.5">
                                <Star className="h-3 w-3 fill-amber-500" /> {lead.rating} 
                                <span className="text-muted-foreground">({lead.reviews} avis)</span>
                              </div>
                            </td>
                            <td className="py-3">
                              <a href={`https://${lead.website}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline font-semibold">
                                <ExternalLink className="h-3.5 w-3.5" />
                                {lead.website}
                              </a>
                              <span className="block mt-0.5 text-[10px] text-muted-foreground font-mono">{lead.phone}</span>
                            </td>
                            <td className="py-3">
                              {lead.enriched ? (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1 font-semibold text-foreground">
                                    <LinkedinIcon className="h-3.5 w-3.5 text-sky-600 fill-sky-600 flex-shrink-0" />
                                    {lead.decisionMaker}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">{lead.role}</div>
                                  <div className="text-[10px] font-mono text-primary bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10 w-fit font-bold">
                                    {lead.email}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground italic flex items-center gap-1">
                                  <AlertCircle className="h-3.5 w-3.5 text-muted-foreground/60" /> Non enrichi
                                </span>
                              )}
                            </td>
                            <td className="py-3">
                              {lead.enriched ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-bold border border-emerald-500/20">
                                  <span className="w-1 h-1 rounded-full bg-emerald-500" />
                                  IA Enrichi
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-bold border border-amber-500/20">
                                  Maps Prêt
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Console Log Area at the bottom of the table */}
                {logs.length > 0 && (
                  <div className="mt-4 bg-slate-950 text-slate-300 p-3 rounded-lg font-mono text-[10px] leading-relaxed max-h-[90px] overflow-y-auto border border-slate-800 shadow-inner">
                    {logs.map((log, index) => (
                      <div key={index} className="flex gap-1.5">
                        <span className="text-slate-500 select-none">&gt;</span>
                        <p>{log}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Console Control Bar */}
                {(step === 'scraped' || step === 'enriching' || step === 'enriched' || step === 'exported') && (
                  <div className="mt-4 pt-4 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/20 p-3 rounded-xl">
                    <div className="text-[11px] text-muted-foreground text-center sm:text-left font-medium">
                      {step === 'scraped' && `🎉 Extraction Maps OK ! ${scrapedCount} établissements trouvés.`}
                      {step === 'enriching' && "⚡ IA : Recherche LinkedIn, emails et scoring en cours..."}
                      {(step === 'enriched' || step === 'exported') && "🚀 Données vérifiées à 99% prêtes pour cold emailing."}
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto justify-end">
                      {step === 'scraped' && (
                        <button
                          onClick={handleEnrich}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all cursor-pointer hover:scale-[1.02]"
                        >
                          <Sparkles className="h-3.5 w-3.5 fill-indigo-100" /> Enrichir Décideurs (IA)
                        </button>
                      )}

                      {step === 'enriching' && (
                        <button
                          disabled
                          className="bg-indigo-600/50 text-white text-xs font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 cursor-not-allowed"
                        >
                          <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin inline-block" />
                          Enrichissement...
                        </button>
                      )}

                      {(step === 'enriched' || step === 'exported') && (
                        <>
                          <button
                            onClick={handleExport}
                            disabled={step === 'exported'}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all disabled:bg-emerald-700 hover:scale-[1.02] cursor-pointer"
                          >
                            {step === 'exported' ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5" /> Téléchargé !
                              </>
                            ) : (
                              <>
                                <Download className="h-3.5 w-3.5" /> Exporter Excel
                              </>
                            )}
                          </button>
                          <button
                            onClick={resetSimulator}
                            className="text-muted-foreground hover:text-foreground text-xs font-semibold py-2 px-3 rounded-xl border border-border bg-background transition-colors cursor-pointer"
                          >
                            Réinitialiser
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
