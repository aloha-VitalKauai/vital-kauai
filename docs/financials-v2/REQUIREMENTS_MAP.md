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
[A4-017] (no balance column changes on cancel); **payment_state unchanged after cancel** [A16-009]; derivation structural [ST-007].

### R23: contribution resolves by effective_at DESC, seq DESC including ties
Tie broken by seq: [A2-014]. **effective_at DESC dominates seq**: an earlier effective_at recorded with the highest seq still loses [A2-072] (an ASC flip would fail this where the tie test survives it).

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

### R31: L11 — livemode must match the originating event; NULL origin accepted; external/imported ⇒ livemode=true
Disagreement rejected: [A7-018]. Agreement accepted: [A7-019]. NULL origin accepted: [A4-062]. **External/imported ⇒ livemode=true is now ENFORCED** by `ledger_l11_offline_livemode` (R31 defect fix): external livemode=false rejected [A4-096], imported (legacy_donation_id) livemode=false rejected [A4-097], genuine stripe test-mode still allowed [A4-098]. Kill-path: sabotage case 41.

### R32: L12 — external/reversal require reason + exactly one attribution
No attribution: [A2-016]. Both attributions: [A2-019]. Blank reason on a LEDGER external entry: [A2-073] (ledger_l12_attribution, distinct from the agreement_amounts probe). stripe_payment accepted with provider_object_id NULL: [A2-074]. Either form satisfies: human [A2-058]; system alone [A4-045].

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
Expired [A4-068], consumed [A4-070], non-active generally [A4-069]. **Creating**: the claim path (`WHERE status='active'`) matches zero rows once a link is creating [A16-006] — the real one-shot control; the guard is defence-in-depth. Revoked: [A9-004] (terminal, cannot reactivate). Mechanism kill-path: sabotage case 30.

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
Mid-range: [A4-083] [A4-093]. Overpaid: [A7-009]. Not-applicable → remaining_cents NULL [A7-020] [A2-030] and **payable_remaining_cents NULL** [A16-010].

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
[A7-073] (multiple distinct, deterministic) [A7-024] (never NULL); each reachable §8 state produced: unpaid [A2-028], **partial [A16-008]**, **paid [A16-007]**, overpaid [A7-009], refunded [A4-084], not_applicable [A2-029].

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
Conflict: [A2-068]. **Upsert raises occurrence_count** [A16-012] [A15-057] and **leaves first_detected_at unchanged** [A16-011]; the real ON CONFLICT executes [A15-056].

### R80: resolved does not block recurrence; resolved row preserved
[A2-070] [A7-039] [A7-040].

### R81: same dedup_key, different livemode → independent rows
[A4-053] [A13-034].

### R82: last_detected_at >= first_detected_at enforced
[A4-052].

### R83: finished_at consistency in both directions, every status
running+finished_at: [A2-034]. Non-running without finished_at, per status: completed [A13-011], partial [A13-012], failed [A13-013], abandoned [A13-014].

### R84: window_exhausted biconditional — all 10 combinations
Valid five: [A13-001] [A13-002] [A13-003] [A13-004] [A13-005]. Rejected five: [A13-006] [A13-007] [A13-008] [A13-009] [A13-010] (all pinned to run_completed_iff_exhausted). Older spot checks retained: [A2-061] [A2-031] [A2-032] [A2-033].

### R85: resume lineage
Resumable predecessors: partial [A13-015], failed [A13-016], abandoned [A13-017]. Rejected: running [A13-018], completed [A13-019] — ENFORCED BY THE B-85 FIX in tg_run_insert_guard (lineage was previously unvalidated; sabotage case 32 is the kill-path). Self-reference: [A7-046]. Second successor: [A13-020] (reconciliation_runs_resume_uq).

### R86: dry/writing authorization column constraints
[A4-022] [A4-023]; approved_by/approved_at pairing pinned by [SUITE:census] (run_approval_pair, run_approval_note_pair) and behaviourally by [A2-036].

