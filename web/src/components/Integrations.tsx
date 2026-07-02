'use client';

import { Link2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface IntegrationTool {
  name: string;
  type: string;
  status: 'native' | 'upcoming' | 'api';
  description: string;
  color: string;
  icon: string;
}

export function Integrations() {
  const tools: IntegrationTool[] = [
    {
      name: 'Gmail & Google Workspace',
      type: 'Messagerie',
      status: 'native',
      description: 'Connectez vos comptes Gmail pour envoyer vos campagnes d\'outreach directement avec votre boîte pro.',
      color: 'bg-red-500/10 border-red-500/20 text-red-600',
      icon: 'GM'
    },
    {
      name: 'Outlook & Office 365',
      type: 'Messagerie',
      status: 'native',
      description: 'Associez vos adresses Outlook pour lancer vos séquences email avec une délivrabilité optimale.',
      color: 'bg-blue-500/10 border-blue-500/20 text-blue-600',
      icon: 'OL'
    }
  ];

  return (
    <div id="integrations" className="bg-background py-24 sm:py-32 border-b border-border/40 relative overflow-hidden">
      
      {/* Decorative gradient behind */}
      <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full bg-primary/5 blur-3xl -z-10" />

      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        
        {/* Header */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center mb-16">
          <div className="lg:col-span-6 space-y-4">
            <h2 className="text-sm font-semibold leading-7 text-primary flex items-center gap-1.5 uppercase tracking-widest font-bold">
              <Link2 className="h-4.5 w-4.5" /> Écosystème Connecté
            </h2>
            <p className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Connectez vos prospects à vos outils du quotidien
            </p>
          </div>
          <div className="lg:col-span-6">
            <p className="text-base text-muted-foreground leading-relaxed">
              Exportez en direct ou automatisez l'envoi de vos leads. ClickVente s'adapte à votre pile d'outils existante pour simplifier le travail de vos équipes Sales et Marketing.
            </p>
          </div>
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:max-w-4xl lg:mx-auto gap-6">
          {tools.map((tool) => (
            <div 
              key={tool.name}
              className="bg-card rounded-2xl border border-border/60 p-6 flex flex-col justify-between hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 transition-all group"
            >
              <div>
                {/* Logo indicator & Type */}
                <div className="flex justify-between items-start mb-6">
                  <div className={`h-11 w-11 rounded-xl flex items-center justify-center font-bold border text-sm ${tool.color}`}>
                    {tool.icon}
                  </div>
                  
                  {/* Status Badge */}
                  {tool.status === 'native' && (
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      Natif
                    </span>
                  )}
                  {tool.status === 'upcoming' && (
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                      Bientôt
                    </span>
                  )}
                  {tool.status === 'api' && (
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                      Webhook/API
                    </span>
                  )}
                </div>

                <div className="text-xxs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  {tool.type}
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                  {tool.name}
                </h3>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {tool.description}
                </p>
              </div>

              {/* Bottom connect link */}
              <div className="pt-5 border-t border-border/40 mt-6 flex justify-between items-center text-xxs font-bold text-muted-foreground">
                <span>Statut : Connectable</span>
                {tool.status === 'native' && (
                  <span className="text-primary group-hover:underline flex items-center gap-0.5">
                    Activer <ArrowRight className="h-3 w-3" />
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>


      </div>
    </div>
  );
}
