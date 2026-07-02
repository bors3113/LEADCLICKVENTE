'use client';

import { useEffect, useState } from 'react';
import { FileSpreadsheet, ArrowRight, Download, Loader2, Sparkles, Table } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import Papa from 'papaparse';

type ResultEntry = {
  jobId: string;
  label: string;
  query: string | null;
  keyword: string | null;
  location: string | null;
  resultFile: string | null;
  localFile: string | null;
  filename: string | null;
  count: number;
  createdAt: string;
  completedAt: string | null;
  projectName: string | null;
};

type EnrichedEntry = {
  key: string;            // R2 object key, or '' when local-only
  filename: string;
  label: string;
  source: 'r2' | 'local';
  size: number | null;
  createdAt: string;
};

type Tab = 'scraped' | 'enriched';
type Format = 'csv' | 'excel' | 'sql';

const FORMAT_COLORS: Record<Format, string> = {
  csv:   'bg-emerald-50 text-emerald-600 border-emerald-200/60 hover:bg-emerald-100 hover:border-emerald-300 shadow-[0_2px_10px_-3px_rgba(16,185,129,0.2)]',
  excel: 'bg-blue-50 text-blue-600 border-blue-200/60 hover:bg-blue-100 hover:border-blue-300 shadow-[0_2px_10px_-3px_rgba(59,130,246,0.2)]',
  sql:   'bg-violet-50 text-violet-600 border-violet-200/60 hover:bg-violet-100 hover:border-violet-300 shadow-[0_2px_10px_-3px_rgba(139,92,246,0.2)]',
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ResultsPage() {
  const [tab, setTab] = useState<Tab>('scraped');
  const [results, setResults] = useState<ResultEntry[]>([]);
  const [enriched, setEnriched] = useState<EnrichedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrichedLoading, setEnrichedLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/results')
      .then(r => r.json())
      .then(d => setResults(d.results ?? []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));

    fetch('/api/enriched')
      .then(r => r.json())
      .then(d => setEnriched(d.results ?? []))
      .catch(() => setEnriched([]))
      .finally(() => setEnrichedLoading(false));
  }, []);

  async function handleExport(r: ResultEntry, format: Format) {
    const key = `${r.jobId}-${format}`;
    setExporting(key);
    const tid = toast.loading(`Preparing ${format.toUpperCase()} export…`);
    try {
      if (r.resultFile) {
        // Has R2 file — use the detail page viewer approach: get presigned URL then fetch
        const res = await fetch(`/api/results/${r.jobId}/file`);
        if (!res.ok) throw new Error('Failed to get file URL');
        const { url, filename } = await res.json();
        if (format === 'csv') {
          window.open(url, '_blank');
          toast.success('File opened', { id: tid });
          return;
        }
        const fileRes = await fetch(url);
        if (!fileRes.ok) throw new Error('Failed to fetch file');
        const text = await fileRes.text();
        const parsed = Papa.parse<Record<string, string | number | null>>(text, { header: true, skipEmptyLines: true });
        const rows = parsed.data;
        const baseName = (filename ?? `job_${r.jobId}`).replace(/\.[^.]+$/, '');
        await exportRows(rows, baseName, format);
      } else if (r.localFile) {
        // Local Excel file saved by scraper — download via /api/download then convert
        if (format === 'excel') {
          // Direct download of the xlsx
          const a = document.createElement('a');
          a.href = `/api/download?file=${encodeURIComponent(r.localFile)}`;
          a.download = r.localFile;
          a.click();
          toast.success('Excel downloaded', { id: tid });
          return;
        }
        // For CSV/SQL: fetch the xlsx, parse it, re-export
        const res = await fetch(`/api/download?file=${encodeURIComponent(r.localFile)}`);
        if (!res.ok) throw new Error('Could not fetch result file');
        const XLSX = await import('xlsx');
        const buffer = await res.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
        const baseName = r.localFile.replace(/\.[^.]+$/, '');
        await exportRows(rows, baseName, format);
      } else {
        // No file anywhere — try extracted_records in DB
        const res = await fetch(`/api/export?jobId=${r.jobId}&format=${format}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Export failed' }));
          throw new Error(err.error || 'Export failed');
        }
        const contentType = res.headers.get('content-type') ?? '';
        if (contentType.includes('text/csv')) {
          const blob = await res.blob();
          downloadBlob(blob, `job_${r.jobId}.csv`);
          toast.success('CSV downloaded', { id: tid });
          return;
        }
        const data = await res.json();
        if (data.url) {
          window.open(data.url, '_blank');
          toast.success('Export ready', { id: tid });
          return;
        }
        if (data.rows) {
          const baseName = `job_${r.jobId}`;
          await exportRows(data.rows, baseName, format);
        }
      }
      toast.success(`${format.toUpperCase()} exported`, { id: tid });
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Export failed', { id: tid });
    } finally {
      setExporting(null);
    }
  }

  // Enriched files live on R2 (or locally as fallback). Native formats open in a
  // new browser tab; SQL is generated client-side after parsing.
  async function handleExportEnriched(e: EnrichedEntry, format: Format) {
    const exKey = `${e.filename}-${format}`;
    setExporting(exKey);
    const tid = toast.loading(`Preparing ${format.toUpperCase()}…`);
    try {
      const qs = e.key
        ? `key=${encodeURIComponent(e.key)}`
        : `file=${encodeURIComponent(e.filename)}`;
      const isCsvFile = e.filename.toLowerCase().endsWith('.csv');
      const nativeFormat: Format = isCsvFile ? 'csv' : 'excel';

      // Resolve to a fetchable URL: presigned R2 URL, or the local stream endpoint.
      const metaRes = await fetch(`/api/enriched/download?${qs}`);
      let fileUrl: string;
      if (metaRes.headers.get('content-type')?.includes('application/json')) {
        const meta = await metaRes.json();
        if (!metaRes.ok || !meta.url) throw new Error(meta.error || 'Could not resolve file');
        fileUrl = meta.url;
      } else {
        // Local stream: build a direct URL the browser can open/fetch.
        fileUrl = `/api/enriched/download?${qs}`;
      }

      if (format === nativeFormat) {
        // Same format as the stored file — just open it in a new tab.
        window.open(fileUrl, '_blank');
        toast.success('Opened in new tab', { id: tid });
        return;
      }

      // Convert to the requested format.
      const fileRes = await fetch(fileUrl);
      if (!fileRes.ok) throw new Error('Failed to fetch file');
      const baseName = e.filename.replace(/\.[^.]+$/, '');
      let rows: Record<string, unknown>[];
      if (isCsvFile) {
        const text = await fileRes.text();
        rows = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true }).data;
      } else {
        const XLSX = await import('xlsx');
        const buffer = await fileRes.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: null });
      }
      await exportRows(rows, baseName, format);
      toast.success(`${format.toUpperCase()} exported`, { id: tid });
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Export failed', { id: tid });
    } finally {
      setExporting(null);
    }
  }

  const showLoader = tab === 'scraped' ? loading : enrichedLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold leading-6 text-foreground">Results</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {tab === 'scraped'
              ? `${results.length} completed ${results.length === 1 ? 'job' : 'jobs'} — export as CSV, Excel, or SQL`
              : `${enriched.length} LinkedIn-enriched ${enriched.length === 1 ? 'file' : 'files'} — download or re-export`}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        <TabButton active={tab === 'scraped'} onClick={() => setTab('scraped')} icon={<FileSpreadsheet className="h-4 w-4" />}>
          Scraped
        </TabButton>
        <TabButton active={tab === 'enriched'} onClick={() => setTab('enriched')} icon={<Sparkles className="h-4 w-4" />} count={enriched.length}>
          Enriched
        </TabButton>
      </div>

      {showLoader ? (
        <div className="flex items-center justify-center h-48 gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading…</span>
        </div>
      ) : tab === 'scraped' ? (
        results.length === 0 ? (
          <EmptyState
            title="No completed jobs yet"
            body="Run a scrape job and come back here to view and export the results."
            cta={{ href: '/dashboard/scrape', label: 'Start a Scrape' }}
          />
        ) : (
          <TableShell headers={['Search', 'Leads', 'Date', 'Export']}>
            {results.map((r) => {
              const isExportingThis = exporting?.startsWith(r.jobId);
              return (
                <tr key={r.jobId} className="hover:bg-muted/30 transition-colors group">
                  <td className="py-4 pl-6 pr-3">
                    <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{r.label}</p>
                    {r.projectName && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/40"></span>
                        {r.projectName}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-4 text-sm font-medium whitespace-nowrap">
                    {r.count > 0 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold tabular-nums border border-primary/20">
                        {r.count.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-4 text-sm text-muted-foreground whitespace-nowrap">
                    {formatDate(r.createdAt)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <ExportButtons
                        disabled={!!isExportingThis}
                        activeKey={exporting}
                        keyPrefix={r.jobId}
                        onExport={(fmt) => handleExport(r, fmt)}
                      />
                      {(r.resultFile || r.localFile || r.filename) && (
                        <Link
                          href={`/dashboard/editor?jobId=${r.jobId}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-[11px] font-semibold tracking-wide hover:bg-indigo-100 hover:border-indigo-300 transition-all duration-200 hover:-translate-y-0.5 shadow-[0_2px_10px_-3px_rgba(99,102,241,0.2)] dark:bg-indigo-950/20 dark:border-indigo-900/40 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
                          title="Open in Data Editor"
                        >
                          <Table className="h-3.5 w-3.5" />
                          EDIT
                        </Link>
                      )}
                      {r.resultFile && (
                        <Link
                          href={`/dashboard/results/${r.jobId}`}
                          className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors ml-1"
                          title="View Details"
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </TableShell>
        )
      ) : enriched.length === 0 ? (
        <EmptyState
          title="No enriched files yet"
          body="Enrich a scraped file with LinkedIn data and it will appear here for download."
          cta={{ href: '/dashboard/enrich', label: 'Enrich a File' }}
        />
      ) : (
        <TableShell headers={['Source', 'Format', 'Date', 'Download']}>
          {enriched.map((e) => {
            const isExportingThis = exporting?.startsWith(e.filename);
            const isCsv = e.filename.toLowerCase().endsWith('.csv');
            return (
              <tr key={e.filename} className="hover:bg-muted/30 transition-colors group">
                <td className="py-4 pl-6 pr-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-violet-100 text-violet-600">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground group-hover:text-violet-600 transition-colors">{e.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">LinkedIn enriched</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-4 text-sm font-medium text-muted-foreground whitespace-nowrap uppercase">
                  {isCsv ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-xs">CSV</span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/60 text-xs">XLSX</span>
                  )}
                </td>
                <td className="px-3 py-4 text-sm text-muted-foreground whitespace-nowrap">
                  {formatDate(e.createdAt)}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <ExportButtons
                      disabled={!!isExportingThis}
                      activeKey={exporting}
                      keyPrefix={e.filename}
                      onExport={(fmt) => handleExportEnriched(e, fmt)}
                    />
                    <Link
                      href={`/dashboard/editor?${e.key ? `key=${encodeURIComponent(e.key)}` : `file=${encodeURIComponent(e.filename)}`}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-[11px] font-semibold tracking-wide hover:bg-indigo-100 hover:border-indigo-300 transition-all duration-200 hover:-translate-y-0.5 shadow-[0_2px_10px_-3px_rgba(99,102,241,0.2)] dark:bg-indigo-950/20 dark:border-indigo-900/40 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
                      title="Open in Data Editor"
                    >
                      <Table className="h-3.5 w-3.5" />
                      EDIT
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </TableShell>
      )}
    </div>
  );
}

function TabButton({
  active, onClick, icon, count, children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {icon}
      {children}
      {typeof count === 'number' && count > 0 && (
        <span className={`ml-1 rounded-full px-1.5 py-0.5 text-xs ${active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function ExportButtons({
  disabled, activeKey, keyPrefix, onExport,
}: {
  disabled: boolean;
  activeKey: string | null;
  keyPrefix: string;
  onExport: (format: Format) => void;
}) {
  return (
    <>
      {(['csv', 'excel', 'sql'] as const).map(fmt => (
        <button
          key={fmt}
          onClick={() => onExport(fmt)}
          disabled={disabled}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold tracking-wide transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:-translate-y-0.5 ${FORMAT_COLORS[fmt]}`}
        >
          {activeKey === `${keyPrefix}-${fmt}` ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          {fmt.toUpperCase()}
        </button>
      ))}
    </>
  );
}

function TableShell({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden">
      <table className="min-w-full divide-y divide-border/50">
        <thead className="bg-muted/30">
          <tr>
            {headers.map((h, i) => (
              <th
                key={h}
                className={`py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground ${
                  i === 0 ? 'pl-6 pr-3 text-left' : i === headers.length - 1 ? 'px-6 text-right' : 'px-3 text-left'
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50 bg-transparent">{children}</tbody>
      </table>
    </div>
  );
}

function EmptyState({ title, body, cta }: { title: string; body: string; cta: { href: string; label: string } }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
      <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
      <h4 className="text-lg font-medium text-foreground">{title}</h4>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      <Link
        href={cta.href}
        className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        {cta.label}
      </Link>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function exportRows(rows: Record<string, unknown>[], baseName: string, format: Format) {
  if (rows.length === 0) return;
  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  if (format === 'csv') {
    const Papa = await import('papaparse');
    const csv = Papa.unparse(rows as Record<string, unknown>[]);
    downloadBlob(new Blob([csv], { type: 'text/csv' }), `${baseName}.csv`);
  } else if (format === 'sql') {
    const cols = Object.keys(rows[0]);
    const escape = (v: unknown) => v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;
    const lines = rows.map(
      row => `INSERT INTO leads (${cols.join(', ')}) VALUES (${cols.map(c => escape(row[c])).join(', ')});`
    );
    downloadBlob(new Blob([lines.join('\n')], { type: 'text/plain' }), `${baseName}.sql`);
  } else {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Results');
    XLSX.writeFile(wb, `${baseName}.xlsx`);
  }
}