### R87: quarantine column pairings
[A7-043] [A7-044]; release/quarantine pair CHECKs pinned by [SUITE:census] (exc_quarantine_pair, exc_release_pair, exc_release_requires_quarantine).

### R88: approval and release are founder-only
[A3-023] (service_role cannot write approved_at), [A3-030] [A3-031] (no EXECUTE on either function), [A2-035] (founder approves), [A4-032] (founder releases).

### R89: exactly eight partial unique indexes, as indexes
[A7-071] [A7-005]; exact predicates pinned by [SUITE:census] (indexdef hashes).

### R90: is_founder() hardened
[A1-034] [A1-023] [A1-024] [A1-025]; [ST-015].

### R91: column grants prove both directions
[A7-079]; permitted: [A3-026] [A3-027]; denied: [A4-089] [A3-023].

### R92: the quarantine cycle is executable with monotonic timestamps
Full double cycle executed on one row: quarantine [A15-015], release [A15-017], streak reset [A15-018], released_at > quarantined_at [A15-019], re-quarantine [A15-020], quarantined_at > released_at [A15-021], second release [A15-022]. Two-session ordering: [SUITE:concurrency_r101].

### R93: release_quarantine and quarantine_object contracts
Non-founder release: [A13-028]. Not-quarantined release: [A13-027]. One-statement set+reset: [A4-032] [A4-033]. quarantine_object exec by service_role not founder: [A3-032] [A3-033]. No reason parameter: [A13-026]. No direct column UPDATE on the quarantine columns: no grant exists ([SUITE:census] grant lines enumerate every column privilege; the four quarantine columns appear in none), and the R115 widened-grant pattern [A15-041] proves trigger-layer defence for the run analogue.

### R94: dry-run write constraints
exceptions_created direction [A4-051]; **exceptions_reopened direction** [A16-013] (run_dry_writes_nothing); writing-run report exclusion pinned by [SUITE:census].

### R95: report completeness both directions
All-absent [A4-024]; **each of the four report columns individually required** [A16-015] [A16-016] [A16-017] [A16-018] and report_completed_at without them [A16-014]; approval without report: [A7-047] [A2-064].

### R96: authorization source constraints — full ineligible matrix + accepted case
DIRECT, at the writing-run insert, each pinned to tg_run_authorization's own message: running [A13-037], partial [A13-038] (also [A7-065]), failed [A13-039], abandoned [A13-040], unapproved [A13-041], error-bearing [A13-042] (checked before approval, so an approved-yet-error-bearing source is unreachable by construction), nonexistent [A13-043], not-a-dry-run [A13-046]. Livemode mismatch [A7-066]; version mismatch [A7-080]; horizon [A13-045]. Accepted case through the function-approved source: [A13-044] (also [A7-052]). No-completed-report is unreachable at this boundary — approval itself requires the report ([A2-064] [A7-047]); the trigger's branch is defence in depth. A mutated predecessor cannot self-legitimise: [A13-047].

### R97: implementation version binds
[A7-080].

### R98: approval preconditions — every ineligible status + error
running [A13-021], partial [A13-022], failed [A13-023], abandoned [A13-024], error-bearing [A13-025]; no-report [A2-064] [A7-047].

### R99: processing-failure shape — every direction
NULL object [A13-029], absent type [A13-030], out-of-set type [A13-031], absent class [A13-032], out-of-set class [A13-033]; well-formed accepted [A2-044]; cross-livemode coexistence [A13-034]; malformed-detail rejection [A2-069].

### R100: at-most-once index scope (§10, created per D-076)
The §10 partial unique index exists with exactly its four terminal types: [A7-081] (exact indexdef) [A7-077] (stripe_events carries PK + this index). Behavioural: a second terminal event for one object+livemode is rejected [A7-082], the other livemode coexists [A7-083]. Repeatable types (payment_failed) are excluded and retained [A7-055] [A7-056], creating no ledger entries [A13-036]. The ledger L8 index [A13-035] is the separate ledger-side at-most-once. Kill-path: sabotage case 42.


