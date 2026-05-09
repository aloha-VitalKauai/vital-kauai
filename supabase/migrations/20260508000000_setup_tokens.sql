-- Custom 30-day setup tokens for the "Welcome — set up your account" flow.
--
-- Replaces Supabase's built-in recovery link (hard-capped at 24h on hosted
-- Supabase) for the initial password-creation step. The token is single-use
-- and exchanged server-side for a password set via the Supabase admin API in
-- /api/setup-account/complete.
--
-- The Supabase recovery flow is still used for /api/forgot-password (existing
-- members who already have a password and clicked "Forgot password").

create table if not exists public.setup_tokens (
  token       text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz
);

create index if not exists setup_tokens_user_id_idx on public.setup_tokens (user_id);
create index if not exists setup_tokens_unused_idx
  on public.setup_tokens (user_id)
  where used_at is null;

-- Service role only — no member-facing access. All reads/writes happen via
-- API routes using the service-role client.
alter table public.setup_tokens enable row level security;
