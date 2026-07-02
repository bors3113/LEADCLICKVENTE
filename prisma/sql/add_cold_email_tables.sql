-- Cold-email sending feature: connected mailboxes, send log, campaigns,
-- sequence steps (inert in MVP), and the suppression list.
-- Run this against the Supabase Postgres (public schema).

-- Enums --------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.email_provider AS ENUM ('google', 'microsoft');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.mailbox_status AS ENUM ('active', 'revoked', 'error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.email_message_status AS ENUM ('queued', 'sent', 'failed', 'bounced');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.campaign_status AS ENUM ('draft', 'sending', 'paused', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- mailboxes ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mailboxes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL,
  provider          public.email_provider NOT NULL,
  email             TEXT NOT NULL,
  display_name      TEXT,
  access_token_enc  TEXT,
  refresh_token_enc TEXT,
  token_expires_at  TIMESTAMPTZ,
  scopes            TEXT[] NOT NULL DEFAULT '{}',
  status            public.mailbox_status DEFAULT 'active',
  daily_send_limit  INTEGER DEFAULT 50,
  sends_today       INTEGER DEFAULT 0,
  last_send_reset   DATE,
  last_used_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT mailboxes_org_email_unique UNIQUE (organization_id, email)
);
CREATE INDEX IF NOT EXISTS mailboxes_org_idx ON public.mailboxes (organization_id);

-- email_campaigns ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  mailbox_id      UUID REFERENCES public.mailboxes(id) ON DELETE SET NULL,
  source_file     TEXT,
  status          public.campaign_status DEFAULT 'draft',
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_campaigns_org_idx ON public.email_campaigns (organization_id);

-- email_messages -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  mailbox_id          UUID NOT NULL REFERENCES public.mailboxes(id) ON DELETE CASCADE,
  campaign_id         UUID REFERENCES public.email_campaigns(id) ON DELETE SET NULL,
  to_email            TEXT NOT NULL,
  to_name             TEXT,
  subject             TEXT NOT NULL,
  body                TEXT NOT NULL,
  provider_message_id TEXT,
  thread_id           TEXT,
  status              public.email_message_status DEFAULT 'queued',
  error               TEXT,
  credits_charged     INTEGER DEFAULT 0,
  sent_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_messages_org_created_idx ON public.email_messages (organization_id, created_at);
CREATE INDEX IF NOT EXISTS email_messages_campaign_idx ON public.email_messages (campaign_id);

-- email_sequence_steps (schema only; no scheduler executes these in MVP) ----
CREATE TABLE IF NOT EXISTS public.email_sequence_steps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   UUID NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  step_order    INTEGER NOT NULL,
  wait_days     INTEGER NOT NULL DEFAULT 0,
  subject_tpl   TEXT,
  body_tpl      TEXT,
  stop_on_reply BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT email_sequence_steps_campaign_order_unique UNIQUE (campaign_id, step_order)
);

-- unsubscribes (suppression list) ------------------------------------------
CREATE TABLE IF NOT EXISTS public.unsubscribes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  reason          TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unsubscribes_org_email_unique UNIQUE (organization_id, email)
);
