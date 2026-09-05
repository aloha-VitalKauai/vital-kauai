-- Financials V2 — PR 10D (D-091): one founder notice per live Stripe payment.
--
-- The event worker tells the founders when live V2 money posts. The notice is
-- deduplicated by identity, not by check-then-insert: this partial unique index
-- on the existing public.notification_log makes a second insert for the same
-- (payment intent, livemode) fail with 23505, and the worker sends only when
-- its insert won. Duplicate Stripe deliveries and worker re-runs therefore
-- send nothing. The row carries no financial truth — every figure in the
-- notice is read from finance_api.agreement_balances at send time — so the
-- finance schema is untouched. Additive only; rows affected 0.

begin;

create unique index if not exists notification_log_founder_payment_posted_uq
  on public.notification_log ((payload->>'payment_intent_id'), (payload->>'livemode'))
  where notification_type = 'founder_payment_posted';

do $chk10d$
declare v_def text;
begin
  select pg_get_indexdef('public.notification_log_founder_payment_posted_uq'::regclass) into v_def;
  if v_def is null then
    raise exception 'notification_log_founder_payment_posted_uq missing';
  end if;
  if v_def not like 'CREATE UNIQUE INDEX%' then
    raise exception 'notification_log_founder_payment_posted_uq is not UNIQUE: %', v_def;
  end if;
  if v_def not like '%WHERE (notification_type = ''founder_payment_posted''::text)%' then
    raise exception 'notification_log_founder_payment_posted_uq predicate wrong: %', v_def;
  end if;
  if v_def not like '%payment_intent_id%' or v_def not like '%livemode%' then
    raise exception 'notification_log_founder_payment_posted_uq keys wrong: %', v_def;
  end if;
end
$chk10d$;

commit;
