-- Supabase Realtime only broadcasts postgres_changes for tables in this
-- publication; scraping_jobs must be listed for live job progress in the UI.
ALTER PUBLICATION supabase_realtime ADD TABLE public.scraping_jobs;
