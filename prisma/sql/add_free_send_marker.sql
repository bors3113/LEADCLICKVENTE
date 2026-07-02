-- Marks whether an email_messages row was sent from the free monthly quota
-- (as opposed to charged against enrichment_credit_balance), so send history
-- can distinguish free vs paid without inferring it from credits_charged == 0
-- (which is already overloaded for the "ran out of credits mid-loop" case).
ALTER TABLE public.email_messages
  ADD COLUMN IF NOT EXISTS is_free_send BOOLEAN NOT NULL DEFAULT FALSE;
