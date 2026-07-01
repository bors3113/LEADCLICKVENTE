'use client';

import { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';

export default function NewScrapePage() {
  const [query, setQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<null | { success: boolean, jobId?: string, error?: string }>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;
    
    setIsSubmitting(true);
    setResult(null);

    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit job');
      }
      
      setResult({ success: true, jobId: data.jobId });
      setQuery('');
    } catch (error: any) {
      setResult({ success: false, error: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h3 className="text-2xl font-bold leading-6 text-foreground">New Scrape Job</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter a search query exactly as you would type it into Google Maps.
        </p>
      </div>

      <div className="bg-background rounded-lg border border-border shadow-sm overflow-hidden">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {result && (
            <div className={`p-4 rounded-md ${result.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {result.success ? `Job successfully queued! Job ID: ${result.jobId}` : `Error: ${result.error}`}
            </div>
          )}
          
          <div>
            <label htmlFor="query" className="block text-sm font-medium text-foreground">
              Search Query
            </label>
            <div className="mt-2 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              </div>
              <input
                type="text"
                name="query"
                id="query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-border rounded-md leading-5 bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
                placeholder="e.g. 'Coffee shops in Seattle, WA'"
                required
              />
            </div>
          </div>
          
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || !query}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Starting...' : 'Start Extraction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
