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

### R21: two concurrent transitions from the same status cannot both commit
[SUITE:concurrency_r21] — two real sessions, FIFO-driven; the second blocks on the row lock (pid-pinned wait) and exactly one transition commits.

### R22: lifecycle state has no effect on balances or payment_state
[A4-017] — cancelling an agreement changes no balance column; the balance view derives only from ledger facts ([ST-007] structural).

### R23: contribution resolves by effective_at DESC, seq DESC including ties
[A2-014] — the last-recorded amendment wins on an effective_at tie (seq is the tiebreak).

### R24: same-transaction amendments resolve to the later seq
[A7-006] — two amendments in one transaction; the later seq wins, not a random uuid.

### R25: no amendment yields Contribution 0
[A4-013].

### R26: future-dated amendments rejected on insert; view excludes any that reach the table
Clause 1: [A2-054] (insert rejected, no tolerance). Clause 2: [A7-072] — catalog-level proof no future-dated amendment exists for the view to exclude; the view-side exclusion predicate is pinned by [SUITE:census] (viewdef hash).

### R27: blank reason rejected; negative amount_cents rejected
[A4-015] [A4-014]; function-path blank reason: [A2-001].

### R28: L1 — stripe_payment rejection matrix
No intent id: [A2-055]. source <> 'stripe': [A4-055]. Non-positive: [A4-056]. With a parent: [A4-057].

### R29: L2 — external_payment rejection matrix + system-only acceptance
No method: [A2-015]. No attribution: [A2-016]. source <> 'external': [A4-058]. Non-positive: [A4-059]. With a parent: [A4-060]. Accepted with recorded_by_system alone: [A4-045].

### R30: L3 — refund rejection matrix
No parent: [A4-039]. Positive amount: [A4-006]. Stripe refund with NULL provider_object_id: [A4-007]. External refund without method: [A4-061].

### R30b: L3b — stripe refund must target a stripe_payment
[A7-017].

### R31: L11 — livemode must match the originating event; NULL origin accepted
Disagreement rejected: [A7-018]. Agreement accepted: [A7-019]. NULL origin accepted: [A4-062]. External/import entries livemode=true with NULL origin: [A4-046] (import lives_ok) and the L11 trigger only fires on a non-null origin ([A7-018] body).

### R32: L12 — external/reversal require reason + exactly one attribution
No attribution: [A2-016]. Both attributions: [A2-019]. Blank reason: [A4-015]. Either form satisfies: human [A2-015]-adjacent external fixtures throughout; system alone [A4-045].

### R32b: recorded_by_system needs no auth.users row
[A4-045] — legacy_import inserted with zero-dependency system attribution.

### R32c: L13 — stripe entry carrying external_method rejected
[A2-017].

### R32d: L13 — external entry carrying provider ids rejected
[A2-018] (payment-intent id); the provider_object_id direction shares the same CHECK, pinned by [SUITE:census] (constraint definition).

### R32e: legacy_donation_id accepted on both stripe and external entries
[A4-046] (external), [A4-074] (stripe).

### R33: session uniques + amount > 0
stripe_session_id unique: [A4-063]. idempotency_key unique: [A4-064]. amount_cents > 0: [A4-018].

### R34: non-creating status requires stripe_session_id
[A4-048].

### R35: at most one live session per agreement per mode; modes coexist
Second same-mode rejected: [A4-065]. Test+live coexist: [A4-066]. Concurrent double-create: [SUITE:concurrency_r35].

### R36: expiring/completing frees the slot
Completing: [A4-067]. Expiring: [A4-075].

### R37: link claim is atomic — one winner, loser creates nothing
[SUITE:concurrency_r37] — two sessions race one link; exactly one wins.

### R38: claim rejected when creating/consumed/revoked/expired
Expired: [A4-068]. Already-claimed (creating): [A4-069]. Consumed: [A4-070]. Revoked: [A9-004] (a revoked link cannot be reactivated; terminal trigger) — the claim path from revoked is additionally blocked by the same guard ([A4-069] ident covers any non-active status). Mechanism kill-path: sabotage case 30 ([SUITE:sabotage_protocol]).

### R39: non-open exception row lacking resolution attribution rejected
[A4-071] — rejected at INSERT by the born-open guard, which sits above the exc_open_iff_unresolved CHECK; the CHECK itself is pinned by [SUITE:census].

### R40: service_role can SELECT and INSERT where the jobs require
Ledger: [A3-024] [A3-038]. Exceptions: [A3-025] (INSERT kind) [A3-026] (occurrence_count update). Runs: [A3-028]. Events cursor: [A3-027]. stripe_events INSERT+SELECT: [A4-072] [A4-073].

### R41: append-only trigger raises for service_role despite elevation
Grant layer: [A3-015] [A3-016]. Trigger layer with the grant deliberately widened (simulated ACL drift): [A4-076] [A4-077] — the P0001 comes from the append-only trigger, not privilege. [SUITE:mutation_protocol] kills the dropped-trigger mutants.

### R42: anon/PUBLIC nothing, including after ALTER DEFAULT PRIVILEGES
[ST-020] [A7-004] [A7-070] [A1-035]; function ACLs post-ADP: [A5-013] [A5-014] executed against the built database where the migration's ADP statements ran (the ADP-is-a-no-op-for-REVOKE finding is why explicit REVOKEs exist; census pins the resulting ACLs).

### R43: a payment increases net Received exactly once
[A4-038].

### R44: L8 — duplicate (provider_object_id, livemode) rejected
[A2-020] [A4-003]; index pinned structurally by [SUITE:census] (ledger_entries_provider_object_uq).

### R45: L8b — duplicate payment intent rejected
[A2-021].

