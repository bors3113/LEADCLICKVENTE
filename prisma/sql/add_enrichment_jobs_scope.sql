-- prisma/schema.prisma already declares enrichment_jobs.scope, but this
-- column was missing from the live database, which made every
-- prisma.enrichment_jobs.create() call in enrichFile throw and get silently
-- swallowed (job runs with jobRecord = null, so there's no jobId to poll and
-- progress can't be tracked once the request that started it goes away).
ALTER TABLE public.enrichment_jobs
  ADD COLUMN IF NOT EXISTS scope TEXT;
