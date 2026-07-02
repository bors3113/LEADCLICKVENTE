'use client';

import { useEffect, useState, use } from 'react';
import { FileSpreadsheet, Download, Loader2, ArrowLeft, ChevronLeft, ChevronRight, Table } from 'lucide-react';
import Link from 'next/link';
import Papa from 'papaparse';

const PAGE_SIZE = 50;

type Row = Record<string, string | number | null>;

interface FileInfo {
  url: string;
  filename: string;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCSV(rows: Row[], filename: string) {
  const csv = Papa.unparse(rows);
  downloadBlob(new Blob([csv], { type: 'text/csv' }), filename);
}

function exportSQL(rows: Row[], tableName: string, filename: string) {
  if (rows.length === 0) return;
  const cols = Object.keys(rows[0]);
  const escape = (v: unknown) =>
    v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;
  const lines = rows.map(
    row => `INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${cols.map(c => escape(row[c])).join(', ')});`
  );
  downloadBlob(new Blob([lines.join('\n')], { type: 'text/plain' }), filename);
}

async function exportExcel(rows: Row[], filename: string) {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Results');
  XLSX.writeFile(wb, filename);
}

export default function ResultViewerPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = use(params);

  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        // Get presigned URL from our route
        const res = await fetch(`/api/results/${jobId}/file`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to load file info');
        }

        setFileInfo({ url: data.url, filename: data.filename });

        // Fetch the actual file content
        const fileRes = await fetch(data.url);
        if (!fileRes.ok) throw new Error('Failed to fetch file from storage');

        const filename: string = data.filename ?? '';

        if (filename.endsWith('.csv')) {
          const text = await fileRes.text();
          const parsed = Papa.parse<Row>(text, { header: true, skipEmptyLines: true });
          setHeaders(parsed.meta.fields ?? []);
          setRows(parsed.data);
        } else {
          // Excel via SheetJS
          const XLSX = await import('xlsx');
          const buffer = await fileRes.arrayBuffer();
          const wb = XLSX.read(buffer, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const parsed = XLSX.utils.sheet_to_json<Row>(ws, { defval: null });
          if (parsed.length > 0) {
            setHeaders(Object.keys(parsed[0]));
          }
          setRows(parsed);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load file');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [jobId]);

  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const baseName = fileInfo?.filename?.replace(/\.[^.]+$/, '') ?? `job_${jobId}`;

  async function handleExport(format: 'csv' | 'excel' | 'sql') {
    setExporting(format);
    try {
      if (format === 'csv') exportCSV(rows, `${baseName}.csv`);
      else if (format === 'sql') exportSQL(rows, 'leads', `${baseName}.sql`);
      else await exportExcel(rows, `${baseName}.xlsx`);
    } finally {
      setExporting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span>Loading results…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/results" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Results
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
          <p className="font-semibold">Could not load file</p>
          <p className="mt-1 text-sm">{error}</p>
          {error.includes('No result file') && (
            <p className="mt-2 text-sm text-red-600">
              This job does not have a stored file in R2 yet. Jobs must be processed by the Cloudflare Worker (not the local scraper) to generate R2 files, or you need to configure R2 credentials.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/results" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              {fileInfo?.filename ?? `Job ${jobId}`}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {rows.length.toLocaleString()} rows
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/editor?jobId=${jobId}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Table className="h-3.5 w-3.5" />
            Edit Data
          </Link>

          {(['csv', 'excel', 'sql'] as const).map(fmt => (
            <button
              key={fmt}
              onClick={() => handleExport(fmt)}
              disabled={exporting !== null || rows.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {exporting === fmt ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {fmt.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-muted-foreground">No rows found in this file.</p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    {headers.map(h => (
                      <th
                        key={h}
                        className="px-3 py-3 text-left font-semibold text-foreground whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-background">
                  {pageRows.map((row, i) => (
                    <tr key={i} className="hover:bg-muted/20 transition-colors">
                      {headers.map(h => (
                        <td
                          key={h}
                          className="px-3 py-2.5 text-muted-foreground max-w-[240px] truncate"
                          title={String(row[h] ?? '')}
                        >
                          {row[h] != null ? String(row[h]) : ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Showing rows {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, rows.length)} of {rows.length.toLocaleString()}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="inline-flex items-center px-2 py-1 rounded border border-border disabled:opacity-40 hover:bg-muted"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="inline-flex items-center px-2 py-1 rounded border border-border disabled:opacity-40 hover:bg-muted"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
