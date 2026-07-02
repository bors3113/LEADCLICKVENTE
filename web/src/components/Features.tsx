'use client';

import { useState } from 'react';
import { 
  MapPin, 
  Sparkles, 
  Table, 
  Send, 
  Check, 
  ArrowRight, 
  ListFilter, 
  Mail, 
  CheckCircle2, 
  Lock, 
  Eye, 
  Plus 
} from 'lucide-react';

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

interface FeatureTab {
  id: string;
  name: string;
  shortName: string;
  tagline: string;
  title: string;
  description: string;
  points: string[];
  ctaText: string;
  ctaHref: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function Features() {
  const [activeTab, setActiveTab] = useState('scrape');

  const tabs: FeatureTab[] = [
    {
      id: 'scrape',
      name: '1. Scraper Google Maps',
      shortName: 'Scraping Maps',
      tagline: 'CIBLEZ ET EXTRAIEZ SANS EFFORT',
      title: 'Scrapez des milliers d\'adresses locales',
      description: 'Ciblez n\'importe quelle activité commerciale et zone géographique. Notre architecture Edge contourne les blocages et extrait les téléphones, sites web, notes et adresses publiques de Google Maps.',
      points: [
        'Multi-localisations simultanées (ex: Boulangeries à Paris, Lyon, Nice)',
        'Zéro configuration de clés API compliquées'
      ],
      ctaText: 'Lancer un Scrape Gratuit',
      ctaHref: '/login',
      icon: MapPin
    },
    {
      id: 'enrich',
      name: '2. Extension LinkedIn & Enrichissement',
      shortName: 'Extension & IA',
      tagline: 'CO-PILOTE DE PROSPECTION LINKEDIN',
      title: 'Enrichissez vos contacts et rédigez par IA directement sur LinkedIn',
      description: 'Grâce à notre Extension Chrome ClickVente LinkedIn Copilot, visitez n\'importe quel profil LinkedIn pour enrichir ses coordonnées et laisser notre IA rédiger un message de prospection (DM) ultra-personnalisé inséré en un clic dans la boîte de dialogue.',
      points: [
        'Extension Chrome LinkedIn Copilot pour prospecter sans changer d\'onglet',
        'Rédaction de messages directs (DMs) personnalisés par IA selon le profil',
        'Enrichissement en un clic (LinkedIn profil + email pro vérifié)'
      ],
      ctaText: 'Installer l\'extension Chrome',
      ctaHref: '/login',
      icon: Sparkles
    },
    {
      id: 'editor',
      name: '3. Éditeur de Données Intégré',
      shortName: 'Spreadsheet Web',
      tagline: 'NETTOYEZ VOS LISTES EN LIGNE',
      title: 'Éditez vos leads comme dans Excel, directement en ligne',
      description: 'Plus besoin d\'exporter vos fichiers pour les trier dans Google Sheets. Notre tableur en ligne haute performance vous permet de nettoyer, filtrer et valider vos listes instantanément.',
      points: [
        'Recherche globale et filtres intelligents',
        'Modification directe des cellules en un clic',
        'Élimination automatique des doublons'
      ],
      ctaText: 'Ouvrir l\'Éditeur de Leads',
      ctaHref: '/login',
      icon: Table
    },
    {
      id: 'outreach',
      name: '4. Campagnes d\'Outreach & IA',
      shortName: 'Cold Emailing & IA',
      tagline: '1 000 EMAILS OFFERTS PAR MOIS',
      title: 'Générez vos templates d\'emails par IA et envoyez-les gratuitement',
      description: 'Connectez vos boîtes email pros (Gmail, Outlook) et lancez des séquences de cold email automatisées avec relances intelligentes. Rédigez vos structures d\'emails avec notre IA générative.',
      points: [
        '1 000 emails d\'outreach offerts gratuitement chaque mois',
        'Génération automatique d\'emails par IA (formulation d\'accroches)',
        'Séquences et relances programmées avec suivi analytique en temps réel'
      ],
      ctaText: 'Automatiser l\'Outreach',
      ctaHref: '/login',
      icon: Send
    }
  ];

  const currentFeature = tabs.find(t => t.id === activeTab) || tabs[0];

  return (
    <div id="features" className="bg-background py-24 sm:py-32 border-b border-border/40 relative overflow-hidden">
      
      {/* Background Flare */}
      <div className="absolute top-1/2 left-0 -translate-y-1/2 w-96 h-96 rounded-full bg-indigo-500/5 blur-3xl -z-10" />

      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        
        {/* Section Title */}
        <div className="mx-auto max-w-3xl text-center mb-16">
          <h2 className="text-sm font-semibold leading-7 text-primary flex items-center justify-center gap-1.5 uppercase tracking-widest font-bold">
            <Sparkles className="h-4 w-4" /> Plateforme Tout-en-Un
          </h2>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Un pipeline commercial fluide, du scrape au closing
          </p>
          <p className="mt-4 text-base text-muted-foreground">
            Arrêtez de jongler entre 4 outils et abonnements payants. ClickVente rassemble toute la prospection dans une interface unifiée.
          </p>
        </div>

        {/* Tab Switcher Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Tab Selectors & Active Text (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Horizontal tabs on mobile, vertical on desktop */}
            <div className="flex flex-row lg:flex-col overflow-x-auto lg:overflow-x-visible pb-3 lg:pb-0 gap-2 border-b border-border/30 lg:border-b-0">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-3 w-full text-left px-4 py-3.5 rounded-xl text-sm font-bold transition-all border shrink-0 cursor-pointer ${
                      isActive 
                        ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/10 scale-[1.01]' 
                        : 'bg-card text-muted-foreground border-border/60 hover:text-foreground hover:bg-muted/40'
                    }`}
                  >
                    <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-primary-foreground' : 'text-primary'}`} />
                    <span className="whitespace-nowrap lg:whitespace-normal">{tab.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Selected Tab Copy */}
            <div className="pt-6 space-y-6">
              <div className="text-xxs font-extrabold text-primary tracking-widest uppercase">
                {currentFeature.tagline}
              </div>
              <h3 className="text-2xl font-bold text-foreground leading-tight">
                {currentFeature.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {currentFeature.description}
              </p>

              {/* Point Checklist */}
              <ul className="space-y-3 pt-2">
                {currentFeature.points.map((point, index) => (
                  <li key={index} className="flex items-start gap-2.5 text-xs text-muted-foreground font-medium">
                    <Check className="h-4.5 w-4.5 text-emerald-500 bg-emerald-500/10 p-0.5 rounded-full flex-shrink-0 mt-0.5" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>

              <div className="pt-4">
                <a
                  href={currentFeature.ctaHref}
                  className="inline-flex items-center gap-2 rounded-xl bg-foreground text-background hover:bg-foreground/90 px-5 py-3 text-xs font-bold shadow transition-all cursor-pointer"
                >
                  {currentFeature.ctaText} <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

          </div>

          {/* Right Column: Visual Dashboard Mockups (7 cols) */}
          <div className="lg:col-span-7 h-[420px] relative rounded-2xl border border-border/60 bg-card shadow-xl overflow-hidden flex flex-col">
            
            {/* Internal Window Frame Top */}
            <div className="bg-muted/30 border-b border-border/60 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-border inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-border inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-border inline-block" />
                <span className="ml-2 text-xxs font-mono text-muted-foreground">app.clickvente.com/dashboard/{currentFeature.id}</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                <Eye className="h-3 w-3" /> Visualisation Live
              </span>
            </div>

            {/* Dynamic Dashboard View Area */}
            <div className="flex-1 bg-muted/5 p-4 overflow-hidden font-sans">
              
              {/* Tab 1: Scrape Maps Mockup */}
              {activeTab === 'scrape' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-card p-3 rounded-xl border border-border/50">
                    <div>
                      <div className="text-[10px] text-muted-foreground font-bold">RECHERCHE AUTOMATISÉE</div>
                      <div className="text-sm font-extrabold text-foreground">Hôtels & Spas de Luxe</div>
                    </div>
                    <span className="px-2 py-0.5 text-[9px] bg-primary/10 text-primary font-extrabold rounded-full border border-primary/20">
                      Tâche #2294
                    </span>
                  </div>
                  
                  {/* Real-time progress bar mockup */}
                  <div className="bg-card p-4 rounded-xl border border-border/50 space-y-2">
                    <div className="flex justify-between text-xxs font-bold">
                      <span className="text-foreground">Progression du Scraping</span>
                      <span className="text-primary">87% (42 / 50 leads)</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div className="bg-primary h-2 rounded-full w-[87%]" />
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-2 text-[10px]">
                      <div className="bg-muted/40 p-1.5 rounded text-center">
                        <span className="block font-bold text-foreground">Nice, Cannes</span>
                        <span className="text-[9px] text-muted-foreground">Villes ciblées</span>
                      </div>
                      <div className="bg-muted/40 p-1.5 rounded text-center">
                        <span className="block font-bold text-emerald-600">42 extraits</span>
                        <span className="text-[9px] text-muted-foreground">Données valides</span>
                      </div>
                      <div className="bg-muted/40 p-1.5 rounded text-center">
                        <span className="block font-bold text-foreground">0.0s delay</span>
                        <span className="text-[9px] text-muted-foreground">Proxies OK</span>
                      </div>
                    </div>
                  </div>

                  {/* Logs list mockup */}
                  <div className="bg-slate-950 text-slate-300 p-3 rounded-lg font-mono text-[9px] space-y-1 border border-slate-900 shadow-inner">
                    <div className="text-emerald-400">&gt; [✓] Lancement des clusters Puppeteer...</div>
                    <div className="text-slate-400">&gt; [ℹ] Extraction : "Hôtel de Paris Monte-Carlo" (Maps OK)</div>
                    <div className="text-slate-400">&gt; [ℹ] Extraction : "Le Negresco Nice" (Maps OK)</div>
                    <div className="text-primary animate-pulse">&gt; [ℹ] Recherche de contacts sur le domaine hotelparis.com...</div>
                  </div>
                </div>
              )}

              {/* Tab 2: Enrich B2B Mockup */}
              {activeTab === 'enrich' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="text-xs font-bold text-foreground">Enrichissement B2B intelligent</h4>
                    <span className="text-xxs text-muted-foreground font-mono">Crédits restants : <strong className="text-foreground">2 450</strong></span>
                  </div>

                  {/* Enriched cards stack */}
                  <div className="space-y-2">
                    {[
                      { name: "Laurence Bertrand", role: "Directrice Générale", company: "Hôtel Le Negresco", email: "l.bertrand@lenegresco.com", linkedin: "Bertrand (CEO)" },
                      { name: "Sébastien Faure", role: "Directeur Marketing", company: "Carlton Cannes", email: "s.faure@carltoncannes.com", linkedin: "S. Faure (CMO)" }
                    ].map((item, idx) => (
                      <div key={idx} className="bg-card p-3 rounded-xl border border-border/50 flex items-center justify-between hover:border-primary/30 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-700 text-xs shadow-sm">
                            {item.name.split(' ').map(n=>n[0]).join('')}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                              {item.name}
                              <span className="text-[8px] bg-sky-100 text-sky-700 font-extrabold px-1 py-0.2 rounded flex items-center gap-0.5">
                                <LinkedinIcon className="h-2 w-2 fill-sky-700" /> Profil
                              </span>
                            </div>
                            <div className="text-[10px] text-muted-foreground font-medium">{item.role} @ {item.company}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-mono font-bold text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10">
                            {item.email}
                          </div>
                          <span className="inline-flex items-center gap-0.5 text-[8px] text-emerald-600 font-bold mt-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Email Délivrable
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Micro dashboard indicators */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="bg-card border border-border/40 p-2.5 rounded-xl text-center">
                      <div className="text-lg font-black text-foreground">94.8%</div>
                      <div className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Taux de Match LinkedIn</div>
                    </div>
                    <div className="bg-card border border-border/40 p-2.5 rounded-xl text-center">
                      <div className="text-lg font-black text-emerald-600">0% Bounce</div>
                      <div className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Emails DNS Validés</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Grid Editor Mockup */}
              {activeTab === 'editor' && (
                <div className="space-y-3 h-full flex flex-col justify-between">
                  {/* Editor Tool Bar */}
                  <div className="flex justify-between items-center bg-card p-2 rounded-lg border border-border/40 text-[10px] font-bold text-muted-foreground">
                    <div className="flex gap-3">
                      <span className="text-foreground flex items-center gap-1"><ListFilter className="h-3.5 w-3.5" /> Filtrer</span>
                      <span className="flex items-center gap-1"><Table className="h-3.5 w-3.5" /> Colonnes</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded text-[9px] cursor-pointer">
                        + Ajouter Ligne
                      </span>
                    </div>
                  </div>

                  {/* Spreadsheet table mock */}
                  <div className="flex-1 bg-card rounded-lg border border-border/40 overflow-hidden text-xxs font-mono">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-muted/40 border-b border-border/60 text-muted-foreground font-semibold">
                          <th className="p-2 border-r border-border/30">Nom Etablissement</th>
                          <th className="p-2 border-r border-border/30">Décideur</th>
                          <th className="p-2 border-r border-border/30">Email B2B Nominatif</th>
                          <th className="p-2">Téléphone</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        <tr className="bg-background">
                          <td className="p-2 border-r border-border/30 font-bold text-foreground">Grand Hotel Nice</td>
                          <td className="p-2 border-r border-border/30 text-foreground">Paul Vane</td>
                          <td className="p-2 border-r border-border/30 text-primary font-bold">p.vane@grandhotel.fr</td>
                          <td className="p-2 text-muted-foreground">04 93 10 20 30</td>
                        </tr>
                        <tr className="bg-muted/10">
                          <td className="p-2 border-r border-border/30 font-bold text-foreground">Spa Marine Cannes</td>
                          <td className="p-2 border-r border-border/30 text-foreground">Julie Morel</td>
                          <td className="p-2 border-r border-border/30 text-primary font-bold">j.morel@spamarine.com</td>
                          <td className="p-2 text-muted-foreground">04 92 11 00 22</td>
                        </tr>
                        <tr className="bg-background">
                          <td className="p-2 border-r border-border/30 font-bold text-foreground">L'Ancre Bleue Cafe</td>
                          <td className="p-2 border-r border-border/30 text-foreground">Jean Marc</td>
                          <td className="p-2 border-r border-border/30 text-primary font-bold text-xxs italic text-muted-foreground font-normal">Non enrichi</td>
                          <td className="p-2 text-muted-foreground">06 42 12 34 56</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="text-[10px] text-muted-foreground text-right italic font-medium">
                    *Double-cliquez sur n'importe quelle cellule pour l'éditer en direct
                  </div>
                </div>
              )}

              {/* Tab 4: Outreach Email Campaign Mockup */}
              {activeTab === 'outreach' && (
                <div className="space-y-4">
                  
                  {/* Campaign stats overview */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-card border border-border/50 p-2 rounded-xl text-center shadow-xs">
                      <div className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Envoyés</div>
                      <div className="text-base font-extrabold text-foreground mt-0.5">850</div>
                    </div>
                    <div className="bg-card border border-border/50 p-2 rounded-xl text-center shadow-xs">
                      <div className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Taux d'ouverture</div>
                      <div className="text-base font-extrabold text-indigo-600 mt-0.5">68.4%</div>
                    </div>
                    <div className="bg-card border border-border/50 p-2 rounded-xl text-center shadow-xs">
                      <div className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Réponses</div>
                      <div className="text-base font-extrabold text-emerald-600 mt-0.5">24.2%</div>
                    </div>
                  </div>

                  {/* Mail composer card */}
                  <div className="bg-card p-3.5 rounded-xl border border-border/50 space-y-2">
                    <div className="flex gap-2 text-xxs items-center text-muted-foreground font-semibold border-b border-border/40 pb-2">
                      <span>De : campaigns@mycompany.com</span>
                      <span className="h-3 w-px bg-border" />
                      <span>À : {`{email_decisionnaire}`}</span>
                    </div>
                    <div>
                      <div className="text-xxs font-bold text-foreground">Sujet : Partenariat commercial & visibilité Google Maps pour {'{nom_entreprise}'}</div>
                    </div>
                    <div className="text-xxs text-muted-foreground leading-relaxed font-sans border-t border-border/30 pt-1.5">
                      Bonjour <strong className="text-foreground">{'{nom_decisionnaire}'}</strong>,<br />
                      J'ai découvert <strong className="text-foreground">{'{nom_entreprise}'}</strong> via Google Maps à Nice. Votre note de {`{rating}`} étoiles est impressionnante. 
                      Je souhaite vous proposer notre outil ClickVente pour booster vos réservations de...
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-border/30">
                      <span className="text-[9px] text-indigo-600 font-extrabold flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> Contenu rédigé par IA
                      </span>
                      <span className="px-2 py-0.5 bg-emerald-500 text-white rounded text-[9px] font-bold">
                        Campagne Active
                      </span>
                    </div>
                  </div>

                </div>
              )}

            </div>

            {/* Glassmorphism details cards inside visual grid */}
            <div className="absolute bottom-3 right-3 bg-slate-900/90 backdrop-blur-md border border-slate-700 p-2.5 rounded-lg text-white max-w-[170px] shadow-2xl flex items-center gap-2">
              <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500 shrink-0" />
              <div>
                <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">MOTEUR CLOUD</div>
                <div className="text-xxs font-extrabold">Zéro Blocage de Compte</div>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
