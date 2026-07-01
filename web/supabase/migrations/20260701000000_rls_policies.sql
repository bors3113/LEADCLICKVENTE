-- RLS policies: authenticated users can read/write their own org's data.
-- Pattern: user must have a membership row for the org that owns the record.

-- ── helpers ──────────────────────────────────────────────────────────────────

-- Returns the org IDs the current user belongs to.
CREATE OR REPLACE FUNCTION public.my_org_ids()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT organization_id FROM public.memberships WHERE user_id = auth.uid();
$$;

-- ── users ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "users: own row" ON public.users;
CREATE POLICY "users: own row" ON public.users
  FOR ALL USING (id = auth.uid());

-- ── organizations ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "orgs: member access" ON public.organizations;
CREATE POLICY "orgs: member access" ON public.organizations
  FOR ALL USING (id IN (SELECT public.my_org_ids()));

-- ── memberships ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "memberships: own" ON public.memberships;
CREATE POLICY "memberships: own" ON public.memberships
  FOR ALL USING (user_id = auth.uid());

-- ── projects ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "projects: org member" ON public.projects;
CREATE POLICY "projects: org member" ON public.projects
  FOR ALL USING (organization_id IN (SELECT public.my_org_ids()));

-- ── scraping_jobs ─────────────────────────────────────────────────────────────
-- Jobs can have a NULL project_id (ad-hoc scrapes), so we allow insert for any
-- authenticated user and scope reads to jobs belonging to the user's projects.

DROP POLICY IF EXISTS "scraping_jobs: insert authenticated" ON public.scraping_jobs;
CREATE POLICY "scraping_jobs: insert authenticated" ON public.scraping_jobs
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "scraping_jobs: select own org" ON public.scraping_jobs;
CREATE POLICY "scraping_jobs: select own org" ON public.scraping_jobs
  FOR SELECT
  USING (
    project_id IS NULL
    OR project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id IN (SELECT public.my_org_ids())
    )
  );

DROP POLICY IF EXISTS "scraping_jobs: update own org" ON public.scraping_jobs;
CREATE POLICY "scraping_jobs: update own org" ON public.scraping_jobs
  FOR UPDATE
  USING (
    project_id IS NULL
    OR project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id IN (SELECT public.my_org_ids())
    )
  );

-- ── search_queries ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "search_queries: via job" ON public.search_queries;
CREATE POLICY "search_queries: via job" ON public.search_queries
  FOR ALL
  USING (
    job_id IN (SELECT id FROM public.scraping_jobs)
  );

-- ── extracted_records ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "extracted_records: via job" ON public.extracted_records;
CREATE POLICY "extracted_records: via job" ON public.extracted_records
  FOR ALL
  USING (
    job_id IN (SELECT id FROM public.scraping_jobs)
  );

-- ── api_keys ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "api_keys: org member" ON public.api_keys;
CREATE POLICY "api_keys: org member" ON public.api_keys
  FOR ALL USING (organization_id IN (SELECT public.my_org_ids()));

-- ── subscriptions ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "subscriptions: org member" ON public.subscriptions;
CREATE POLICY "subscriptions: org member" ON public.subscriptions
  FOR ALL USING (organization_id IN (SELECT public.my_org_ids()));

-- ── usage_tracking ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "usage_tracking: org member" ON public.usage_tracking;
CREATE POLICY "usage_tracking: org member" ON public.usage_tracking
  FOR ALL USING (organization_id IN (SELECT public.my_org_ids()));

-- ── plans (public read, no writes from client) ────────────────────────────────
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plans: public read" ON public.plans;
CREATE POLICY "plans: public read" ON public.plans
  FOR SELECT USING (true);

-- ── enrichment_jobs ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "enrichment_jobs: org member" ON public.enrichment_jobs;
CREATE POLICY "enrichment_jobs: org member" ON public.enrichment_jobs
  FOR ALL USING (organization_id IN (SELECT public.my_org_ids()));

-- ── enrichment_results ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "enrichment_results: via job" ON public.enrichment_results;
CREATE POLICY "enrichment_results: via job" ON public.enrichment_results
  FOR ALL
  USING (
    job_id IN (
      SELECT id FROM public.enrichment_jobs
      WHERE organization_id IN (SELECT public.my_org_ids())
    )
  );
