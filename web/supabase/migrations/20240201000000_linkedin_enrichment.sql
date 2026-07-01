-- LinkedIn data enrichment pack (Apify): new tables + billing columns.

-- Enrichment jobs: one row per "enrich this scraped file" run.
CREATE TABLE public.enrichment_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_file TEXT NOT NULL,
  types TEXT[] NOT NULL DEFAULT '{}',
  status job_status DEFAULT 'queued'::job_status,
  total_rows INTEGER DEFAULT 0,
  enriched_count INTEGER DEFAULT 0,
  credits_charged INTEGER DEFAULT 0,
  output_file TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Enrichment results: raw LinkedIn data per identifier, keyed to a job.
CREATE TABLE public.enrichment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.enrichment_jobs(id) ON DELETE CASCADE,
  identifier TEXT NOT NULL,
  type TEXT NOT NULL,
  linkedin_data JSONB,
  apify_run_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX enrichment_results_job_id_type_idx ON public.enrichment_results (job_id, type);

-- Bundled monthly enrichment quota per plan.
ALTER TABLE public.plans
  ADD COLUMN enrichment_credit_limit INTEGER NOT NULL DEFAULT 0;

-- Per-billing-period enrichment credit meter (separate from scraping credits).
ALTER TABLE public.usage_tracking
  ADD COLUMN enrichment_credits_used INTEGER DEFAULT 0;

-- Pay-as-you-go enrichment credit balance from one-time top-ups.
ALTER TABLE public.organizations
  ADD COLUMN enrichment_credit_balance INTEGER DEFAULT 0;

-- Enable RLS to match the other tables.
ALTER TABLE public.enrichment_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrichment_results ENABLE ROW LEVEL SECURITY;