### R101: quarantine ordering under concurrency
[SUITE:concurrency_r101] — two sessions, the second beginning before the first's opposing transition commits; pid-pinned blocking, one winner, and release_seq/timestamps observed after both commit. Monotonicity single-session: [A15-019] [A15-021].

### R102: dedup_key cannot be supplied
[A2-067] [A7-078] [A15-011] (428C9 at INSERT); stored value canonical: [A2-043] [A15-007].

### R103: approval attribution cannot be spoofed
[A2-036] (approved_by = auth.uid(), not a parameter); the function signature has no actor/timestamp parameters ([SUITE:census] routinedef); [A7-053] (a forged born-approved run is rejected).

### R104: approval preconditions inside the function
Status matrix [A13-021]–[A13-024]; error-bearing [A13-025]; no-report [A2-064] [A7-047]; not-exhausted/unfinished are unreachable as completed rows ([SUITE:census] run_completed_iff_exhausted + run_finished_at_consistent make such a source row uninsertable — [A13-006] [A13-011] prove those rejections).

### R105: approved evidence is frozen
Per-field matrix under R115: [A15-025]–[A15-040]; earlier spot checks [A2-065] [A2-039] [A2-040] [A7-050] [A7-051].

### R106: no direct approval write
[A3-023] (service_role); [A15-040] (owner-direct via freeze); grant absence for authenticated: [SUITE:census].

### R107: implementation_version required, never defaulted
[A2-062]; no default in the catalog: [SUITE:census] (column definition).

### R108: generated dedup_key compiles and is canonical for every kind
Catalog-enumerated one-row-per-label [A15-001], all keys non-NULL [A15-002], spec count pinned [A15-003], one WHEN per label [A15-004], ELSE NULL fail-closed [A15-005], identical identity → same key [A15-007], different identity → different key [A15-008], livemode in the unique identity [A15-009] [A15-010]. **UPDATE override rejected by the server** [A16-002] (428C9).

### R109: untouched and partial quarantine states insert cleanly; equal timestamps rejected
Untouched/partial: [A4-025] [A4-026]. **Equal non-null quarantine/release timestamps rejected** by exc_monotonic_backstop [A16-003]. Correctly ordered release/re-quarantine: [A15-019] [A15-021].

### R110: quarantine_object preconditions
Streak 0 [A15-012], first failure [A15-013], SECOND failure [A15-014], threshold engages at 3 [A15-015], already-active [A15-016] [A4-031], dismissed row [A15-023], **resolved row [A16-019]**, wrong kind [A4-027]. The streak counts distinct runs by job contract (PR 3); the PR 1 surface is the counter + threshold + service_role-only increment ([A3-026]).

### R111: derived quarantine reason
[A4-030]; quarantine_object takes no reason parameter [A13-026].

### R112: release then re-quarantine requires three fresh failures
[A4-033] [A15-018] (reset), [A4-034] (raises until three), [A15-020] (succeeds at three).

### R113: approval permitted exactly once
[A7-048] [A7-049] [A2-035] [A2-037]; direct-write path blocked [A3-023] [A15-040].

### R114: approval_note required and frozen
[A2-038] (blank raises); **stored equals supplied** [A16-004]; frozen [A15-040].

### R115: post-approval mutation rejected per field, incl. service_role; non-frozen field mutable
Trigger freezes exactly 18 fields, list-compared [A15-024]. Individually: [A15-025]–[A15-040]. service_role with a deliberately widened grant still dies in the trigger [A15-041]. Non-frozen heartbeat_at stays mutable [A15-042].

### R116: dedup_key structurally non-null, all kinds
[A15-006] (attnotnull) [A7-057] [A7-058]; per-kind non-NULL [A15-002] with the catalog-derived set [A15-001].

### R117: resolution column pairings
[A7-042] (open + resolved_at rejected); resolved/dismissed missing attribution rejected by exc_open_iff_unresolved + exc_note_iff_closed ([SUITE:census]); born-open default proven by every plain insert ([A4-025]).

### R118: resolve_exception attribution cannot be spoofed
[A2-047] [A2-048] (resolved_by = auth.uid()); no actor/timestamp parameters ([A13-026]-style signature pinned by [SUITE:census] routinedef); direct writes: R121 family.

