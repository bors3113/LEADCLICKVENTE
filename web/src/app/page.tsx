import { Hero } from '@/components/Hero';
import { Features } from '@/components/Features';
import { Pricing } from '@/components/Pricing';
import { Contact } from '@/components/Contact';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen scroll-smooth">
      {/* Navigation */}
      <header className="absolute inset-x-0 top-0 z-50">
        <nav className="flex items-center justify-between p-6 lg:px-8" aria-label="Global">
          <div className="flex lg:flex-1">
            <Link href="/" className="-m-1.5 p-1.5 text-xl font-bold text-primary">
              ClickVente
            </Link>
          </div>
          <div className="hidden lg:flex lg:gap-x-12">
            <a href="#features" className="text-sm font-semibold leading-6 text-foreground hover:text-muted-foreground transition-colors">Features</a>
            <a href="#pricing" className="text-sm font-semibold leading-6 text-foreground hover:text-muted-foreground transition-colors">Pricing</a>
            <a href="#contact" className="text-sm font-semibold leading-6 text-foreground hover:text-muted-foreground transition-colors">Waitlist</a>
          </div>
          <div className="flex gap-x-6">
            <Link href="/login" className="text-sm font-semibold leading-6 text-foreground hover:text-muted-foreground mt-2">
              Log in
            </Link>
            <Link href="/login" className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors">
              Sign up
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-grow">
        <Hero />
        <Features />
        <Pricing />
        <Contact />
      </main>

      {/* Footer */}
      <footer className="bg-background py-12 px-6 lg:px-8 border-t border-border">
        <div className="flex flex-col items-center justify-center">
          <p className="text-sm text-muted-foreground text-center">
            &copy; {new Date().getFullYear()} LeadGen ClickVente. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
