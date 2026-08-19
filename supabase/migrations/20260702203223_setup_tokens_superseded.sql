-- Give "superseded by a newer link" its own state, distinct from "consumed
-- by completing setup".
--
-- Re-minting a setup link used to stamp prior tokens' used_at, so a member
-- holding an older Welcome email hit "this link has already been used — sign
-- in with the password you created" for a password that never existed.
-- superseded_at names that state so the UI can offer a fresh link instead.
--
-- Deploy order: this column-add ships BEFORE the code that writes it (old
-- code ignores the column). The companion backfill — reclassifying historical
-- re-mint stamps from used_at to superseded_at — runs as a separate step only
-- AFTER the new code is live, because old lookupSetupToken reads only used_at
-- and would treat backfilled rows as live links during the deploy window.
alter table public.setup_tokens
  add column if not exists superseded_at timestamptz;
