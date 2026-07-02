'use client';

import { useState, useEffect } from 'react';
import {
  Loader2,
  CheckCircle,
  XCircle,
  Download,
  ChevronDown,
  Building,
  Users,
  Sparkles,
  HelpCircle,
  Coins,
  Search,
  ArrowRight,
  Info,
  AlertTriangle,
  Play,
  FileSpreadsheet,
  ExternalLink,
  Check
} from 'lucide-react';
import Link from 'next/link';

type EnrichType = 'employees' | 'profile';
type CascadeScope = 'all' | 'capped' | 'decision-makers';

// Per-profile cascade rate, by scope. Decision-makers carry a premium since
// they're higher business value than an unfiltered/capped employee list.
// Mirrors config.apify.cascadePerProfileByScope on the backend.
const CASCADE_PER_PROFILE_BY_SCOPE: Record<CascadeScope, number> = {
  all: 3,
  capped: 3,
  'decision-makers': 5,
};

const TYPE_DETAILS: Record<EnrichType, {
  title: string;
  shortDesc: string;
  longDesc: string;
  costLabel: string;
  costValue: number;
  icon: typeof Building;
}> = {
  employees: {
    title: 'Company employees',
    shortDesc: 'Retrieve directory of employees',
    longDesc: 'Finds and lists the names, public LinkedIn profile links, and current job titles of people working at the company. Essential for prospecting lists.',
    costLabel: '2 credits per company',
    costValue: 2,
    icon: Users,
  },
  profile: {
    title: 'Employee profiles (LinkedIn cascade)',
    shortDesc: 'Deep scrape individual profiles',
    longDesc: 'Performs a deep-dive extraction of individual employee profiles. Retrieves work history, skills, education, locations, and languages. Runs as a cascade.',
    costLabel: '2 base + 3-5 per profile (by scope)',
    costValue: 3, // Base is 2; per-profile rate varies by scope, see CASCADE_PER_PROFILE_BY_SCOPE
    icon: Sparkles,
  },
};

const SCOPE_DETAILS: Record<CascadeScope, {
  title: string;
  desc: string;
}> = {
  'decision-makers': {
    title: 'Decision-makers only',
    desc: 'Restricts profiling to key personnel (Founders, C-Level, VP, Directors, Heads). Higher per-profile rate reflects contact value.',
  },
  capped: {
    title: 'Top N employees per company',
    desc: 'Caps the number of employees profiled per company. Highly recommended to control credit usage.',
  },
  all: {
    title: 'All employees',
    desc: 'Scrapes all employees matching the company directory. Use with caution on large organizations.',
  },
};

interface ResultFile {
  jobId: string;
  label: string;
  filename: string | null;
  resultFile: string | null;
  localFile: string | null;
  createdAt: string;
  count?: number;
  projectName?: string | null;
}

interface EnrichResult {
  success: boolean;
  fileName?: string;
  downloadUrl?: string;
  enrichedCount?: number;
  creditsCharged?: number;
  error?: string;
  insufficientCredits?: boolean;
  required?: number;
  available?: number;
  shortfall?: number;
}

