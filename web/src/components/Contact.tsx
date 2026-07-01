'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function Contact() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to subscribe');

      toast.success('You\'re on the list! We\'ll be in touch.');
      setEmail('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="contact" className="bg-muted/30 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
        <div className="relative isolate overflow-hidden bg-background px-6 py-24 shadow-2xl sm:rounded-3xl sm:px-24 xl:py-32 border border-border">
          <h2 className="mx-auto max-w-2xl text-center text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Get notified when we launch new enterprise features.
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-lg leading-8 text-muted-foreground">
            We're constantly adding new data points and scraping capabilities. Join our newsletter to stay updated.
          </p>
          <form className="mx-auto mt-10 flex max-w-md gap-x-4" onSubmit={handleSubmit}>
            <label htmlFor="email-address" className="sr-only">Email address</label>
            <input
              id="email-address"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-w-0 flex-auto rounded-md border-0 bg-background/5 px-3.5 py-2 text-foreground shadow-sm ring-1 ring-inset ring-border focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6"
              placeholder="Enter your email"
            />
            <button
              type="submit"
              disabled={loading}
              className="flex-none rounded-md bg-primary px-3.5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Notify me'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
