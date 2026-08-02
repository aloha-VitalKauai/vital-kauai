# PR 1 requirement-to-test map (Checkpoint B)

Manually authored: each entry was written by reading the requirement in
`PR_PLAN.md` ("PR 1 acceptance tests") and selecting the assertions whose
executed behaviour proves it. Evidence IDs are the stable tags carried in TAP
output (`[A<file>-NNN]`), static-check tags (`[ST-NNN]`) and suite-level
evidence (`[SUITE:name]`, ledger: `supabase/tests/suite_evidence.txt`).
`supabase/tests/map_verify.sh` checks form (all 140 present, every cited ID
exists, no entry empty); it deliberately prints NO coverage number — none may
be claimed until every mapping has semantic review.

`GAP:` marks a requirement clause with no genuine executed evidence; each GAP
is either closed with new tests in the same commit series or stays visibly open.

### R1: migrations apply cleanly to a fresh database
[ST-005] proves all 8 manifest migrations exist and built the live schema; [SUITE:census] proves the built catalog matches the reviewed baseline byte-for-byte. The gate itself rebuilds from bootstrap + manifest every run, so a failing migration cannot produce a green run.

### R2: every finance object created by tracked migrations only
[ST-001] [ST-002] — the 1,485-line catalog fingerprint (relations, definitions, routine bodies, policies, grants) diffs exactly against the baseline generated from a migrations-only build; an object from any other source changes it.

### R3: a complete reset succeeds end to end
[ST-006] proves run_all.sh really executes `dropdb --if-exists` and `ON_ERROR_STOP=1` (bash-aware lex); the gate's own build performs the drop/create/apply cycle every run ([SUITE:inventory] green requires it).

### R4: 13 enums with exact values, 9 tables, 5 views
[A1-001] [A1-002] [A1-003] count them; [A7-068] [A7-001] [A7-002] pin exact value lists for agreement_lifecycle, payment_state, exception_kind. Remaining ten enums' exact values: [A1-030] [A1-021] (run_status five values incl. partial, exact labels — D-072) and the census ([SUITE:census]) pins every enum's full label set structurally.

### R5: ledger entries cannot be updated/deleted through normal roles
[A4-001] [A4-002] (denied() with the append-only guard, state digested); [A3-015] [A3-016] prove service_role holds no UPDATE/DELETE grant either.

### R6: ledger entries cannot be deleted through normal roles
[A4-002] is the direct DELETE denial; [A3-016] the grant-layer proof. (R5/R6 share the append-only mechanism; both directions individually probed.)

### R7: agreement amounts cannot be updated or deleted
[A2-010] [A2-011]; grant layer: [A3-017].

### R8: lifecycle events cannot be updated or deleted
[A2-012] [A2-013]; grant layer: [A3-018].

### R9: append-only holds even for an RLS-bypassing role — the trigger raises
[A4-001] [A4-002] [A2-010] [A2-011] [A2-012] [A2-013] all execute as the table-owning superuser role, which RLS (even FORCED) does not constrain — the raised P0001 append-only error therefore comes from the trigger, not policy. [SUITE:mutation_protocol] kills the dropped-trigger mutants (append_only on all three fact tables), proving the trigger is the load-bearing layer.

### R10: Member A cannot read Member B's rows
[A3-002] [A3-003] [A3-004] (agreements, cross-member); [A12-012] (unrelated member reads no ledger entries); [A3-005]–[A3-008] (founder-only tables return nothing to members). Balance rows: [A12-013].

### R11: a member cannot insert any financial fact
[A7-059] (direct probe); [A3-035] [A3-009] (agreement, ledger); [A3-013] (no INSERT grant at all).

### R12: authorized founder actions succeed through the approved functions
[A7-064] positive founder path; [A2-050] (create_agreement succeeds); [A7-030] (resolve_exception succeeds and applies); [A7-063] the non-founder negative.

### R13: views respect RLS
[A7-060] — the view returns no row a direct table query would deny, executed per-role; structurally, [ST-012] (security_invoker on the lifecycle view) and [A5-016] (f_balances is SECURITY INVOKER).

### R14: anon and PUBLIC have no access to any finance object
[A7-004] (no schema USAGE), [A7-070] [A1-035] (no table privilege), [A12-030] [A12-014] [A12-015]; functions: [A5-013] [A5-014] (no finance function PUBLIC-executable, by execution and by ACL) and [ST-020] (anon holds nothing, information_schema-wide).

### R15: current_member_id resolves via members.profile_id; NULL profile_id yields no row
[A3-001] [A12-024] prove profile_id resolution (not id=auth.uid()). NULL-profile clause: [A3-040] — a member whose profile_id is NULL is not resolved; current_member_id() returns NULL for a JWT with no profile-linked member. (Gap found during mapping; closed in this commit.)

### R16: SECURITY DEFINER functions pin search_path; no PUBLIC EXECUTE
[A1-033] (no DEFINER function lacks a pinned path), [A7-069], [A12-021] (exact value on current_member_id), [A7-026] (exact value on resolve_exception); PUBLIC: [A5-013] [A5-014].

### R17: (member_id, journey_id, purpose) unique with NULLS NOT DISTINCT
[A2-002] — duplicate raises; the member-level (NULL journey) duplicate case is the NULLS NOT DISTINCT proof: [A2-071] (duplicate member-level NULL-journey agreement raises 23505 on the same index). Index definition pinned structurally by [SUITE:census] (indexdef hashes).

### R18: agreement creation carries its initial event; lifecycle never NULL
[A2-003] (initial draft event exists in-transaction via create_agreement); [A2-051] [A9-006] (an agreement without one cannot COMMIT — deferred trigger); view-side: [A9-012] reads current lifecycle deterministically, so it is never NULL for an existing agreement.

### R19: only one initial event per agreement
[A4-047] (second initial event rejected, 23505 on the partial unique index).

### R20: invalid transitions rejected; terminal states have no exit
[A4-016] (draft→fulfilled rejected), [A2-004] (active→draft rejected), [A2-005] (stale from_status rejected), [A2-009] (canceled terminal); permitted directions still work: [A2-006] [A2-007] [A2-008].