export function EnrichmentPanel() {
  const [resultFiles, setResultFiles] = useState<ResultFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [types, setTypes] = useState<EnrichType[]>(['employees']);
  const [scope, setScope] = useState<CascadeScope>('capped');
  const [profileCap, setProfileCap] = useState(10);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EnrichResult | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetch('/api/results')
      .then(r => r.json())
      .then(data => {
        setResultFiles(data.results ?? []);
        if (data.results?.length > 0) {
          setSelectedJobId(data.results[0].jobId);
        }
      })
      .catch(() => {})
      .finally(() => setFilesLoading(false));
  }, []);

  useEffect(() => {
    fetch('/api/enrich')
      .then(r => r.json())
      .then(data => setBalance(data.totalAvailable ?? 0))
      .catch(() => {});
  }, []);

  const cascadeSelected = types.includes('profile');

  function toggleType(type: EnrichType) {
    setTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  }

  const selectedFile = resultFiles.find(f => f.jobId === selectedJobId);
  const rowCount = selectedFile?.count ?? 0;

  // Filter result files based on search
  const filteredFiles = resultFiles.filter(f => {
    const q = searchQuery.toLowerCase();
    return (
      f.label.toLowerCase().includes(q) ||
      (f.projectName?.toLowerCase() || '').includes(q) ||
      f.jobId.toLowerCase().includes(q)
    );
  });

  // Calculate live cost estimates
  let estimatedCost = 0;
  const breakdown: { name: string; formula: string; cost: number }[] = [];

  if (selectedFile && types.length > 0) {
    if (types.includes('employees')) {
      const cost = rowCount * 2;
      estimatedCost += cost;
      breakdown.push({
        name: 'Company Employees',
        formula: `${rowCount} companies × 2 credits`,
        cost,
      });
    }
    if (types.includes('profile')) {
      // 2 base per company + a per-profile rate that varies by scope
      const baseCost = rowCount * 2;
      const perProfileRate = CASCADE_PER_PROFILE_BY_SCOPE[scope];
      let profileFactor = 10; // Default estimate factor
      let profileLabel = 'capped limit (10)';

      if (scope === 'capped') {
        profileFactor = profileCap;
        profileLabel = `capped limit (${profileCap})`;
      } else if (scope === 'decision-makers') {
        profileFactor = 5; // Average estimate for decision makers
        profileLabel = 'decision-makers (est. 5/co)';
      } else if (scope === 'all') {
        profileFactor = 20; // Average employees for small-medium target
        profileLabel = 'all employees (est. 20/co)';
      }

      const cascadeProfileCost = rowCount * profileFactor * perProfileRate;
      const totalCascade = baseCost + cascadeProfileCost;
      estimatedCost += totalCascade;

      breakdown.push({
        name: 'Profile Cascade Base',
        formula: `${rowCount} companies × 2 base credits`,
        cost: baseCost,
      });
      breakdown.push({
        name: 'Profiles Scraped',
        formula: `${rowCount} companies × ${profileLabel} × ${perProfileRate} credits`,
        cost: cascadeProfileCost,
      });
    }
  }

  const isBalanceSufficient = balance === null || balance >= estimatedCost;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile || types.length === 0) return;

    // The backend enrichment only accepts a bare basename (e.g. "search.csv") —
    // its validator rejects paths with slashes, and it reads the file from its
    // own results/ dir via path.basename anyway. resultFile is stored as an R2
    // key like "results/<name>.csv", so strip the directory before sending.
    const rawFile = selectedFile.resultFile ?? selectedFile.localFile ?? `${selectedFile.jobId}.csv`;
    const filename = rawFile.split(/[\\/]/).pop() ?? rawFile;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename,
          types,
          ...(cascadeSelected ? { scope } : {}),
          ...(cascadeSelected && scope === 'capped' ? { profileCap } : {}),
        }),
      });

      const data = await res.json();
      if (res.status === 402) {
        setResult({ success: false, insufficientCredits: true, ...data });
      } else {
        setResult({ ...data, success: res.ok });
        if (res.ok) {
          // Refresh credit balance
          fetch('/api/enrich')
            .then(r => r.json())
            .then(d => setBalance(d.totalAvailable ?? 0))
            .catch(() => {});
        }
      }
    } catch (err: unknown) {
      setResult({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
      {/* Configuration steps */}
      <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-8">
        
        {/* STEP 1: Select Dataset */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                1
              </span>
              <h2 className="text-lg font-bold text-foreground">Select Source File / Dataset</h2>
            </div>
            {selectedFile && (
              <span className="text-xs font-medium text-primary bg-primary/5 px-2.5 py-1 rounded-full border border-primary/10">
                {rowCount} leads loaded
              </span>
            )}
          </div>
          
          <p className="text-sm text-muted-foreground">
            Choose a successfully completed Google Maps scraping job to enrich with LinkedIn details.
          </p>

          {filesLoading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading completed jobs…
            </div>
          ) : resultFiles.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg p-8 text-center space-y-4 bg-muted/20">
              <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground/60" />
              <div>
                <h3 className="font-semibold text-foreground text-sm">No scraper data found</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  You need to successfully scrape locations and gather leads before configuring LinkedIn enrichment.
                </p>
              </div>
              <Link
                href="/dashboard/scrape"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-xs font-semibold px-4 py-2 rounded-md hover:bg-primary/90 transition shadow-sm"
              >
                Start New Scrape <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Search bar inside selector */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search files, projects or queries..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full rounded-md border border-border bg-muted/30 px-9 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Scrollable list selector */}
              <div className="border border-border rounded-lg overflow-hidden bg-background max-h-[220px] overflow-y-auto divide-y divide-border">
                {filteredFiles.length === 0 ? (
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    No matching completed jobs found.
                  </div>
                ) : (
                  filteredFiles.map(f => {
                    const isSelected = f.jobId === selectedJobId;
                    return (
                      <button
                        type="button"
                        key={f.jobId}
                        onClick={() => setSelectedJobId(f.jobId)}
                        className={`w-full text-left p-3 flex items-center justify-between text-sm transition ${
                          isSelected ? 'bg-primary/5' : 'hover:bg-muted/30'
                        }`}
                      >
                        <div className="space-y-1 pr-4 min-w-0">
                          <div className="font-medium text-foreground truncate">{f.label}</div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
                            {f.projectName && (
                              <span className="font-semibold text-primary bg-primary/5 border border-primary/10 rounded px-1">
                                {f.projectName}
                              </span>
                            )}
                            <span>Scraped {new Date(f.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs text-muted-foreground bg-muted border border-border px-2 py-0.5 rounded font-mono">
                            {f.count ?? 0} rows
                          </span>
                          <div className={`h-5 w-5 rounded-full border flex items-center justify-center transition-all ${
                            isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background'
                          }`}>
                            {isSelected && <Check className="h-3 w-3" />}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* STEP 2: Enrichment Types */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              2
            </span>
            <h2 className="text-lg font-bold text-foreground">Choose Enrichment Depth</h2>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Select the levels of enrichment to run on your leads. Selecting multiple options runs them sequentially.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(Object.keys(TYPE_DETAILS) as EnrichType[]).map(type => {
              const details = TYPE_DETAILS[type];
              const isSelected = types.includes(type);
              const IconComp = details.icon;
              return (
                <button
                  type="button"
                  key={type}
                  onClick={() => toggleType(type)}
                  className={`relative flex flex-col text-left p-4 rounded-xl border-2 transition-all cursor-pointer group ${
                    isSelected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/25'
                      : 'border-border bg-background hover:border-muted-foreground/30 hover:bg-muted/10'
                  }`}
                >
                  <div className="flex items-start justify-between w-full mb-3">
                    <div className={`p-2 rounded-lg ${
                      isSelected ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground group-hover:text-foreground'
                    } transition-colors`}>
                      <IconComp className="h-5 w-5" />
                    </div>
                    <span className={`text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded border transition-colors ${
                      isSelected ? 'bg-primary/15 text-primary border-primary/20' : 'bg-muted text-muted-foreground border-border'
                    }`}>
                      {details.costLabel}
                    </span>
                  </div>

                  <h3 className="font-bold text-sm text-foreground mb-1 flex items-center gap-1">
                    {details.title}
                  </h3>
                  
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 mb-2 flex-grow">
                    {details.longDesc}
                  </p>

                  <div className="mt-auto pt-2 flex items-center justify-end w-full">
                    <div className={`h-4 w-4 rounded-sm border flex items-center justify-center transition-all ${
                      isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background'
                    }`}>
                      {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 3: Cascading Scopes (Conditionally displayed) */}
        {cascadeSelected && (
          <div className="bg-card border border-primary/10 rounded-xl p-6 shadow-sm space-y-5 bg-gradient-to-br from-background to-primary/5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                3
              </span>
              <h2 className="text-lg font-bold text-foreground">Configure Employee Profile Scoping</h2>
            </div>
            
            <p className="text-sm text-muted-foreground">
              You selected <strong>Employee profiles</strong>. Define which profiles should be targeted to stay within budget constraints.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(Object.keys(SCOPE_DETAILS) as CascadeScope[]).map(s => {
                const isSelected = scope === s;
                const details = SCOPE_DETAILS[s];
                return (
                  <button
                    type="button"
                    key={s}
                    onClick={() => setScope(s)}
                    className={`text-left p-4 rounded-lg border-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-primary bg-background shadow-sm ring-1 ring-primary/10'
                        : 'border-border bg-muted/10 hover:border-muted-foreground/20 hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-sm text-foreground">{details.title}</h4>
                      <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                        isSelected ? 'border-primary' : 'border-border'
                      }`}>
                        {isSelected && <div className="h-2 w-2 rounded-full bg-primary" />}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-normal">
                      {details.desc}
                    </p>
                  </button>
                );
              })}
            </div>

            {scope === 'capped' && (
              <div className="bg-background border border-border rounded-lg p-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Number of profiles per company
                  </label>
                  <span className="text-sm font-mono font-bold text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10">
                    {profileCap} employees max
                  </span>
                </div>
                
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={1}
                    max={50}
                    value={profileCap}
                    onChange={e => setProfileCap(Number(e.target.value))}
                    className="flex-1 accent-primary h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                  />
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={profileCap}
                    onChange={e => setProfileCap(Math.max(1, Number(e.target.value) || 1))}
                    className="w-20 rounded border border-border bg-background px-2.5 py-1 text-center text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Limits the LinkedIn scrape query to the top {profileCap} employee ranks per organization. Helps conserve credits.
                </p>
              </div>
            )}

            <div className="flex items-start gap-2 bg-primary/5 border border-primary/10 rounded-lg p-3 text-xs text-muted-foreground">
              <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <strong>Credit Consumption:</strong> Cascade charges 2 credits per company for employee lists, plus 3 credits for each profile scraped. Cost estimates will dynamically scale based on your limits.
              </div>
            </div>
          </div>
        )}
      </form>

      {/* Right Column: Dynamic Wallet & Calculation */}
      <div className="space-y-6 lg:sticky lg:top-6">
        
        {/* Wallet & Cost Calculator */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-5">
          <h3 className="font-bold text-foreground text-sm uppercase tracking-wider border-b border-border pb-3">
            Summary & Credit Calculator
          </h3>

          {/* Current balance */}
          <div className="flex items-center justify-between bg-muted/40 border border-border rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-primary" />
              <div>
                <div className="text-[10px] text-muted-foreground uppercase font-bold">Wallet Balance</div>
                <div className="font-bold text-foreground">
                  {balance !== null ? `${balance.toLocaleString()} credits` : 'Loading…'}
                </div>
              </div>
            </div>
            
            <Link
              href="/billing"
              className="inline-flex items-center gap-1 text-xs text-primary font-bold hover:underline"
            >
              Add <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          {/* Cost details */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Enrichment Estimate
            </h4>

            {selectedFile ? (
              types.length > 0 ? (
                <div className="space-y-2">
                  <div className="divide-y divide-border/60 bg-muted/10 border border-border/60 rounded-lg overflow-hidden">
                    {breakdown.map((item, idx) => (
                      <div key={idx} className="flex justify-between p-2.5 text-xs">
                        <div>
                          <p className="font-medium text-foreground">{item.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{item.formula}</p>
                        </div>
                        <span className="font-bold text-foreground shrink-0">{item.cost.toLocaleString()} cr</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-sm font-semibold text-foreground">Total Estimated Cost:</span>
                    <span className="text-lg font-black text-primary font-mono">{estimatedCost.toLocaleString()} cr</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic py-2">
                  Select at least one enrichment type.
                </p>
              )
            ) : (
              <p className="text-xs text-muted-foreground italic py-2">
                Select a scraping file in Step 1 to calculate cost.
              </p>
            )}
          </div>

          {/* Wallet check alert */}
          {!isBalanceSufficient && selectedFile && (
            <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/25 rounded-lg p-3 text-xs text-amber-600">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <strong>Insufficient Balance:</strong> This run requires approximately {estimatedCost.toLocaleString()} credits. Top up your account to execute this request.
              </div>
            </div>
          )}

          {/* Submit button */}
          <button
            onClick={() => {
              const form = document.querySelector('form');
              if (form) form.requestSubmit();
            }}
            type="button"
            disabled={
              loading ||
              types.length === 0 ||
              !selectedJobId ||
              resultFiles.length === 0 ||
              !isBalanceSufficient
            }
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-bold hover:bg-primary/95 transition duration-150 shadow-md hover:shadow-primary/10 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enriching Lead Data…
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current text-primary-foreground" />
                Launch LinkedIn Enrichment
              </>
            )}
          </button>
        </div>

        {/* Results log */}
        {result && (
          <div className={`rounded-xl border p-5 shadow-sm space-y-3 text-sm animate-in fade-in duration-200 ${
            result.success
              ? 'border-green-500/30 bg-green-500/5'
              : 'border-red-500/30 bg-red-500/5'
          }`}>
            {result.success ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 font-bold text-green-600">
                  <CheckCircle className="h-5 w-5" /> Enrichment complete
                </div>
                <div className="space-y-1 text-xs text-foreground">
                  {result.enrichedCount !== undefined && (
                    <p>✓ Successfully enriched: <span className="font-bold">{result.enrichedCount} rows</span></p>
                  )}
                  {result.creditsCharged !== undefined && (
                    <p>✓ Credits consumed: <span className="font-bold">{result.creditsCharged} credits</span></p>
                  )}
                </div>
                {result.fileName && (
                  <a
                    href={`/api/download?file=${result.fileName}`}
                    className="inline-flex w-full items-center justify-center gap-2 mt-2 bg-green-600 text-white rounded-md py-1.5 text-xs font-bold hover:bg-green-700 transition"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download Enriched CSV
                  </a>
                )}
              </div>
            ) : result.insufficientCredits ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2 text-red-600 font-bold">
                  <XCircle className="h-5 w-5 shrink-0" />
                  <span>Credits Depleted</span>
                </div>
                <p className="text-xs text-foreground leading-normal">
                  The enrichment pipeline requires <span className="font-semibold text-red-600">{result.required}</span> credits.
                  You have <span className="font-semibold">{result.available}</span> (short by {result.shortfall}).
                </p>
                <Link
                  href="/billing"
                  className="block text-center w-full bg-red-600 text-white rounded-md py-1.5 text-xs font-bold hover:bg-red-700 transition"
                >
                  Buy Enrichment Credits
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-start gap-2 text-red-600 font-bold">
                  <XCircle className="h-5 w-5 shrink-0" />
                  <span>Enrichment Job Failed</span>
                </div>
                <p className="text-xs text-foreground leading-relaxed">
                  {result.error ?? 'An unexpected network error occurred while running the enrichment script.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
