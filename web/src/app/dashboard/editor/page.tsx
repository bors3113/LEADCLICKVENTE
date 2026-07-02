'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  FileSpreadsheet, 
  Download, 
  Loader2, 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  X,
  Upload,
  FolderOpen
} from 'lucide-react';
import { toast } from 'sonner';

type Row = Record<string, string | number | null>;

interface ResultEntry {
  jobId: string;
  label: string;
  resultFile: string | null;
  localFile: string | null;
  filename: string | null;
  count: number;
}

function EditorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const jobIdParam = searchParams.get('jobId');
  const enrichedKeyParam = searchParams.get('key');
  const enrichedFileParam = searchParams.get('file');

  // File and data state
  const [fileInfo, setFileInfo] = useState<{ filename: string } | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Available jobs for import dropdown
  const [availableJobs, setAvailableJobs] = useState<ResultEntry[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [showJobSelector, setShowJobSelector] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  // Inline editing state
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; colKey: string } | null>(null);
  const [editingHeader, setEditingHeader] = useState<string | null>(null);
  const [editingHeaderValue, setEditingHeaderValue] = useState('');
  
  // Modals / Adding columns
  const [showAddColModal, setShowAddColModal] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColDefault, setNewColDefault] = useState('');

  // Drag and drop state
  const [isDragOver, setIsDragOver] = useState(false);
  const [exporting, setExporting] = useState<'csv' | 'excel' | 'sql' | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load job results
  const loadJobData = async (jobId: string) => {
    await Promise.resolve();
    setLoading(true);
    try {
      const res = await fetch(`/api/results/${jobId}/file`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch job file details');
      
      const fileRes = await fetch(data.url);
      if (!fileRes.ok) throw new Error('Failed to retrieve file from storage');
      
      const filename = data.filename || `job_${jobId}.csv`;
      
      if (filename.endsWith('.csv')) {
        const text = await fileRes.text();
        const Papa = await import('papaparse');
        const parsed = Papa.parse<Row>(text, { header: true, skipEmptyLines: true });
        setHeaders(parsed.meta.fields || []);
        setRows(parsed.data);
      } else {
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
      
      setFileInfo({ filename });
      setCurrentPage(0);
      toast.success(`Loaded data for Job ${jobId}`);
    } catch (err: unknown) {
      console.error(err);
      toast.error(`Error loading job data: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Load an enriched file (LinkedIn-enriched xlsx/csv) via key (R2) or file (local).
  // Always streamed through our own API route (?stream=1) rather than fetching a
  // presigned R2 URL directly — the R2 bucket has no CORS policy, so a client-side
  // fetch() against a presigned URL fails with "Failed to fetch".
  const loadEnrichedData = async (key: string | null, file: string | null) => {
    setLoading(true);
    try {
      const qs = key ? `key=${encodeURIComponent(key)}` : `file=${encodeURIComponent(file ?? '')}`;
      const filename = file || (key ? key.split('/').pop()! : 'enriched_data.xlsx');

      const fileRes = await fetch(`/api/enriched/download?${qs}&stream=1`);
      if (!fileRes.ok) {
        const err = await fileRes.json().catch(() => ({ error: 'Failed to retrieve file from storage' }));
        throw new Error(err.error || 'Failed to retrieve file from storage');
      }

      if (filename.toLowerCase().endsWith('.csv')) {
        const text = await fileRes.text();
        const Papa = await import('papaparse');
        const parsed = Papa.parse<Row>(text, { header: true, skipEmptyLines: true });
        setHeaders(parsed.meta.fields || []);
        setRows(parsed.data);
      } else {
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

      setFileInfo({ filename });
      setCurrentPage(0);
      toast.success(`Loaded enriched file: ${filename}`);
    } catch (err: unknown) {
      console.error(err);
      toast.error(`Error loading enriched file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Process manual file upload
  const processFile = async (file: File) => {
    const name = file.name;
    setLoading(true);
    try {
      if (name.endsWith('.csv')) {
        const text = await file.text();
        const Papa = await import('papaparse');
        const parsed = Papa.parse<Row>(text, { header: true, skipEmptyLines: true });
        if (parsed.meta.fields && parsed.meta.fields.length > 0) {
          setHeaders(parsed.meta.fields);
          setRows(parsed.data);
          setFileInfo({ filename: name });
          setCurrentPage(0);
          toast.success(`Loaded CSV file: ${name}`);
        } else {
          toast.error('The file does not contain valid CSV headers.');
        }
      } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        const XLSX = await import('xlsx');
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const parsed = XLSX.utils.sheet_to_json<Row>(ws, { defval: null });
        if (parsed.length > 0) {
          setHeaders(Object.keys(parsed[0]));
          setRows(parsed);
          setFileInfo({ filename: name });
          setCurrentPage(0);
          toast.success(`Loaded Excel file: ${name}`);
        } else {
          toast.error('Excel worksheet is empty.');
        }
      } else {
        toast.error('Unsupported file format. Please upload .csv or .xlsx');
      }
    } catch (err: unknown) {
      console.error(err);
      toast.error(`Error reading file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Load list of completed jobs on load
  useEffect(() => {
    async function loadJobsList() {
      setLoadingJobs(true);
      try {
        const res = await fetch('/api/results');
        const data = await res.json();
        if (data.results) {
          // Show all completed jobs — the file route resolves local files by query as fallback
          setAvailableJobs(data.results.filter((r: ResultEntry) => r.resultFile || r.localFile || r.filename));
        }
      } catch (err) {
        console.error('Error fetching jobs list:', err);
      } finally {
        setLoadingJobs(false);
      }
    }
    loadJobsList();
  }, []);

  // Load from search params if present: a scrape job, or an enriched file
  useEffect(() => {
    if (jobIdParam) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadJobData(jobIdParam);
    } else if (enrichedKeyParam || enrichedFileParam) {
      loadEnrichedData(enrichedKeyParam, enrichedFileParam);
    }
  }, [jobIdParam, enrichedKeyParam, enrichedFileParam]);

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
  };

  // Edit Handlers
  const handleCellSave = (rowIndex: number, colKey: string, value: string) => {
    const updatedRows = [...rows];
    updatedRows[rowIndex] = {
      ...updatedRows[rowIndex],
      [colKey]: value === '' ? null : value
    };
    setRows(updatedRows);
    setEditingCell(null);
  };

  const startRenameHeader = (header: string) => {
    setEditingHeader(header);
    setEditingHeaderValue(header);
  };

  const handleRenameHeader = (oldName: string) => {
    const newName = editingHeaderValue.trim();
    if (!newName || newName === oldName) {
      setEditingHeader(null);
      return;
    }
    if (headers.includes(newName)) {
      toast.error('A column with this name already exists.');
      return;
    }

    setHeaders(headers.map(h => h === oldName ? newName : h));
    setRows(rows.map(row => {
      const newRow = { ...row };
      newRow[newName] = newRow[oldName];
      delete newRow[oldName];
      return newRow;
    }));

    setEditingHeader(null);
    toast.success(`Column "${oldName}" renamed to "${newName}"`);
  };

  const handleDeleteColumn = (colName: string) => {
    if (confirm(`Are you sure you want to delete the column "${colName}"?`)) {
      setHeaders(headers.filter(h => h !== colName));
      setRows(rows.map(row => {
        const newRow = { ...row };
        delete newRow[colName];
        return newRow;
      }));
      toast.success(`Column "${colName}" deleted`);
    }
  };

  const handleAddColumn = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newColName.trim();
    if (!name) return;
    if (headers.includes(name)) {
      toast.error('A column with this name already exists.');
      return;
    }

    setHeaders([...headers, name]);
    setRows(rows.map(row => ({
      ...row,
      [name]: newColDefault || null
    })));
    setShowAddColModal(false);
    setNewColName('');
    setNewColDefault('');
    toast.success(`Column "${name}" added`);
  };

  const handleDeleteRow = (rowIndex: number) => {
    setRows(rows.filter((_, i) => i !== rowIndex));
    toast.success('Row deleted');
  };

  const handleAddRow = () => {
    const newRow: Row = {};
    headers.forEach(h => {
      newRow[h] = null;
    });
    setRows([...rows, newRow]);
    // Scroll to the bottom page if necessary
    const newTotalPages = Math.ceil((rows.length + 1) / rowsPerPage);
    setCurrentPage(newTotalPages - 1);
    toast.success('New empty row added');
  };

  // Export handlers
  const handleExport = async (format: 'csv' | 'excel' | 'sql') => {
    if (rows.length === 0) return;
    setExporting(format);
    const baseName = fileInfo?.filename?.replace(/\.[^.]+$/, '') ?? 'edited_data';
    
    function downloadBlob(blob: Blob, filename: string) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }

    try {
      if (format === 'csv') {
        const Papa = await import('papaparse');
        const csv = Papa.unparse(rows);
        downloadBlob(new Blob([csv], { type: 'text/csv' }), `${baseName}.csv`);
        toast.success('CSV downloaded successfully');
      } else if (format === 'sql') {
        const cols = headers;
        const escape = (v: unknown) => v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;
        const lines = rows.map(
          row => `INSERT INTO leads (${cols.join(', ')}) VALUES (${cols.map(c => escape(row[c])).join(', ')});`
        );
        downloadBlob(new Blob([lines.join('\n')], { type: 'text/plain' }), `${baseName}.sql`);
        toast.success('SQL script downloaded successfully');
      } else {
        const XLSX = await import('xlsx');
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Results');
        XLSX.writeFile(wb, `${baseName}.xlsx`);
        toast.success('Excel spreadsheet downloaded successfully');
      }
    } catch (err: unknown) {
      console.error(err);
      toast.error(`Failed to export: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setExporting(null);
    }
  };

  // Reset/Clear editor
  const handleReset = () => {
    if (confirm('Clear the current editor data? All unsaved edits will be lost.')) {
      setFileInfo(null);
      setHeaders([]);
      setRows([]);
      setCurrentPage(0);
      if (jobIdParam || enrichedKeyParam || enrichedFileParam) {
        router.push('/dashboard/editor');
      }
    }
  };

  // Searching & Filtering
  const filteredRows = rows.filter(row => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return Object.values(row).some(val => 
      val !== null && String(val).toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filteredRows.length / rowsPerPage);
  const paginatedRows = filteredRows.slice(
    currentPage * rowsPerPage,
    (currentPage + 1) * rowsPerPage
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top action header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-2xl font-bold leading-6 text-foreground flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 hover:rotate-6 hover:scale-105">
              <FileSpreadsheet className="h-5 w-5" />
            </span>
            <span className="bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent">
              Data Editor
            </span>
          </h3>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {fileInfo ? (
              <span>
                Editing <strong className="text-foreground font-semibold">&quot;{fileInfo.filename}&quot;</strong> ({rows.length.toLocaleString()} rows)
              </span>
            ) : (
              'Load scrape results or upload a file to edit columns, rows, and cells.'
            )}
          </p>
        </div>

        {/* Global Toolbar */}
        {rows.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowAddColModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border bg-background text-sm font-semibold text-foreground hover:bg-muted hover:text-primary transition-all shadow-sm hover:shadow cursor-pointer active:scale-95 duration-200"
            >
              <Plus className="h-4 w-4 text-primary" />
              Add Column
            </button>
            <button
              onClick={handleAddRow}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border bg-background text-sm font-semibold text-foreground hover:bg-muted hover:text-emerald-600 transition-all shadow-sm hover:shadow cursor-pointer active:scale-95 duration-200"
            >
              <Plus className="h-4 w-4 text-emerald-500" />
              Add Row
            </button>
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-red-200 bg-red-50/50 text-red-700 text-sm font-semibold hover:bg-red-50 hover:border-red-300 transition-all shadow-sm hover:shadow cursor-pointer active:scale-95 duration-200 dark:bg-red-950/20 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              <Trash2 className="h-4 w-4" />
              Clear Grid
            </button>

            <span className="w-px h-6 bg-border mx-1"></span>

            {/* Export options */}
            {(['csv', 'excel', 'sql'] as const).map(fmt => {
              const colors = {
                csv: 'bg-emerald-50 text-emerald-700 border-emerald-200/60 hover:bg-emerald-100 hover:border-emerald-300 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-400 dark:hover:bg-emerald-950/30',
                excel: 'bg-blue-50 text-blue-700 border-blue-200/60 hover:bg-blue-100 hover:border-blue-300 dark:bg-blue-950/20 dark:border-blue-900/40 dark:text-blue-400 dark:hover:bg-blue-950/30',
                sql: 'bg-violet-50 text-violet-700 border-violet-200/60 hover:bg-violet-100 hover:border-violet-300 dark:bg-violet-950/20 dark:border-violet-900/40 dark:text-violet-400 dark:hover:bg-violet-950/30',
              };
              return (
                <button
                  key={fmt}
                  onClick={() => handleExport(fmt)}
                  disabled={exporting !== null}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-sm font-semibold transition-all shadow-sm hover:shadow cursor-pointer active:scale-95 duration-200 disabled:opacity-50 ${colors[fmt]}`}
                >
                  {exporting === fmt ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {fmt.toUpperCase()}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Container */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[350px] rounded-2xl border border-border bg-card p-12 text-center shadow-md animate-pulse">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Parsing and loading data...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* File Drag and Drop Selection */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 text-center transition-all duration-300 shadow-sm ${
              isDragOver 
                ? 'border-primary bg-primary/5 scale-[1.01] shadow-md shadow-primary/5' 
                : 'border-border bg-card hover:border-primary/50 hover:shadow-md hover:shadow-primary/2'
            }`}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
              <Upload className="h-6 w-6" />
            </div>
            <h4 className="text-lg font-bold text-foreground transition-colors group-hover:text-primary">Upload your CSV or Excel file</h4>
            <p className="mt-2 text-sm text-muted-foreground max-w-xs mx-auto">
              Drag and drop your file here, or click to browse. Supports .csv, .xlsx, and .xls formats.
            </p>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv,.xlsx,.xls"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/95 transition-all shadow-md shadow-primary/20 hover:shadow-lg cursor-pointer active:scale-95 duration-200"
            >
              Browse Files
            </button>
          </div>

          {/* Job Import Selection */}
          <div className="rounded-2xl border border-border bg-card p-8 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow group">
            <div>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-100 text-violet-600 mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 dark:bg-violet-950/40 dark:text-violet-400">
                <FolderOpen className="h-6 w-6" />
              </div>
              <h4 className="text-lg font-bold text-foreground group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">Import Scrape Results</h4>
              <p className="mt-2 text-sm text-muted-foreground">
                Load data from one of your completed scrape or enrichment runs directly.
              </p>
            </div>

            <div className="mt-6 relative">
              <button
                onClick={() => setShowJobSelector(!showJobSelector)}
                className={`w-full inline-flex items-center justify-between px-4 py-3 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted transition-all cursor-pointer bg-background ${
                  showJobSelector ? 'ring-2 ring-primary/20 border-primary' : ''
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  Select a completed run...
                </span>
                <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${showJobSelector ? 'rotate-90 text-primary' : ''}`} />
              </button>

              {showJobSelector && (
                <div className="absolute left-0 right-0 mt-2 max-h-60 overflow-y-auto rounded-xl border border-border bg-card shadow-xl z-50 divide-y divide-border/60 animate-in fade-in slide-in-from-top-2 duration-200">
                  {loadingJobs ? (
                    <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground text-sm font-medium">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      Loading jobs list...
                    </div>
                  ) : availableJobs.length === 0 ? (
                    <div className="py-6 text-center text-muted-foreground text-sm font-medium">
                      No completed runs with files found.
                    </div>
                  ) : (
                    availableJobs.map(job => (
                      <button
                        key={job.jobId}
                        onClick={() => {
                          loadJobData(job.jobId);
                          setShowJobSelector(false);
                        }}
                        className="w-full text-left px-4 py-3.5 text-sm hover:bg-muted/80 transition-all flex justify-between items-center cursor-pointer font-medium"
                      >
                        <div className="truncate pr-4">
                          <span className="font-semibold block truncate text-foreground group-hover:text-primary transition-colors">{job.label}</span>
                          <span className="text-xs text-muted-foreground font-mono">ID: {job.jobId}</span>
                        </div>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 whitespace-nowrap">
                          {job.count.toLocaleString()} rows
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Data grid layout */
        <div className="space-y-4 animate-in fade-in duration-300">
          {/* Grid control bar */}
          <div className="flex items-center justify-between flex-wrap gap-4 bg-muted/40 p-4 rounded-2xl border border-border/60 shadow-sm backdrop-blur-xs">
            <div className="relative max-w-sm flex-1 min-w-[200px] group">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <input
                type="text"
                placeholder="Search values..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(0);
                }}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all placeholder:text-muted-foreground/60 shadow-inner"
              />
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setCurrentPage(0);
                  }}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-medium cursor-pointer transition-all hover:bg-muted/50"
                >
                  {[10, 25, 50, 100].map(val => (
                    <option key={val} value={val}>{val}</option>
                  ))}
                </select>
              </div>
              <span className="h-4 w-px bg-border"></span>
              <span className="text-sm font-medium">
                Total Matches: <b className="text-foreground">{filteredRows.length.toLocaleString()}</b>
              </span>
            </div>
          </div>

          {/* Core Table Grid */}
          <div className="rounded-2xl border border-border bg-card shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-muted">
              <table className="min-w-full divide-y divide-border text-sm relative">
                <thead className="bg-muted/80 sticky top-0 z-10 backdrop-blur-md">
                  <tr>
                    {/* Row action columns header */}
                    <th className="px-4 py-3.5 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider w-16 bg-muted/90 select-none">
                      Actions
                    </th>

                    {headers.map(h => (
                      <th
                        key={h}
                        className="px-4 py-3.5 text-left font-bold text-foreground whitespace-nowrap border-l border-border bg-muted/90 relative group select-none min-w-[150px]"
                      >
                        {editingHeader === h ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={editingHeaderValue}
                              onChange={(e) => setEditingHeaderValue(e.target.value)}
                              onBlur={() => handleRenameHeader(h)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameHeader(h);
                                else if (e.key === 'Escape') setEditingHeader(null);
                              }}
                              className="bg-background border border-primary px-2 py-1 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground font-semibold w-40"
                              autoFocus
                            />
                            <button onClick={() => handleRenameHeader(h)} className="p-1 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 cursor-pointer transition-colors dark:bg-emerald-950/40 dark:text-emerald-400">
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setEditingHeader(null)} className="p-1 rounded bg-red-50 text-red-500 hover:bg-red-100 cursor-pointer transition-colors dark:bg-red-950/40 dark:text-red-400">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-3">
                            <span className="truncate pr-8 font-semibold" title={h}>{h}</span>
                            
                            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all duration-200 absolute right-2.5 top-2 bg-background border border-border py-0.5 px-1 rounded-lg shadow-sm">
                              <button
                                onClick={() => startRenameHeader(h)}
                                className="text-muted-foreground hover:text-primary hover:bg-muted p-1 rounded-md cursor-pointer transition-colors"
                                title="Rename Column"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteColumn(h)}
                                className="text-muted-foreground hover:text-red-600 hover:bg-red-50 p-1 rounded-md cursor-pointer transition-colors dark:hover:bg-red-950/40"
                                title="Delete Column"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 bg-background">
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={headers.length + 1} className="py-12 text-center text-muted-foreground font-medium">
                        No rows matching your search parameters.
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row) => {
                      // Resolve absolute index in global array
                      const originalIdx = rows.indexOf(row);
                      
                      return (
                        <tr key={originalIdx} className="hover:bg-muted/30 transition-colors group/row">
                          {/* Row Actions */}
                          <td className="px-4 py-2.5 text-center whitespace-nowrap w-16">
                            <button
                              onClick={() => handleDeleteRow(originalIdx)}
                              className="text-muted-foreground hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-all cursor-pointer opacity-0 group-hover/row:opacity-100 hover:scale-105 active:scale-95 duration-150"
                              title="Delete Row"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>

                          {headers.map(h => {
                            const isEditing = editingCell?.rowIndex === originalIdx && editingCell?.colKey === h;
                            
                            return (
                              <td
                                key={h}
                                onDoubleClick={() => setEditingCell({ rowIndex: originalIdx, colKey: h })}
                                className={`px-4 py-2.5 border-l border-border/50 max-w-[300px] truncate cursor-pointer select-none transition-all duration-150 relative ${
                                  isEditing ? 'bg-primary/5 p-1' : 'hover:bg-primary/5 hover:text-primary font-medium'
                                }`}
                                title={String(row[h] ?? '')}
                              >
                                {isEditing ? (
                                  <input
                                    type="text"
                                    defaultValue={row[h] != null ? String(row[h]) : ''}
                                    onBlur={(e) => handleCellSave(originalIdx, h, e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleCellSave(originalIdx, h, e.currentTarget.value);
                                      } else if (e.key === 'Escape') {
                                        setEditingCell(null);
                                      }
                                    }}
                                    className="w-full bg-background border-2 border-primary px-2.5 py-1 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground font-medium shadow-sm"
                                    autoFocus
                                  />
                                ) : (
                                  row[h] == null ? (
                                    <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-100 text-zinc-400 border border-zinc-200/50 dark:bg-zinc-800 dark:text-zinc-500 dark:border-zinc-700/50 select-none">
                                      null
                                    </span>
                                  ) : (
                                    <span className="text-foreground transition-colors group-hover/row:text-foreground">
                                      {String(row[h])}
                                    </span>
                                  )
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground bg-card p-3.5 rounded-2xl border border-border shadow-sm">
              <span className="font-medium">
                Showing rows <b className="text-foreground">{currentPage * rowsPerPage + 1}</b>–<b className="text-foreground">{Math.min((currentPage + 1) * rowsPerPage, filteredRows.length)}</b> of <b className="text-foreground">{filteredRows.length.toLocaleString()}</b>
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="inline-flex items-center px-3 py-1.5 rounded-xl border border-border bg-background disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted transition-all cursor-pointer font-semibold text-foreground active:scale-95 duration-150 shadow-sm"
                >
                  <ChevronLeft className="h-4 w-4 mr-0.5" />
                  Prev
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage >= totalPages - 1}
                  className="inline-flex items-center px-3 py-1.5 rounded-xl border border-border bg-background disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted transition-all cursor-pointer font-semibold text-foreground active:scale-95 duration-150 shadow-sm"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-0.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Column Dialog */}
      {showAddColModal && (
        <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 duration-200 relative overflow-hidden">
            {/* Background design accents */}
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-primary/10 rounded-full blur-xl"></div>
            
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-lg font-bold text-foreground">Add New Column</h4>
                <p className="text-sm text-muted-foreground mt-0.5">Insert a new column header across all rows.</p>
              </div>
              <button
                onClick={() => {
                  setShowAddColModal(false);
                  setNewColName('');
                  setNewColDefault('');
                }}
                className="text-muted-foreground hover:text-foreground hover:bg-muted p-1.5 rounded-lg transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <form onSubmit={handleAddColumn} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Column Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Phone, Company Name"
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm placeholder:text-muted-foreground/50"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Default Value (Optional)</label>
                <input
                  type="text"
                  placeholder="Applies to all existing rows"
                  value={newColDefault}
                  onChange={(e) => setNewColDefault(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm placeholder:text-muted-foreground/50"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddColModal(false);
                    setNewColName('');
                    setNewColDefault('');
                  }}
                  className="px-4.5 py-2.5 border border-border bg-background hover:bg-muted text-sm font-semibold rounded-xl transition-all cursor-pointer active:scale-95 duration-150"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4.5 py-2.5 bg-primary hover:bg-primary/95 text-primary-foreground text-sm font-semibold rounded-xl transition-all shadow-md shadow-primary/20 cursor-pointer active:scale-95 duration-150"
                >
                  Add Column
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EditorPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64 gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span>Initializing Editor…</span>
      </div>
    }>
      <EditorContent />
    </Suspense>
  );
}