### R46: a refund reduces net Received
[A2-023].

### R47: partial refund works, correct balance
[A2-022] [A4-040].

### R48: two partial refunds accumulate
[A4-040] [A4-008] [A4-009].

### R49: refund exceeding settled amount rejected
[A4-010] (L7).

### R50: cumulative refunds exceeding settled rejected, incl. concurrent
Sequential: [A4-010] [A4-009]. Concurrent insertion: [SUITE:concurrency_r50].

### R51: a refund may not target a refund or a reversal
Refund target: [A4-041]. Reversal target: [A4-078].

### R52: a reversal requires a valid parent and exactly negates it
Parent required: [A4-079] — the new ledger_l4_reversal CHECK (mechanism added in this batch: a parentless reversal was previously ACCEPTED because the negation trigger keys off the parent; sabotage case 31 is its kill-path). Exact negation: [A4-042].

### R53: reversal rejected while parent has an unreversed child
[A2-057] [A7-016] (L6, the double-subtraction case).

### R54: the full unwind executes and nets to 0
[A2-058] [A2-024] [A2-025] [A7-014].

### R55: an entry cannot be reversed twice
[A2-060] [A7-015].

### R56: reversing a refund restores the parent's refund headroom
[A4-043] [A4-011].

### R57: no self-parent; parent and child share an agreement
Self-parent: [A4-081] (L5 CHECK present for the INSERT path) + [A4-080] (no UPDATE path can even attempt it — append-only). Cross-agreement: [A4-004].

### R58: a ledger entry cannot exist without an agreement
[A4-082] (FK, 23503).

### R59: (legacy_donation_id, entry_type) unique — re-run import cannot duplicate
[A4-044] [A4-012]; the payment+refund pair from one legacy row is permitted by the entry_type dimension ([SUITE:census] pins ledger_entries_legacy_donation_uq).

### R60: no entries → all aggregates 0 and unpaid, never NULL/partial
[A2-027] [A2-028] [A7-010].

### R61: remaining/payable across the state range; NULL when contribution does not apply
Mid-range: [A4-083] [A4-093]. Overpaid: [A7-009]. Not-applicable → NULL: [A7-020] [A2-030].

### R62: overpayment — negative remaining, zero payable
[A7-007] [A7-008].

### R63: refunded-to-zero is refunded, not unpaid
[A4-084] (fresh agreement, full refund → 'refunded').

### R64: payment reversed in error returns unpaid, not refunded
[A4-094] (payment + reversal only, distinct fixture from R63's refund path).

### R65: reversed refund does not count toward refunded_cents; unwound is unpaid
[A7-011] [A7-012] [A7-013] [A2-059] [A2-026].

### R66: gift is not_applicable/NULL yet counts toward member and journey Received
[A2-029] [A2-030] [A7-020] [A7-021] (member); [A4-085] (journey).

### R67: payment_state deterministic, one value per reachable state
[A7-073] [A7-024]; individual states across the suite: unpaid ([A2-028]), partial/paid fixtures throughout, overpaid ([A7-009]), refunded ([A4-084]), not_applicable ([A2-029]).

### R68: livemode=false excluded from canonical, present in founder test view
[A7-022] [A7-023]; member-level leak-proofs: [A12-007] [A12-008].

### R69: aggregate views derive from v_agreement_balances (reviewer check)
[ST-007] (pg_depend) [ST-008] (no independent formula).

### R70: v_agreement_lifecycle is the single consumer projection
[ST-009] [ST-010] [ST-011] [ST-012]; behavioural: [A9-012] [A9-013] (enforcement agrees with the view, D-074).

### R71: create_agreement — non-founder raises, blank reason raises, atomic creation
Non-founder: [A7-063]. Blank reason: [A2-001]. Creates agreement + initial draft event in one transaction: [A2-050] [A2-003].

### R72: the full §6 transition graph, both terminal states
Permitted: [A2-053] (draft→active), [A2-006] (active→fulfilled), [A2-007] (fulfilled→active), [A2-008] (active→canceled), [A4-095] (fresh draft→active), [A4-086] (active→waived). Rejected: [A2-004] (active→draft), [A4-016] (draft→fulfilled), [A2-005] (stale from_status). Terminals: [A2-009] (canceled), [A4-087] (waived).

### R73: payment_links status CHECKs
creating without claimed_at: [A4-049]. consumed without session: [A4-019]. revoked shape: [A4-088] (born-revoked rejected by the insert guard; the link_revoked_complete CHECK is pinned by [SUITE:census]).

### R74: members have no SELECT on the four founder tables
[A3-005] [A3-006] [A3-007] [A3-008] [A7-061] [A7-062]; RLS-not-grant nuance: [A11-009] [A11-012].

### R75: service_role UPDATE is column-scoped
Permitted columns: [A3-026] [A3-027]. Outside the list: [A4-089] (42501).

### R76: USD constraints
Ledger: [A4-090]. Agreement: [A4-091] (at INSERT; UPDATE cannot reach the CHECK because agreements are append-only).

### R77: run window ordering; running excludes finished_at
[A4-050]; [A4-092].

### R78: single flight per livemode; modes coexist
[A4-020] [A4-021]; concurrent: [SUITE:census] pins reconciliation_runs_single_flight_uq.

### R79: exception dedup — open conflict; upsert raises occurrence_count
Conflict: [A2-068]. Upsert-side counters are service_role-updatable: [A3-026]; last_detected_at advance is PR 3 job behaviour — the PR 1 surface is the unique index + column grants, both present.

### R80: resolved does not block recurrence; resolved row preserved
[A2-070] [A7-039] [A7-040].
