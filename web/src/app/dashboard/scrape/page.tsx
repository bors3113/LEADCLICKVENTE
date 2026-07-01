'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, MapPin, Loader2, Hash, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';

const SECTORS = [
  'Restaurants',
  'Cafés',
  'Real estate agencies',
  'Marketing agencies',
  'Law firms',
  'Dentists',
  'Plumbers',
  'Gyms',
  'Hotels',
  'Car dealerships',
  'Beauty salons',
  'Accountants',
];

type JobResult = { query: string; jobId?: string; error?: string };

export default function NewScrapePage() {
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('');
  const [limit, setLimit] = useState('50');
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [results, setResults] = useState<JobResult[] | null>(null);

  function toggleSector(sector: string) {
    setSelectedSectors(prev =>
      prev.includes(sector) ? prev.filter(s => s !== sector) : [...prev, sector]
    );
  }

  // Build the list of { keyword, query } to submit.
  function buildQueries(): { keyword: string; query: string }[] {
    const loc = location.trim();
    const items: { keyword: string; query: string }[] = [];

    for (const sector of selectedSectors) {
      items.push({ keyword: sector, query: loc ? `${sector} in ${loc}` : sector });
    }
    if (keyword.trim()) {
      const k = keyword.trim();
      items.push({ keyword: k, query: loc ? `${k} in ${loc}` : k });
    }
    return items;
  }

  const queries = buildQueries();
  const parsedLimit = Math.max(1, Math.min(1000, parseInt(limit, 10) || 50));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (queries.length === 0 || !location.trim()) return;

    setIsSubmitting(true);
    setResults(null);

    const settled = await Promise.allSettled(
      queries.map(async ({ keyword: kw, query }) => {
        const res = await fetch('/api/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword: kw, location: location.trim(), query, limit: parsedLimit }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.message || JSON.stringify(data));
        return { query, jobId: data.jobId as string };
      })
    );

    const jobResults: JobResult[] = settled.map((s, i) =>
      s.status === 'fulfilled'
        ? { query: queries[i].query, jobId: s.value.jobId }
        : { query: queries[i].query, error: (s.reason as Error).message }
    );

    setResults(jobResults);
    setIsSubmitting(false);

    // Clear inputs only if everything succeeded
    if (jobResults.every(r => r.jobId)) {
      setKeyword('');
      setSelectedSectors([]);
    }
  };

  const successCount = results?.filter(r => r.jobId).length ?? 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h3 className="text-2xl font-bold leading-6 text-foreground">New Scrape Job</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick sectors or type what you&apos;re looking for, set a location and limit — each sector runs as its own
          job so you can scrape several at once.
        </p>
      </div>

      <div className="bg-background rounded-lg border border-border shadow-sm overflow-hidden">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          {/* Sectors */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Sectors <span className="text-muted-foreground font-normal">(pick one or more — each runs concurrently)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {SECTORS.map(sector => {
                const active = selectedSectors.includes(sector);
                return (
                  <button
                    key={sector}
                    type="button"
                    onClick={() => toggleSector(sector)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {sector}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Free-text keyword */}
          <div>
            <label htmlFor="keyword" className="block text-sm font-medium text-foreground">
              Or type what you&apos;re looking for{' '}
              <span className="text-muted-foreground font-normal">(optional, adds one more job)</span>
            </label>
            <div className="mt-2 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              </div>
              <input
                type="text"
                id="keyword"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-border rounded-md leading-5 bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
                placeholder="e.g. Vegan bakeries, Solar installers"
              />
            </div>
          </div>

          {/* Location + Limit */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="location" className="block text-sm font-medium text-foreground">
                Location
              </label>
              <div className="mt-2 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MapPin className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                </div>
                <input
                  type="text"
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-border rounded-md leading-5 bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
                  placeholder="e.g. Paris, France"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="limit" className="block text-sm font-medium text-foreground">
                Limit <span className="text-muted-foreground font-normal">(per job)</span>
              </label>
              <div className="mt-2 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Hash className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                </div>
                <input
                  type="number"
                  id="limit"
                  min={1}
                  max={1000}
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-border rounded-md leading-5 bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
                />
              </div>
            </div>
          </div>

          {/* Preview */}
          {queries.length > 0 && location.trim() && (
            <div className="rounded-md bg-muted/40 border border-border px-4 py-3 text-sm text-muted-foreground">
              Will queue <span className="font-semibold text-foreground">{queries.length}</span> job
              {queries.length !== 1 ? 's' : ''} (limit {parsedLimit} each):
              <ul className="mt-1.5 space-y-0.5">
                {queries.map((q, i) => (
                  <li key={i} className="text-foreground">• &ldquo;{q.query}&rdquo;</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || queries.length === 0 || !location.trim()}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting
                ? 'Starting...'
                : `Start Extraction${queries.length > 1 ? ` (${queries.length} jobs)` : ''}`}
            </button>
          </div>
        </form>
      </div>

      {/* Results summary */}
      {results && (
        <div className="bg-background rounded-lg border border-border shadow-sm p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-foreground">
              {successCount} of {results.length} job{results.length !== 1 ? 's' : ''} queued
            </h4>
            {successCount > 0 && (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
              >
                Watch live progress <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
          <ul className="space-y-2">
            {results.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                {r.jobId ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-foreground">
                      &ldquo;{r.query}&rdquo; — <span className="text-muted-foreground">queued ({r.jobId?.slice(0, 8)})</span>
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span className="text-foreground">
                      &ldquo;{r.query}&rdquo; — <span className="text-red-500">{r.error}</span>
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
