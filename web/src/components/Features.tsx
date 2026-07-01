import { Globe, Zap, Shield, FileSpreadsheet } from 'lucide-react';

export function Features() {
  const features = [
    {
      name: 'Global Edge Network',
      description: 'Powered by Cloudflare Workers, our scrapers run right next to the target data sources, ensuring lightning-fast extraction and avoiding regional blocks.',
      icon: Globe,
    },
    {
      name: 'Instant Data Delivery',
      description: 'Jobs process in the background and stream results directly into your dashboard. Export to CSV or Excel with a single click.',
      icon: Zap,
    },
    {
      name: 'Undetectable Stealth',
      description: 'Built-in residential proxy rotation and browser fingerprinting ensure high success rates on every search query.',
      icon: Shield,
    },
    {
      name: 'Rich Business Profiles',
      description: 'We don\'t just grab the name. We extract phone numbers, websites, addresses, ratings, and even social media links where available.',
      icon: FileSpreadsheet,
    },
  ];

  return (
    <div id="features" className="bg-muted/30 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:text-center">
          <h2 className="text-base font-semibold leading-7 text-primary">Scrape Faster</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Everything you need to build your lead pipeline
          </p>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            LeadGen ClickVente is designed for modern growth teams who need accurate B2B data without the hassle of managing their own scraping infrastructure.
          </p>
        </div>
        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-4xl">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none lg:grid-cols-2 lg:gap-y-16">
            {features.map((feature) => (
              <div key={feature.name} className="relative pl-16">
                <dt className="text-base font-semibold leading-7 text-foreground">
                  <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                    <feature.icon className="h-6 w-6 text-primary-foreground" aria-hidden="true" />
                  </div>
                  {feature.name}
                </dt>
                <dd className="mt-2 text-base leading-7 text-muted-foreground">{feature.description}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
