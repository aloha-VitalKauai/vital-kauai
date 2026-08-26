#!/usr/bin/env bash
# Sessions V1 Build 2 — TRUE two-session concurrency proof for booking holds.
#
# The acceptance criterion: 1 session left + two simultaneous booking attempts
# → only one succeeds. Two separate psql backends race acquire_session_hold()
# for the same member; the transaction-scoped advisory lock inside the
# function serializes them, so exactly one hold may ever be granted per round
# REGARDLESS of timing. Several rounds are run; any round with two grants (or
# two table rows) fails the suite. The assertion cannot false-negative on a
# slow machine — serial execution must still yield exactly one grant.
set -euo pipefail

export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
export LC_ALL="en_US.UTF-8"
DB="${1:-sessions_v1_conc}"
ROUNDS=5

echo "== fresh database for concurrency rounds =="
dropdb --if-exists "$DB"; createdb "$DB"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f supabase/tests/_local_bootstrap.sql
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f supabase/migrations/20260825235000_sessions_v1_foundation.sql
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f supabase/migrations/20260826003000_sessions_v2_booking_holds.sql
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f supabase/migrations/20260826020000_sessions_default_program_grant.sql

# The full production schema is applied above, so activating this member fires
# the default program grant (10 coaching). This test is about the LAST session,
# so the auto-granted ledger is cleared and replaced with exactly one — stated
# explicitly here rather than depending on whatever the default happens to be.
psql -q -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'member-a@test.local');
insert into public.member_profiles (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'member-a@test.local');
insert into public.members (id, profile_id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001',
   'aaaaaaaa-0000-4000-8000-000000000001', 'member-a@test.local');

delete from public.member_session_allowances
 where member_id = 'aaaaaaaa-0000-4000-8000-000000000001';
insert into public.member_session_allowances (member_id, session_type, quantity, reason)
  values ('aaaaaaaa-0000-4000-8000-000000000001', 'coaching', 1, 'program');

do $$
begin
  if (select coalesce(sum(quantity),0) from public.member_session_allowances
       where member_id='aaaaaaaa-0000-4000-8000-000000000001' and session_type='coaching') <> 1 then
    raise exception 'concurrency seed is not exactly 1 coaching session';
  end if;
end $$;
SQL

ACQUIRE="select count(*) from public.acquire_session_hold('aaaaaaaa-0000-4000-8000-000000000001','coaching');"

for round in $(seq 1 "$ROUNDS"); do
  psql -q -d "$DB" -v ON_ERROR_STOP=1 -c "delete from public.session_booking_holds;" >/dev/null

  out1=$(mktemp); out2=$(mktemp)
  psql -tA -d "$DB" -c "$ACQUIRE" > "$out1" 2>&1 &
  p1=$!
  psql -tA -d "$DB" -c "$ACQUIRE" > "$out2" 2>&1 &
  p2=$!
  wait "$p1" || { echo "Bail out! round $round: session 1 errored: $(cat "$out1")"; exit 1; }
  wait "$p2" || { echo "Bail out! round $round: session 2 errored: $(cat "$out2")"; exit 1; }

  g1=$(tr -dc '0-9' < "$out1"); g2=$(tr -dc '0-9' < "$out2")
  rm -f "$out1" "$out2"
  grants=$(( g1 + g2 ))
  rows=$(psql -tA -d "$DB" -c "select count(*) from public.session_booking_holds;")

  if [ "$grants" -ne 1 ] || [ "$rows" -ne 1 ]; then
    echo "not ok $round - round $round: expected exactly one grant, got grants=$grants rows=$rows"
    exit 1
  fi
  echo "ok $round - round $round: two simultaneous attempts, exactly one hold granted"
done

echo "# concurrency: $ROUNDS/$ROUNDS rounds passed (one grant per round, always)"