### R119: resolve_exception preconditions
Blank note [A2-046]; open target [A2-045]; repeat on resolved [A2-049]; repeat on DISMISSED [A15-043].

### R120: resolution wins over quarantine
Quarantined row resolves [A15-044]; quarantine history preserved, release distinct [A15-045]; open slot freed for recurrence [A15-046] [A2-070].

### R121: no direct resolution write for any application role
Posture: [A7-074] [A7-025] [A7-026] [A7-028] (SECURITY INVOKER, exact regprocedure owner). Denials: founder-as-authenticated [A7-032], service_role [A7-033], widened grant still dies by identity [A7-034], former GUC inert [A7-036], anon holds nothing [ST-020] [A12-015]. Function paths: [A7-029] [A7-030] [A7-031]. Owner boundary exact: [A7-075]. State preserved: [A7-076] [A7-037]. No competing overload possible: [A15-060]. Terminality: [A2-049] [A15-043]. Kill-paths: sabotage cases 22, 22b, 22c, 25.

### R122: release_note separate from resolution_note
[A4-035] [A4-036]; distinguishability after resolution-over-quarantine: [A15-045].

### R123: ordinary exception creation as service_role lands open
[A2-066] [A3-025]; default proven by [A4-025].

### R124: all nine protected columns rejected individually at INSERT, trigger load-bearing
With the grant deliberately widened: resolution_status [A15-047], resolved_at [A15-048], resolved_by [A15-049], resolution_note [A15-050], quarantined_at [A15-051], quarantine_reason [A15-052], released_at [A15-053], released_by [A15-054], release_note [A15-055]; ACL restored [A15-058]. Grant-layer denials: [A3-037] [A3-019] [A3-020]. Owner-path born-terminal: [A2-041] [A2-042].

### R124b: the trigger predicate is satisfiable
[A7-045] (explicit open insert accepted).

### R125: the deduplicating upsert still executes
[A15-056] (real ON CONFLICT on (dedup_key, livemode) where open, as service_role, touching the streak) [A15-057] (updated in place); column grants [A3-026].

### R126: functions still succeed after the INSERT restrictions
[A7-038] (resolution), [A15-015] [A15-017] (quarantine and release in the same suite that exercises the restrictions).

### R127: open ⇄ note biconditional
[A7-041] (open + note rejected); closed-without-note rejected by exc_note_iff_closed, exercised as the wrong-reason finding of the original req-121 probe and pinned by [SUITE:census]; both function paths write consistent pairs [A7-030].

### R128: a normal unapproved run inserts as service_role
**Executed as service_role using only granted columns** [A16-005] (status/window_exhausted default; using ungranted columns is the 42501 of [A15-059]); grant [A3-028].

### R129: service_role cannot insert any approval field
approved_by grant-layer [A3-021] and **individually at INSERT [A16-020]**, approval_note [A3-022], approved_at with the grant widened dies in the trigger [A15-059]; owner-path [A2-063] [A7-053].

### R130: a fabricated approved run cannot authorize
[A7-053] (cannot exist); citing a nonexistent run [A13-043]; citing an unapproved one [A13-041].

### R131: founder approval still succeeds; freeze holds afterwards
[A7-048] [A2-035]; the full per-field freeze matrix [A15-025]–[A15-042].

### R132: authorized_by_run_id insertable for a genuine writing run
[A7-052] [A13-044].

### R133: agreement creation requires its initial event
Commit-boundary failure without the event: [A2-051] [A9-006], direct-import parent-only [A15-063]. Parent-then-child in one transaction succeeds: [A15-062] (direct SQL, the PR 2 import path) and [A2-050] (create_agreement). Duplicate initial event: [A4-047].

### R133b: child-first insertion rejected; the FK is non-deferrable
Behavioural rejection [A2-052] (a P0001 from the transition trigger reading the absent parent). **The FK is non-deferrable** [A16-001] (catalog) — the requirement's actual mechanism, so the deferred completeness trigger is not a licence to reorder.
