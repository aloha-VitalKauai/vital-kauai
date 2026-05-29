-- Booking + payment status tracking.
--
-- Holds the editable booking_status / payment_status the founder dashboard
-- surfaces, plus Square payment reference IDs that a future Square
-- integration PR will populate. Stripe remains the active payment provider
-- on the `donations` table; this table tracks lifecycle independently so
-- the founder can move a member through inquiry → confirmed → completed
-- without touching the payment-provider data model.
--
-- One row per active booking cycle; no unique constraint on member_id so
-- a member who completes one journey and books another gets a fresh row
-- rather than reusing a terminal-state record.

create type public.booking_status as enum (
  'inquiry',
  'invited',
  'booked',
  'confirmed',
  'completed',
  'cancelled'
);

create type public.payment_status as enum (
  'unpaid',
  'payment_link_sent',
  'deposit_paid',
  'paid',
  'payment_plan_active',
  'failed',
  'refunded'
);

-- Bookings holds the current lifecycle state for a member's journey.
-- Money detail (per-transaction history) lives on `donations`; we keep
-- `amount_due_cents` and `amount_paid_cents` denormalized here so the
-- dashboard + portal can render totals without joining donations every
-- time. The Square webhook (PR 2) and founder edits keep them in sync.
create table if not exists public.bookings (
  id                       uuid primary key default gen_random_uuid(),
  member_id                uuid not null references public.members(id) on delete cascade,
  journey_id               uuid,
  booking_status           public.booking_status not null default 'inquiry',
  payment_status           public.payment_status not null default 'unpaid',
  package_name             text,
  amount_due_cents         integer,
  amount_paid_cents        integer not null default 0,
  square_payment_link_id   text,
  square_payment_id        text,
  square_order_id          text,
  square_customer_id       text,
  paid_at                  timestamptz,
  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists bookings_member_id_idx        on public.bookings (member_id);
create index if not exists bookings_journey_id_idx       on public.bookings (journey_id);
create index if not exists bookings_booking_status_idx   on public.bookings (booking_status);
create index if not exists bookings_payment_status_idx   on public.bookings (payment_status);
create index if not exists bookings_member_recent_idx    on public.bookings (member_id, created_at desc);

create or replace function public.bookings_set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists bookings_set_updated_at on public.bookings;
create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.bookings_set_updated_at();

-- Seed one row per existing member so the dashboard renders something
-- immediately. Conservative inference: members with a recorded deposit
-- map to 'booked'/'deposit_paid'; everyone else to 'invited'/'unpaid'.
-- Founders can move statuses forward from the dashboard.
insert into public.bookings (member_id, booking_status, payment_status)
select
  m.id,
  case
    when mp.deposit_paid then 'booked'::public.booking_status
    else                      'invited'::public.booking_status
  end,
  case
    when mp.deposit_paid then 'deposit_paid'::public.payment_status
    else                      'unpaid'::public.payment_status
  end
from public.members m
left join public.member_profiles mp on mp.email = m.email
where not exists (
  select 1 from public.bookings b where b.member_id = m.id
);

alter table public.bookings enable row level security;

drop policy if exists "founders read bookings"  on public.bookings;
drop policy if exists "founders write bookings" on public.bookings;
drop policy if exists "members read own booking" on public.bookings;

-- Founders (hardcoded UUIDs, matching lib/auth/founder-check.ts) have
-- full access. Founder dashboard pages use the cookie-auth server client,
-- so RLS — not just app-level checks — has to allow them through.
create policy "founders read bookings" on public.bookings
  for select to authenticated
  using (
    auth.uid() in (
      'd6e824e3-69ab-447c-b046-afecfe4b7028'::uuid,
      '268f721a-9c7c-4bb2-82b7-3c29178281b1'::uuid
    )
  );

create policy "founders write bookings" on public.bookings
  for all to authenticated
  using (
    auth.uid() in (
      'd6e824e3-69ab-447c-b046-afecfe4b7028'::uuid,
      '268f721a-9c7c-4bb2-82b7-3c29178281b1'::uuid
    )
  )
  with check (
    auth.uid() in (
      'd6e824e3-69ab-447c-b046-afecfe4b7028'::uuid,
      '268f721a-9c7c-4bb2-82b7-3c29178281b1'::uuid
    )
  );

-- Members read their own bookings by joining auth.uid() through
-- member_profiles.email to members.email (the auth user id is the
-- member_profile id, not the members.id).
create policy "members read own booking" on public.bookings
  for select to authenticated
  using (
    exists (
      select 1
      from public.member_profiles mp
      join public.members m on m.email = mp.email
      where mp.id = auth.uid()
        and m.id = bookings.member_id
    )
  );
