'use client';

import { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Download, 
  Check, 
  ArrowRight, 
  MessageSquareCode, 
  Send 
} from 'lucide-react';
import Link from 'next/link';

function ChromeIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" />
      <line x1="21.17" x2="12" y1="8" y2="8" />
      <line x1="3.95" x2="8.54" y1="6.06" y2="14" />
      <line x1="10.88" x2="15.46" y1="21.94" y2="14" />
    </svg>
  );
}

export function ChromeExtensionSection() {
  const [prompt, setPrompt] = useState('Offre de rendu 3D haute définition pour architectes');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedMsg, setGeneratedMsg] = useState('');
  const [progress, setProgress] = useState(0);

  const sampleMessages = [
    "Bonjour Marc,\n\nJ'ai suivi vos récentes réalisations chez ArchiDesign Lyon. Votre sensibilité sur les projets durables est remarquable.\n\nJe me demandais si vous étiez ouvert à déléguer vos rendus 3D pour gagner du temps sur vos phases de concours ?\n\nExcellente journée,\nFatima de ClickVente",
    "Hello Marc,\n\nFélicitations pour votre parcours de CEO chez ArchiDesign.\n\nNous aidons les cabinets lyonnais à modéliser leurs maquettes BIM 3D en moins de 48h pour doubler leurs présentations clients.\n\nDisponible pour en parler ?\n\nCordialement,\nFatima"
  ];

  const handleSimulateDraft = () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setGeneratedMsg('');
    setProgress(10);
    
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsGenerating(false);
          setGeneratedMsg(sampleMessages[Math.floor(Math.random() * sampleMessages.length)]);
          return 100;
        }
        return prev + 15;
      });
    }, 150);
  };

  return (
    <div className="bg-muted/10 py-24 sm:py-32 border-b border-border/40 relative overflow-hidden">
      
      {/* Subtle glowing elements */}
      <div className="absolute top-1/4 right-0 w-[400px] h-[400px] rounded-full bg-primary/5 blur-3xl -z-10" />
      <div className="absolute bottom-1/4 left-0 w-[400px] h-[400px] rounded-full bg-sky-500/5 blur-3xl -z-10" />

      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        
        {/* Split Section Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          
          {/* Left Side: Copywriting */}
          <div className="lg:col-span-5 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1.5 text-xs font-bold text-sky-600 dark:text-sky-400">
              <ChromeIcon className="h-4 w-4" /> Extension Chrome ClickVente
            </div>

            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl leading-tight">
              Prospectez directement sur LinkedIn avec notre Copilot IA
            </h2>

            <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
              Plus besoin d'exporter ou de changer d'onglet. Notre extension de prospection s'intègre directement dans l'interface de LinkedIn pour enrichir les coordonnées de vos prospects et générer des accroches ultra-personnalisées par IA.
            </p>

            {/* Checklist of highlights */}
            <div className="space-y-4 pt-2">
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-lg shrink-0 mt-0.5">
                  <Check className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Enrichissement B2B Immédiat</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">Identifiez l'adresse email professionnelle validée du profil LinkedIn visité en 1 clic.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-lg shrink-0 mt-0.5">
                  <Check className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Rédaction de messages IA personnalisés (DMs)</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">Notre IA analyse le profil du décideur et formule un pitch sur-mesure inséré directement dans la messagerie LinkedIn.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-lg shrink-0 mt-0.5">
                  <Check className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Zéro automatisation risquée</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">L'extension n'envoie jamais de message automatiquement. Vous relisez, ajustez et gardez le contrôle total.</p>
                </div>
              </div>
            </div>

            {/* Direct extension download button linking to route */}
            <div className="pt-4 flex flex-col sm:flex-row gap-4 items-center">
              <Link
                href="/api/extension/download"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/95 px-5 py-3.5 text-xs font-bold shadow-lg shadow-primary/20 transition-all w-full sm:w-auto cursor-pointer"
              >
                <Download className="h-4 w-4" /> Télécharger LinkedIn Copilot (.ZIP)
              </Link>
              <span className="text-xxs text-muted-foreground font-semibold">
                Compatible Chrome, Brave, Edge & Opera.
              </span>
            </div>
          </div>

          {/* Right Side: High Fidelity CSS Mockup representing LinkedIn + Extension overlay */}
          <div className="lg:col-span-7 relative rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden flex flex-col min-h-[460px]">
            
            {/* Mock LinkedIn Topbar */}
            <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between text-white text-[11px] font-medium font-sans select-none">
              <div className="flex items-center gap-2">
                <span className="bg-white text-slate-950 font-bold p-1 rounded-xs flex items-center justify-center text-[10px] w-5 h-5">in</span>
                <span className="text-slate-400">Recherche : "Marc Dupuis"</span>
              </div>
              <div className="flex items-center gap-4 text-slate-400 text-xxs">
                <span>Réseau</span>
                <span>Messagerie</span>
                <span className="h-5 w-5 rounded-full bg-slate-700 flex items-center justify-center">Me</span>
              </div>
            </div>

            {/* Main Area simulating LinkedIn Profile page with clickvente extension sidebar */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-12 bg-[#f4f2ee] p-4 gap-4 font-sans select-none">
              
              {/* LinkedIn profile main card mockup (8 cols) */}
              <div className="md:col-span-7 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col justify-between shadow-xs">
                
                {/* Banner & Avatar */}
                <div>
                  <div className="bg-slate-300 h-16 w-full relative">
                    <div className="absolute top-1/2 left-4 transform h-12 w-12 rounded-full border-2 border-white bg-indigo-950 text-white font-bold flex items-center justify-center text-sm shadow-md">
                      MD
                    </div>
                  </div>
                  
                  {/* Profile info */}
                  <div className="px-4 pt-7 pb-2 space-y-1">
                    <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1">
                      Marc Dupuis 
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full font-bold">1er</span>
                    </h3>
                    <p className="text-[10px] text-slate-700 font-bold">CEO & Architecte Associé @ ArchiDesign Lyon</p>
                    <p className="text-[9px] text-slate-500 font-semibold">Lyon, Auvergne-Rhône-Alpes • 500+ relations</p>
                  </div>
                </div>

                {/* LinkedIn chat bubble mock at the bottom of profile card */}
                <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col justify-end gap-2 h-[180px] overflow-hidden">
                  <div className="text-[8px] uppercase tracking-wider text-slate-400 font-bold mb-1">
                    Messagerie avec Marc
                  </div>
                  
                  {/* Chat bubble body */}
                  <div className="flex-1 bg-white border border-slate-200 rounded-lg p-2.5 flex flex-col justify-between shadow-inner relative overflow-y-auto">
                    {generatedMsg ? (
                      <p className="text-[9px] leading-relaxed text-slate-700 whitespace-pre-line animate-fade-in font-medium">
                        {generatedMsg}
                      </p>
                    ) : (
                      <div className="text-center text-[10px] text-slate-400 italic my-auto">
                        {isGenerating ? (
                          <div className="flex flex-col items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin inline-block" />
                            <span>Le Copilot IA rédige votre message...</span>
                          </div>
                        ) : (
                          "Rédigez un pitch à droite et insérez-le ici"
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Message box footer */}
                  <div className="flex justify-between items-center bg-white border border-slate-200 p-1.5 rounded-lg text-xxs font-bold text-slate-400">
                    <span>Écrire un message...</span>
                    <span className="bg-slate-200 text-slate-500 px-2.5 py-0.5 rounded cursor-not-allowed flex items-center gap-1">
                      Envoyer <Send className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              </div>

              {/* ClickVente extension sidebar mockup overlay (5 cols) */}
              <div className="md:col-span-5 bg-slate-950 text-white rounded-xl border border-slate-800 p-4 flex flex-col justify-between shadow-2xl relative">
                
                {/* Floating extension logo indicator */}
                <div className="absolute top-2 right-2 flex items-center gap-1 text-[8px] bg-primary/20 text-primary-400 px-2 py-0.5 rounded-full font-bold border border-primary/30 animate-pulse">
                  <Sparkles className="h-2.5 w-2.5" /> Copilot IA Actif
                </div>

                <div className="space-y-4">
                  
                  {/* Extension header */}
                  <div className="border-b border-slate-800 pb-2">
                    <div className="text-[10px] font-extrabold text-primary flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5 fill-primary" /> ClickVente Copilot
                    </div>
                    <div className="text-[8px] text-slate-400 font-bold mt-0.5">EXTENSION CHROME V2.4</div>
                  </div>

                  {/* Contact enrichment status */}
                  <div className="bg-slate-900 border border-slate-800 p-2 rounded-lg space-y-1">
                    <span className="text-[8px] uppercase tracking-wider text-slate-500 font-bold">CONTACT DIRECT</span>
                    <div className="text-[10px] font-bold flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Marc@archidesign-lyon.fr
                    </div>
                    <div className="text-[8px] text-emerald-400 font-bold">Email professionnel validé</div>
                  </div>

                  {/* Pitch prompt input box */}
                  <div className="space-y-1.5">
                    <label className="text-[8px] uppercase tracking-wider text-slate-500 font-bold block">
                      VOTRE PROPOSITION DE VALEUR
                    </label>
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      disabled={isGenerating}
                      className="w-full text-[9px] bg-slate-900 border border-slate-800 rounded p-2 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary h-[50px] resize-none"
                      placeholder="Indiquez ce que vous souhaitez proposer..."
                    />
                  </div>

                </div>

                {/* Bottom button controls */}
                <div className="pt-3 border-t border-slate-800 mt-4 space-y-2">
                  <button
                    onClick={handleSimulateDraft}
                    disabled={isGenerating || !prompt}
                    className="w-full bg-primary hover:bg-primary/95 text-primary-foreground py-2 px-3 text-[9px] font-extrabold rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer shadow-md disabled:opacity-50"
                  >
                    <Sparkles className="h-3 w-3 fill-primary-foreground" />
                    {isGenerating ? `Génération (${progress}%)` : "Formuler par IA (1 crédit)"}
                  </button>

                  {generatedMsg && (
                    <button
                      onClick={() => {}}
                      className="w-full bg-slate-800 hover:bg-slate-700 text-white py-2 px-3 text-[9px] font-bold rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <MessageSquareCode className="h-3.5 w-3.5" /> Insérer dans LinkedIn (DM)
                    </button>
                  )}
                </div>

              </div>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
