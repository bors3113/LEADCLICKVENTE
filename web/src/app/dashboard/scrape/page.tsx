'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, MapPin, Loader2, Hash, CheckCircle2, XCircle, ArrowRight, Plus, X } from 'lucide-react';
import { ActiveJobsPanel } from '@/components/ActiveJobsPanel';

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
type JobBlock = { id: string; keyword: string; location: string; limit: string };

let blockSeq = 0;
const newBlock = (): JobBlock => ({ id: `block-${blockSeq++}`, keyword: '', location: '', limit: '50' });

// A block is ready to run when it has both a keyword and a location.
function blockQuery(block: JobBlock): { keyword: string; query: string; location: string; limit: number } | null {
  const kw = block.keyword.trim();
  const loc = block.location.trim();
  if (!kw || !loc) return null;
  return {
    keyword: kw,
    location: loc,
    query: `${kw} in ${loc}`,
    limit: Math.max(1, Math.min(1000, parseInt(block.limit, 10) || 50)),
  };
}

export default function NewScrapePage() {
  const [blocks, setBlocks] = useState<JobBlock[]>([newBlock()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [results, setResults] = useState<JobResult[] | null>(null);

  function addBlock() {
    setBlocks(prev => [...prev, newBlock()]);
  }

  function removeBlock(id: string) {
    setBlocks(prev => (prev.length > 1 ? prev.filter(b => b.id !== id) : prev));
  }

  function updateBlock(id: string, patch: Partial<JobBlock>) {
    setBlocks(prev => prev.map(b => (b.id === id ? { ...b, ...patch } : b)));
  }

  const queries = blocks.map(blockQuery).filter((q): q is NonNullable<typeof q> => q !== null);
  const canSubmit = queries.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setResults(null);

    const settled = await Promise.allSettled(
      queries.map(async ({ keyword, query, location, limit }) => {
        const res = await fetch('/api/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword, location, query, limit }),
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

    // Reset to a single empty block only if everything succeeded
    if (jobResults.every(r => r.jobId)) {
      setBlocks([newBlock()]);
    }
  };

  const successCount = results?.filter(r => r.jobId).length ?? 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h3 className="text-2xl font-bold leading-6 text-foreground">New Scrape Job</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Each block is its own job with its own location and limit — add as many as you like with the
          &ldquo;Add job&rdquo; button and start them all at once.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {blocks.map((block, index) => {
          const activeSector = block.keyword.trim().toLowerCase();
          return (
            <div key={block.id} className="bg-background rounded-lg border border-border shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 pt-5">
                <span className="text-sm font-semibold text-foreground">Job {index + 1}</span>
                <button
                  type="button"
                  onClick={() => removeBlock(block.id)}
                  disabled={blocks.length === 1}
                  aria-label="Remove job"
                  className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 pt-4 space-y-6">
                {/* Sectors */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Sectors <span className="text-muted-foreground font-normal">(quick pick)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SECTORS.map(sector => {
                      const active = activeSector === sector.toLowerCase();
                      return (
                        <button
                          key={sector}
                          type="button"
                          onClick={() => updateBlock(block.id, { keyword: active ? '' : sector })}
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
                  <label className="block text-sm font-medium text-foreground">
                    Or type what you&apos;re looking for
                  </label>
                  <div className="mt-2 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                    </div>
                    <input
                      type="text"
                      value={block.keyword}
                      onChange={(e) => updateBlock(block.id, { keyword: e.target.value })}
                      className="block w-full pl-10 pr-3 py-3 border border-border rounded-md leading-5 bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
                      placeholder="e.g. Vegan bakeries, Solar installers"
                    />
                  </div>
                </div>

                {/* Location + Limit */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-foreground">Location</label>
                    <div className="mt-2 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <MapPin className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      </div>
                      <input
                        type="text"
                        value={block.location}
                        onChange={(e) => updateBlock(block.id, { location: e.target.value })}
                        className="block w-full pl-10 pr-3 py-3 border border-border rounded-md leading-5 bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
                        placeholder="e.g. Paris, France"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground">
                      Limit <span className="text-muted-foreground font-normal">(per job)</span>
                    </label>
                    <div className="mt-2 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Hash className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      </div>
                      <input
                        type="number"
                        min={1}
                        max={1000}
                        value={block.limit}
                        onChange={(e) => updateBlock(block.id, { limit: e.target.value })}
                        className="block w-full pl-10 pr-3 py-3 border border-border rounded-md leading-5 bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Add job + Start */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={addBlock}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <Plus className="h-4 w-4" /> Add job
          </button>

          <button
            type="submit"
            disabled={isSubmitting || !canSubmit}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting
              ? 'Starting...'
              : `Start Extraction${queries.length > 1 ? ` (${queries.length} jobs)` : ''}`}
          </button>
        </div>
      </form>

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

      {/* Persisted, live-updating jobs — visible whenever you return to this page */}
      <ActiveJobsPanel />
    </div>
  );
}
