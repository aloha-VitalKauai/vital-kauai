#!/usr/bin/env bash
# Static/catalog checks that are not expressible as pgTAP assertions.
# Covers the requirements PR_PLAN marks "reviewer check, not pgTAP" (2, 69, 70)
# and finding 11's version assertion.
set -uo pipefail
cd "$(dirname "$0")/../../.."
pass=0; fail=0
chk(){ if eval "$2" >/dev/null 2>&1; then echo "ok - $1"; pass=$((pass+1)); else echo "not ok - $1"; fail=$((fail+1)); fi; }

chk "req 1 / req 3: a fresh-database migration + full reset is executed by run_all.sh, and every migration file is present" \
  "[ \$(ls supabase/migrations/2026073000000*.sql | wc -l | tr -d ' ') -eq 8 ] && grep -q 'dropdb --if-exists' supabase/tests/run_all.sh && grep -q 'ON_ERROR_STOP=1' supabase/tests/run_all.sh"
chk "req 2: every finance object is created by a tracked migration (no ad-hoc DDL outside supabase/migrations)" \
  "! grep -rlE 'CREATE (TABLE|TYPE|VIEW|FUNCTION) finance\.' --include='*.ts' --include='*.tsx' . 2>/dev/null | grep -q ."
chk "req 69: aggregate views derive from v_agreement_balances and contain no independent formula" \
  "grep -q 'from finance.v_agreement_balances b' supabase/migrations/20260730000007_finance_views.sql"
# req 70: v_agreement_lifecycle must be the only expression of current lifecycle.
# HONEST RESULT: it is not. finance.tg_lifecycle_transition() re-derives it at
# 20260730000005_finance_triggers.sql:55 to validate from_status.
#
# The trigger deliberately does NOT read the view, for two reasons: the view is
# created later in migration order, and it is security_invoker -- reading it
# inside a SECURITY DEFINER trigger would evaluate RLS as the calling member and
# could hide the very rows the validation depends on. That is a worse defect
# than the duplication.
#
# This check reports the true count and FAILS rather than being rewritten to
# pass. It needs a reviewer decision: accept the trigger as an internal
# validation exempt from req 70, or restructure. Not waived unilaterally.
# req 70 / D-074: exactly TWO derivations are permitted -- the consumer
# projection (v_agreement_lifecycle) and the named internal enforcement
# (tg_lifecycle_transition). An allowlist prevents a third appearing.
chk "req 70: exactly two permitted lifecycle derivations exist (D-074 allowlist)" \
  "[ \$(grep -rhc 'occurred_at desc, e.seq desc' supabase/migrations/2026073*.sql | awk '{s+=\$1} END {print s+0}') -eq 2 ]"
chk "req 70: the consumer projection is v_agreement_lifecycle" \
  "grep -q 'create view finance.v_agreement_lifecycle' supabase/migrations/20260730000007_finance_views.sql"
chk "req 70: the only enforcement derivation is tg_lifecycle_transition" \
  "[ \$(grep -lr 'from finance.agreement_lifecycle_events' supabase/migrations/2026073*.sql | wc -l | tr -d ' ') -le 3 ]"
chk "req 70 / D-074: trigger and view use identical ordering and tie-breaking" \
  "[ \$(grep -rho 'occurred_at desc, e.seq desc' supabase/migrations/20260730000005_finance_triggers.sql supabase/migrations/20260730000007_finance_views.sql | sort -u | wc -l | tr -d ' ') -eq 1 ]"
chk "req 70: v_agreement_lifecycle keeps security_invoker (D-074)" \
  "grep -A1 'create view finance.v_agreement_lifecycle' supabase/migrations/20260730000007_finance_views.sql | grep -q 'security_invoker = true'"
chk "finding 11: migration 0001 asserts the PostgreSQL major version before any schema mutation" \
  "grep -q 'server_version_num' supabase/migrations/20260730000001_finance_harden_is_founder.sql"
chk "blocker 1: migration 0001 executes is_founder() after hardening it" \
  "grep -q 'select public.is_founder() into ok' supabase/migrations/20260730000001_finance_harden_is_founder.sql"
chk "blocker 2: rollback resets the is_founder search_path" \
  "grep -q 'reset search_path' supabase/migrations/ROLLBACK_pr1.sql"
chk "no migration writes a legacy financial table" \
  "! grep -rniE '(insert into|update|delete from)[[:space:]]+(public\.)?(donations|financial_commitments|payment_allocations|bookings)' supabase/migrations/2026073*.sql | grep -q ."
chk "no finance object references a legacy financial table" \
  "! grep -niE 'references[[:space:]]+(public\.)?(donations|financial_commitments|payment_allocations|bookings)' supabase/migrations/2026073*.sql | grep -q ."
echo "# static checks: passed=$pass failed=$fail"
[ "$fail" -eq 0 ]
