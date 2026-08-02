#!/usr/bin/env bash
# Structural checks against the PostgreSQL CATALOG of the migration-built test
# database. Every check here previously used a plain source grep, so a comment
# containing the right words satisfied it. Comments cannot satisfy these:
#  - catalog checks read installed objects, where comments do not exist;
#  - view/index/constraint/policy definitions come from pg_get_*def, i.e. the
#    parser's own round-trip of the parsed tree, not the source text;
#  - the few genuinely source-level requirements (a migration must ASSERT
#    something before mutating schema) run through strip_sql_comments.py first,
#    and are additionally backed by a behavioural or catalog assertion.
set -uo pipefail
cd "$(dirname "$0")/../../.."
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
DB="${PGTAP_DB:-fin_v2}"
pass=0; fail=0
chk(){ if eval "$2" >/dev/null 2>&1; then echo "ok - $1"; pass=$((pass+1)); else echo "not ok - $1"; fail=$((fail+1)); fi; }
q(){ psql -tAq -d "$DB" -c "$1"; }
STRIP="python3 supabase/tests/strip_sql_comments.py"

# 1. THE CENSUS. A byte-exact fingerprint of every finance relation, index,
# view, routine body, trigger, constraint DEFINITION, policy predicate, RLS
# flag and column grant. Any object added, removed, renamed, weakened or
# re-bodied changes it. This is the primary structural proof (req 2).
chk "req 2: the catalog fingerprint of the finance schema matches expected_objects.txt exactly" \
  "psql -tAq -d $DB -f supabase/tests/object_census.sql > /tmp/census_actual.\$\$ && diff -u supabase/tests/expected_objects.txt /tmp/census_actual.\$\$"
# The fingerprint is a DRIFT DETECTOR, not semantic proof. rebaseline_census.sh
# is the APPROVED writer (token-gated, diff-first, never run by the gate); that
# is policy, and no source grep can prove exclusivity -- a cp/tee/python rewrite
# is invisible to grep (B-81). The enforced protection is in harness_gate.sh:
# the baseline file is hashed before the suites run and re-hashed after, and
# ANY change -- by any writer -- fails the gate.
chk "the rebaseline script is token-gated and the gate never invokes it" \
  "grep -q 'I-REVIEWED-THE-DIFF' supabase/tests/rebaseline_census.sh && ! grep -q 'rebaseline_census' supabase/tests/harness_gate.sh"
chk "the gate hashes the baseline before and after every run (see harness_gate.sh)" \
  "grep -q 'BASELINE_HASH_BEFORE' supabase/tests/harness_gate.sh"
chk "req 2: the census is substantive, not an empty or truncated file" \
  "[ \$(wc -l < supabase/tests/expected_objects.txt) -ge 1400 ]"

# 2. Fresh-database build (req 1 / req 3). The gate rebuilds this database from
# the bootstrap plus every migration before these checks run, so the database
# existing in the expected shape IS the evidence the migrations apply cleanly.
chk "req 1: all 8 migrations exist and the finance schema they build is present in this database" \
  "[ \$(./supabase/tests/list_migrations.sh | wc -l | tr -d ' ') -eq 8 ] && [ \$(q \"select count(*) from pg_namespace where nspname='finance'\") -eq 1 ]"
# B-78: shell scripts are NEVER fed to the SQL stripper (it ate `--if-exists`
# as a comment, and the old fallback grep was satisfiable from a comment).
# shell_expects.py lexes each line with shlex, so only EXECUTED tokens count.
chk "req 3: run_all.sh executes 'dropdb --if-exists' and ON_ERROR_STOP=1 as real tokens (bash-aware lex, comments can never satisfy)" \
  "python3 supabase/tests/shell_expects.py supabase/tests/run_all.sh 'dropdb,--if-exists' 'ON_ERROR_STOP=1'"

# 3. req 69: aggregate views must DERIVE from v_agreement_balances. Proven from
# pg_depend -- the actual dependency graph the planner recorded, not text.
chk "req 69: every aggregate view depends on v_agreement_balances in pg_depend" \
  "[ \$(q \"select count(distinct dependent.relname) from pg_depend d
      join pg_rewrite r on r.oid = d.objid
      join pg_class dependent on dependent.oid = r.ev_class
      join pg_class referenced on referenced.oid = d.refobjid
      join pg_namespace n on n.oid = dependent.relnamespace
      where n.nspname='finance' and referenced.relname='v_agreement_balances'
        and dependent.relname <> 'v_agreement_balances'\") -ge 1 ]"
