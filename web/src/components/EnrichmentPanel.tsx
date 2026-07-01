'use client';

import { useState, useEffect } from 'react';
import { Loader2, CheckCircle, XCircle, Download, ChevronDown } from 'lucide-react';

type EnrichType = 'company' | 'employees' | 'profile';

interface EnrichmentPanelProps {
  enrichBalance: number;
  totalEnrichmentJobs: number;
}

const TYPE_LABELS: Record<EnrichType, string> = {
  company: 'Company details (1 credit/row)',
  employees: 'Company employees (2 credits/row)',
  profile: 'LinkedIn profiles (4 credits/row)',
};

interface ResultFile {
  jobId: string;
  label: string;
  filename: string | null;
  resultFile: string | null;
  createdAt: string;
}

interface EnrichResult {
  success: boolean;
  fileName?: string;
  downloadUrl?: string;
  enrichedCount?: number;
  creditsCharged?: number;
  creditsByType?: Record<string, number>;
  bundledRemaining?: number;
  paygBalance?: number;
  error?: string;
  estimatedCost?: number;
  available?: number;
}

const COSTS: Record<EnrichType, number> = { company: 1, employees: 2, profile: 4 };

export function EnrichmentPanel({ enrichBalance, totalEnrichmentJobs }: EnrichmentPanelProps) {
  const [resultFiles, setResultFiles] = useState<ResultFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [types, setTypes] = useState<EnrichType[]>(['company']);
  const [estimatedRows, setEstimatedRows] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EnrichResult | null>(null);

  useEffect(() => {
    fetch('/api/results')
      .then(r => r.json())
      .then(data => {
        setResultFiles(data.results ?? []);
        if (data.results?.length > 0) setSelectedJobId(data.results[0].jobId);
      })
      .catch(() => {})
      .finally(() => setFilesLoading(false));
  }, []);

  function toggleType(type: EnrichType) {
    setTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  }

  const rows = parseInt(estimatedRows, 10) || 0;
  const estimatedCost = types.reduce((sum, t) => sum + rows * COSTS[t], 0);

  const selectedFile = resultFiles.find(f => f.jobId === selectedJobId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile || types.length === 0) return;

    // Use the resultFile key (R2 path) or fall back to a job-based filename
    const filename = selectedFile.resultFile ?? `results/${selectedFile.jobId}.csv`;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, types, estimatedRows: rows }),
      });

      const data = await res.json() as Omit<EnrichResult, 'success'>;
      setResult({ ...data, success: res.ok });
    } catch (err: unknown) {
      setResult({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Enrich form */}
      <div className="border border-border rounded-lg bg-background p-6">
        <h4 className="font-semibold text-foreground mb-4">Enrich a scraped file</h4>
        <form onSubmit={handleSubmit} className="space-y-4">

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Select result file
            </label>
            {filesLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading files…
              </div>
            ) : resultFiles.length === 0 ? (
              <p className="text-sm text-muted-foreground bg-muted/40 border border-border rounded-md px-3 py-2">
                No completed scrape jobs yet. Run a scrape first.
              </p>
            ) : (
              <div className="relative">
                <select
                  value={selectedJobId}
                  onChange={e => setSelectedJobId(e.target.value)}
                  className="w-full appearance-none rounded-md border border-border bg-muted px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                >
                  {resultFiles.map(f => (
                    <option key={f.jobId} value={f.jobId}>
                      {f.label} — {new Date(f.createdAt).toLocaleDateString()}
                      {f.resultFile ? ' ✓' : ' (no file)'}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            )}
            {selectedFile && !selectedFile.resultFile && (
              <p className="mt-1 text-xs text-amber-600">
                This job has no stored file yet — enrichment will use the job ID to locate the file on the backend.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Enrichment types
            </label>
            <div className="space-y-2">
              {(Object.keys(TYPE_LABELS) as EnrichType[]).map(type => (
                <label key={type} className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={types.includes(type)}
                    onChange={() => toggleType(type)}
                    className="rounded border-border text-primary focus:ring-primary"
                  />
                  {TYPE_LABELS[type]}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Approximate row count{' '}
              <span className="text-muted-foreground font-normal">(for cost estimate)</span>
            </label>
            <input
              type="number"
              min="0"
              value={estimatedRows}
              onChange={e => setEstimatedRows(e.target.value)}
              placeholder="e.g. 200"
              className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {rows > 0 && types.length > 0 && (
            <div className="rounded-md bg-muted/50 border border-border px-3 py-2 text-sm">
              <span className="text-muted-foreground">Estimated cost: </span>
              <span className="font-semibold text-foreground">{estimatedCost} credits</span>
              <span className="text-muted-foreground"> · PAYG balance: </span>
              <span className={enrichBalance >= estimatedCost ? 'text-green-500 font-semibold' : 'text-red-500 font-semibold'}>
                {enrichBalance}
              </span>
              {enrichBalance < estimatedCost && (
                <span className="text-red-500 ml-1">
                  — <a href="/billing" className="underline">buy more credits</a>
                </span>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || types.length === 0 || !selectedJobId || resultFiles.length === 0}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-md py-2 text-sm font-semibold hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enriching… (may take a few minutes)
              </>
            ) : (
              'Enrich with LinkedIn'
            )}
          </button>
        </form>

        {result && (
          <div className={`mt-4 rounded-md border p-4 text-sm ${result.success ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
            {result.success ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-semibold text-green-600">
                  <CheckCircle className="h-4 w-4" /> Enrichment complete
                </div>
                <p className="text-foreground">
                  {result.enrichedCount} rows enriched · {result.creditsCharged} credits charged
                </p>
                {result.creditsByType && (
                  <ul className="text-muted-foreground text-xs space-y-0.5">
                    {Object.entries(result.creditsByType).map(([t, n]) => (
                      <li key={t}>{t}: {n} rows</li>
                    ))}
                  </ul>
                )}
                {result.fileName && (
                  <a
                    href={`/api/download?file=${result.fileName}`}
                    className="inline-flex items-center gap-1.5 mt-2 text-primary underline font-medium"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download {result.fileName}
                  </a>
                )}
                <p className="text-xs text-muted-foreground">
                  Remaining PAYG balance: {result.paygBalance ?? enrichBalance} credits
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-red-600">Enrichment failed</p>
                  <p className="text-foreground mt-1">{result.error}</p>
                  {result.estimatedCost !== undefined && result.available !== undefined && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      Needed {result.estimatedCost} credits, have {result.available}.{' '}
                      <a href="/billing" className="underline text-primary">Buy more →</a>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats panel */}
      <div className="border border-border rounded-lg bg-background p-6 flex flex-col gap-4">
        <h4 className="font-semibold text-foreground">Enrichment summary</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md bg-muted/40 border border-border p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{totalEnrichmentJobs}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Completed jobs</p>
          </div>
          <div className="rounded-md bg-muted/40 border border-border p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{enrichBalance.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-0.5">PAYG credits left</p>
          </div>
        </div>

        <div className="rounded-md bg-muted/30 border border-border p-4 text-xs text-muted-foreground space-y-2">
          <p className="font-medium text-foreground text-sm">Credit costs (per successfully enriched row)</p>
          <ul className="space-y-1">
            <li><span className="font-semibold text-foreground">1 credit</span> — Company details (name, size, industry, HQ, LinkedIn page)</li>
            <li><span className="font-semibold text-foreground">2 credits</span> — Company employees (list of employees with titles & profiles)</li>
            <li><span className="font-semibold text-foreground">4 credits</span> — Profile scraper (full profile + emails/phones)</li>
          </ul>
          <p>Credits are charged <strong>on success only</strong>. Failed or missing lookups cost nothing.</p>
          <a href="/billing" className="inline-block mt-1 text-primary underline font-medium">
            Buy more credits →
          </a>
        </div>
      </div>
    </div>
  );
}
