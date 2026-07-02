'use client';

import { useState } from 'react';
import { Sparkles, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
}

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs: FAQItem[] = [
    {
      question: 'Comment ClickVente contourne-t-il les blocages de Google Maps ?',
      answer: 'Nous n\'utilisons pas votre connexion internet pour scraper. ClickVente dispose d\'une architecture cloud de navigateurs headless qui distribue les requêtes à travers un pool de proxies résidentiels rotatifs. Cette méthode garantit une extraction ultra-rapide et sécurisée, sans aucun risque de blocage pour votre adresse IP locale.'
    },
    {
      question: 'Les adresses emails B2B récoltées sont-elles fiables ?',
      answer: 'Oui. Contrairement à d\'autres outils qui se contentent de deviner les adresses, notre algorithme effectue une triple vérification en temps réel : validation de la syntaxe de l\'email, vérification de la configuration MX du serveur DNS du destinataire, et simulation d\'envoi SMTP (sans envoyer de mail réel). Cela permet de filtrer les adresses erronées et de garantir un taux de délivrabilité supérieur à 98%.'
    },
    {
      question: 'ClickVente est-il conforme au RGPD et aux lois sur les données ?',
      answer: 'Oui, ClickVente est conforme au RGPD dans le cadre de la prospection B2B. L\'outil extrait exclusivement des informations rendues publiques par les entreprises elles-mêmes sur Google Maps et LinkedIn. Dans le cadre commercial (B2B), la loi autorise la prospection sous le principe de l\'intérêt légitime, sous réserve que vos messages proposent des services en rapport direct avec l\'activité professionnelle du destinataire et que vous incluiez un lien de désinscription simple.'
    },
    {
      question: 'Puis-je importer mes propres fichiers de prospection existants ?',
      answer: 'Absolument ! Notre Éditeur Tabulaire en ligne vous permet d\'importer des fichiers CSV ou Excel contenant des noms de sociétés et des sites internet. Vous pouvez ensuite lancer l\'enrichissement en masse directement sur ces listes importées pour trouver les décideurs LinkedIn et leurs adresses de messagerie.'
    },
    {
      question: 'Comment fonctionne la facturation et le système de crédits ?',
      answer: 'L\'accès au scraper Google Maps et à l\'éditeur est inclus dans votre forfait. L\'enrichissement de contacts (LinkedIn et emails) consomme des crédits d\'enrichissement. Vous recevez 50 crédits offerts à l\'inscription. Si vous manquez de crédits, vous pouvez recharger votre portefeuille à tout moment via des packs prépayés adaptés (Pay-As-You-Go) à partir de votre espace client. Votre abonnement mensuel est sans engagement et annulable en un clic.'
    }
  ];

  const toggleIndex = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div id="faq" className="bg-background py-24 sm:py-32 border-b border-border/40 relative overflow-hidden">
      
      {/* Background decoration */}
      <div className="absolute top-1/3 right-0 w-80 h-80 bg-primary/5 blur-3xl -z-10" />

      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center mb-16">
          <h2 className="text-sm font-semibold leading-7 text-primary flex items-center justify-center gap-1.5 uppercase tracking-widest font-bold">
            <HelpCircle className="h-4.5 w-4.5" /> Une question ?
          </h2>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Questions Fréquemment Posées
          </p>
          <p className="mt-4 text-base text-muted-foreground">
            Tout ce que vous devez savoir sur le fonctionnement technique de notre scraper et l'enrichissement de données B2B.
          </p>
        </div>

        {/* FAQ Accordion List */}
        <div className="space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div 
                key={index}
                className="bg-card rounded-2xl border border-border/60 overflow-hidden transition-all duration-200"
              >
                <button
                  onClick={() => toggleIndex(index)}
                  className="w-full flex items-center justify-between p-5 text-left text-sm sm:text-base font-bold text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
                >
                  <span>{faq.question}</span>
                  {isOpen ? (
                    <ChevronUp className="h-4.5 w-4.5 text-primary shrink-0" />
                  ) : (
                    <ChevronDown className="h-4.5 w-4.5 text-muted-foreground shrink-0" />
                  )}
                </button>
                
                {/* Expandable answer panel */}
                <div 
                  className={`transition-all duration-300 ease-in-out overflow-hidden ${
                    isOpen ? 'max-h-[300px] border-t border-border/40' : 'max-h-0'
                  }`}
                >
                  <p className="p-5 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom banner details */}
        <div className="mt-12 text-center text-xs text-muted-foreground">
          Vous ne trouvez pas la réponse à votre question ?{' '}
          <a href="mailto:support@clickvente.com" className="text-primary hover:underline font-bold">
            Contactez notre équipe de support technique
          </a>.
        </div>

      </div>
    </div>
  );
}