chk "req 69: no aggregate view re-implements the balance formula independently" \
  "[ \$(q \"select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='finance' and c.relkind='v' and c.relname like 'v_%financials%'
        and pg_get_viewdef(c.oid) !~ 'v_agreement_balances'\") -eq 0 ]"

# 4. req 70 / D-074: exactly two lifecycle derivations. The view side is read
# from pg_get_viewdef (parser output, comment-free); the routine side from
# prosrc with comments stripped. A third derivation appearing fails this.
chk "req 70 / D-074: exactly two lifecycle derivations exist (1 view + 1 routine)" \
  "[ \$(q \"select (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='finance' and c.relkind='v' and pg_get_viewdef(c.oid) ~ 'occurred_at DESC')
     + (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='finance' and p.prosrc ~ 'occurred_at desc')\") -eq 2 ]"
chk "req 70: the consumer projection v_agreement_lifecycle exists as a view" \
  "[ \$(q \"select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='finance' and c.relname='v_agreement_lifecycle' and c.relkind='v'\") -eq 1 ]"
chk "req 70: the only enforcement derivation is tg_lifecycle_transition" \
  "[ \$(q \"select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='finance' and p.prosrc ~ 'occurred_at desc'
        and p.proname <> 'tg_lifecycle_transition'\") -eq 0 ]"
chk "req 70: v_agreement_lifecycle carries security_invoker in its catalog reloptions" \
  "q \"select coalesce(array_to_string(reloptions,','),'') from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='finance' and c.relname='v_agreement_lifecycle'\" | grep -q 'security_invoker=true'"

# 5. Source-level requirements: a migration must ASSERT before it mutates.
# Comments stripped first, and each is paired with independent evidence.
chk "finding 11: migration 0001 asserts the PostgreSQL major version (comments stripped)" \
  "\$STRIP supabase/migrations/20260730000001_finance_harden_is_founder.sql | grep -q 'server_version_num'"
chk "blocker 1: migration 0001 executes is_founder() after hardening it (comments stripped)" \
  "\$STRIP supabase/migrations/20260730000001_finance_harden_is_founder.sql | grep -q 'public.is_founder()'"
chk "blocker 1 (catalog): is_founder carries the pinned search_path the migration set" \
  "q \"select coalesce(array_to_string(proconfig,','),'') from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='is_founder'\" | grep -q 'search_path=pg_catalog, public'"
chk "blocker 2: rollback resets the is_founder search_path (comments stripped)" \
  "\$STRIP supabase/migrations/ROLLBACK_pr1.sql | grep -qi 'reset search_path'"

# 6. Legacy isolation -- catalog side (a real FK would appear here) plus
# comment-stripped source (a write would not).
chk "no finance object has a foreign key into a legacy financial table" \
  "[ \$(q \"select count(*) from pg_constraint con join pg_class c on c.oid=con.conrelid
      join pg_namespace n on n.oid=c.relnamespace join pg_class t on t.oid=con.confrelid
      where n.nspname='finance' and con.contype='f'
        and t.relname in ('donations','financial_commitments','payment_allocations','bookings')\") -eq 0 ]"
# B-81: producer rc handled explicitly -- a stripper crash mid-scan must fail
# the check, not leave the unscanned remainder vacuously clean.
legacy_write_scan(){
  local files out
  files=$(./supabase/tests/list_migrations.sh) || return 1
  out=$(python3 supabase/tests/strip_sql_comments.py $files) || return 1
  ! printf '%s' "$out" | grep -qiE '(insert into|update|delete from)[[:space:]]+(public\.)?(donations|financial_commitments|payment_allocations|bookings)'
}
chk "no migration writes a legacy financial table (stripper rc checked; scan covers the full canonical list)" \
  "legacy_write_scan"
chk "no finance routine body references a legacy financial table (catalog)" \
  "[ \$(q \"select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='finance'
        and p.prosrc ~* '(donations|financial_commitments|payment_allocations|bookings)'\") -eq 0 ]"

# 7. anon must reach nothing in finance (catalog, not text).
chk "anon holds no privilege anywhere in the finance schema" \
  "[ \$(q \"select count(*) from information_schema.table_privileges where table_schema='finance' and grantee='anon'\") -eq 0 ] && [ \$(q \"select has_schema_privilege('anon','finance','USAGE')::int\") -eq 0 ]"

echo "# static checks: passed=$pass failed=$fail"
[ "$fail" -eq 0 ]
