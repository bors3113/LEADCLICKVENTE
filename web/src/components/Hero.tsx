import Link from 'next/link';

export function Hero() {
  return (
    <div className="relative isolate px-6 pt-14 lg:px-8 bg-background overflow-hidden">
      <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80" aria-hidden="true">
        <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" style={{ clipPath: 'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)' }}></div>
      </div>
      <div className="mx-auto max-w-2xl py-32 sm:py-48 lg:py-56 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-6xl mb-6">
          Automate B2B Lead Generation at the Edge
        </h1>
        <p className="mt-6 text-lg leading-8 text-muted-foreground mb-10">
          Extract rich, accurate business data from Google Maps instantly. Say goodbye to manual scraping and unreliable proxies. LeadGen ClickVente handles it all automatically.
        </p>
        <div className="flex items-center justify-center gap-x-6">
          <Link href="/login" className="rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            Start Free Trial
          </Link>
          <a href="#features" className="text-sm font-semibold leading-6 text-foreground hover:text-muted-foreground transition-colors">
            Learn more <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </div>
  );
}
