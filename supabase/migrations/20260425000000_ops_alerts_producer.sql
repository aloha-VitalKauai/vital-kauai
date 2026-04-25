-- ─────────────────────────────────────────────────────────────
-- ops_alerts producer: rule-based alert generator
-- ─────────────────────────────────────────────────────────────
-- The Alerts tab on /dashboard/ops reads from public.ops_alerts.
-- Until now nothing wrote to it. This migration adds:
--
--   1. Unique index on (alert_type, source_id) for idempotent upserts
--   2. _refresh_ops_alerts_internal() — pure SQL, no auth check
--   3. refresh_ops_alerts() — founder-callable wrapper
--   4. pg_cron job to run every 15 minutes
--
-- Rules implemented (one row per condition, deduped by source_id):
--   deposit_unpaid             critical
--   medical_not_cleared        high     (ceremony ≤ 14d out)
--   cardiac_not_cleared        high     (ceremony ≤ 14d out)
--   medicine_form_missing      high     (ceremony ≤ 7d out)
--   intake_incomplete          warning  (any scheduled journey)
--   agreement_unsigned         warning  (member > 7d old)
--   medical_disclaimer_unsigned warning (member > 7d old)
--   setup_incomplete           warning  (invited > 5d, onboarding not done)
--   payment_received           info     (donation completed in last 7d)
--   payment_failed             high     (failed donation in last 14d)
--   webhook_orphan             warning  (failed webhook or unmatched calendly)
--   integration_call_gap       warning  (ceremony done > 14d, 0 calls)
--   adverse_event_unresolved   critical/high (open AE)
--   post_ceremony_stalled      info     (no progress update in 14d)
--
-- Acknowledgement is preserved across refreshes (never reset by sync).
-- Alerts are deactivated when the underlying condition no longer holds.

BEGIN;

-- ── Idempotency index ────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS ops_alerts_alert_type_source_id_key
  ON public.ops_alerts (alert_type, source_id);

-- ── Internal refresh (no auth check; safe for cron) ─────────
CREATE OR REPLACE FUNCTION public._refresh_ops_alerts_internal()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  managed_types text[] := ARRAY[
    'deposit_unpaid','medical_not_cleared','cardiac_not_cleared',
    'medicine_form_missing','intake_incomplete','agreement_unsigned',
    'medical_disclaimer_unsigned','setup_incomplete','payment_received',
    'payment_failed','webhook_orphan','integration_call_gap',
    'adverse_event_unresolved','post_ceremony_stalled'
  ];
  v_active bigint;
BEGIN
  -- 1) Reset: managed alerts go inactive; upserts below reactivate currently-firing
  UPDATE public.ops_alerts
  SET is_active = false, updated_at = now()
  WHERE alert_type = ANY(managed_types) AND is_active = true;

  -- ── Rule: deposit_unpaid (critical) ───────────────────────
  INSERT INTO public.ops_alerts
    (member_id, alert_type, severity, title, message, source_table, source_id, is_active)
  SELECT m.id, 'deposit_unpaid', 'critical',
         'Deposit not paid',
         'Member has a scheduled journey but the deposit is not yet paid.',
         'member_profiles', m.id, true
  FROM public.members m
  JOIN public.journeys j ON j.member_id = m.id
    AND j.status = 'scheduled' AND j.start_at IS NOT NULL
  LEFT JOIN public.member_profiles mp ON mp.id = m.id
  WHERE COALESCE(mp.deposit_paid, false) = false
  ON CONFLICT (alert_type, source_id) DO UPDATE
    SET is_active = true, severity = EXCLUDED.severity,
        title = EXCLUDED.title, message = EXCLUDED.message,
        source_table = EXCLUDED.source_table, member_id = EXCLUDED.member_id,
        updated_at = now();

  -- ── Rule: medical_not_cleared (high) ──────────────────────
  INSERT INTO public.ops_alerts
    (member_id, alert_type, severity, title, message, source_table, source_id, is_active)
  SELECT m.id, 'medical_not_cleared', 'high',
         'Medical clearance pending',
         format('Ceremony on %s; medical_cleared is still false.',
                to_char(j.start_at AT TIME ZONE 'Pacific/Honolulu', 'Mon DD')),
         'members', m.id, true
  FROM public.members m
  JOIN public.journeys j ON j.member_id = m.id
    AND j.status = 'scheduled' AND j.start_at IS NOT NULL
    AND j.start_at <= now() + interval '14 days'
    AND j.start_at > now()
  WHERE COALESCE(m.medical_cleared, false) = false
  ON CONFLICT (alert_type, source_id) DO UPDATE
    SET is_active = true, severity = EXCLUDED.severity,
        title = EXCLUDED.title, message = EXCLUDED.message,
        source_table = EXCLUDED.source_table, member_id = EXCLUDED.member_id,
        updated_at = now();

  -- ── Rule: cardiac_not_cleared (high) ──────────────────────
  INSERT INTO public.ops_alerts
    (member_id, alert_type, severity, title, message, source_table, source_id, is_active)
  SELECT m.id, 'cardiac_not_cleared', 'high',
         'Cardiac clearance pending',
         format('Ceremony on %s; cardiac_cleared is still false.',
                to_char(j.start_at AT TIME ZONE 'Pacific/Honolulu', 'Mon DD')),
         'members', m.id, true
  FROM public.members m
  JOIN public.journeys j ON j.member_id = m.id
    AND j.status = 'scheduled' AND j.start_at IS NOT NULL
    AND j.start_at <= now() + interval '14 days'
    AND j.start_at > now()
  WHERE COALESCE(m.cardiac_cleared, false) = false
  ON CONFLICT (alert_type, source_id) DO UPDATE
    SET is_active = true, severity = EXCLUDED.severity,
        title = EXCLUDED.title, message = EXCLUDED.message,
        source_table = EXCLUDED.source_table, member_id = EXCLUDED.member_id,
        updated_at = now();

  -- ── Rule: medicine_form_missing (high) ────────────────────
  INSERT INTO public.ops_alerts
    (member_id, alert_type, severity, title, message, source_table, source_id, is_active)
  SELECT cr.member_id, 'medicine_form_missing', 'high',
         'Medicine form not chosen',
         format('Ceremony on %s has no medicine_form selected.',
                to_char(j.start_at AT TIME ZONE 'Pacific/Honolulu', 'Mon DD')),
         'ceremony_records', cr.id, true
  FROM public.ceremony_records cr
  JOIN public.journeys j ON j.id = cr.journey_id
  WHERE cr.status = 'Scheduled'
    AND cr.medicine_form IS NULL
    AND j.start_at IS NOT NULL
    AND j.start_at <= now() + interval '7 days'
    AND j.start_at > now()
  ON CONFLICT (alert_type, source_id) DO UPDATE
    SET is_active = true, severity = EXCLUDED.severity,
        title = EXCLUDED.title, message = EXCLUDED.message,
        source_table = EXCLUDED.source_table, member_id = EXCLUDED.member_id,
        updated_at = now();

  -- ── Rule: intake_incomplete (warning) ─────────────────────
  INSERT INTO public.ops_alerts
    (member_id, alert_type, severity, title, message, source_table, source_id, is_active)
  SELECT m.id, 'intake_incomplete', 'warning',
         'Intake form not submitted',
         'Member has a scheduled journey but the intake form is not complete.',
         'member_profiles', m.id, true
  FROM public.members m
  JOIN public.journeys j ON j.member_id = m.id
    AND j.status = 'scheduled' AND j.start_at IS NOT NULL
  LEFT JOIN public.member_profiles mp ON mp.id = m.id
  WHERE COALESCE(mp.intake_form_completed, false) = false
  ON CONFLICT (alert_type, source_id) DO UPDATE
    SET is_active = true, severity = EXCLUDED.severity,
        title = EXCLUDED.title, message = EXCLUDED.message,
        source_table = EXCLUDED.source_table, member_id = EXCLUDED.member_id,
        updated_at = now();

  -- ── Rule: agreement_unsigned (warning) ────────────────────
  INSERT INTO public.ops_alerts
    (member_id, alert_type, severity, title, message, source_table, source_id, is_active)
  SELECT m.id, 'agreement_unsigned', 'warning',
         'Membership agreement unsigned',
         format('Member added %s days ago; membership agreement still unsigned.',
                EXTRACT(DAY FROM now() - m.created_at)::int),
         'member_profiles', m.id, true
  FROM public.members m
  LEFT JOIN public.member_profiles mp ON mp.id = m.id
  WHERE m.created_at < now() - interval '7 days'
    AND COALESCE(mp.membership_agreement_signed, false) = false
  ON CONFLICT (alert_type, source_id) DO UPDATE
    SET is_active = true, severity = EXCLUDED.severity,
        title = EXCLUDED.title, message = EXCLUDED.message,
        source_table = EXCLUDED.source_table, member_id = EXCLUDED.member_id,
        updated_at = now();

  -- ── Rule: medical_disclaimer_unsigned (warning) ──────────
  INSERT INTO public.ops_alerts
    (member_id, alert_type, severity, title, message, source_table, source_id, is_active)
  SELECT m.id, 'medical_disclaimer_unsigned', 'warning',
         'Medical disclaimer unsigned',
         'Member added more than 7 days ago; medical disclaimer not yet signed.',
         'member_profiles', m.id, true
  FROM public.members m
  LEFT JOIN public.member_profiles mp ON mp.id = m.id
  WHERE m.created_at < now() - interval '7 days'
    AND COALESCE(mp.medical_disclaimer_signed, false) = false
  ON CONFLICT (alert_type, source_id) DO UPDATE
    SET is_active = true, severity = EXCLUDED.severity,
        title = EXCLUDED.title, message = EXCLUDED.message,
        source_table = EXCLUDED.source_table, member_id = EXCLUDED.member_id,
        updated_at = now();

  -- ── Rule: setup_incomplete (warning) ──────────────────────
  INSERT INTO public.ops_alerts
    (member_id, alert_type, severity, title, message, source_table, source_id, is_active)
  SELECT m.id, 'setup_incomplete', 'warning',
         'Account setup not finished',
         format('Setup link sent %s days ago; onboarding still not complete.',
                EXTRACT(DAY FROM now() - mp.invited_at)::int),
         'member_profiles', m.id, true
  FROM public.members m
  JOIN public.member_profiles mp ON mp.id = m.id
  WHERE mp.invited_at IS NOT NULL
    AND mp.invited_at < now() - interval '5 days'
    AND COALESCE(mp.onboarding_complete, false) = false
  ON CONFLICT (alert_type, source_id) DO UPDATE
    SET is_active = true, severity = EXCLUDED.severity,
        title = EXCLUDED.title, message = EXCLUDED.message,
        source_table = EXCLUDED.source_table, member_id = EXCLUDED.member_id,
        updated_at = now();

  -- ── Rule: payment_received (info, last 7 days) ───────────
  -- Stripe-backed donations table normalizes status to 'completed'
  INSERT INTO public.ops_alerts
    (member_id, alert_type, severity, title, message, source_table, source_id, is_active, expires_at)
  SELECT d.member_id, 'payment_received', 'info',
         format('Payment received: $%s', to_char(d.amount_cents / 100.0, 'FM999,999.00')),
         format('%s · %s',
                COALESCE(NULLIF(d.kind,''), 'donation'),
                to_char(COALESCE(d.completed_at, d.created_at) AT TIME ZONE 'Pacific/Honolulu', 'Mon DD HH24:MI')),
         'donations', d.id, true,
         COALESCE(d.completed_at, d.created_at) + interval '7 days'
  FROM public.donations d
  WHERE d.status = 'completed'
    AND COALESCE(d.completed_at, d.created_at) > now() - interval '7 days'
  ON CONFLICT (alert_type, source_id) DO UPDATE
    SET is_active = true, severity = EXCLUDED.severity,
        title = EXCLUDED.title, message = EXCLUDED.message,
        source_table = EXCLUDED.source_table, member_id = EXCLUDED.member_id,
        expires_at = EXCLUDED.expires_at,
        updated_at = now();

  -- ── Rule: payment_failed (high) ──────────────────────────
  INSERT INTO public.ops_alerts
    (member_id, alert_type, severity, title, message, source_table, source_id, is_active)
  SELECT d.member_id, 'payment_failed', 'high',
         'Payment failed',
         COALESCE('Reason: ' || d.failure_reason, 'A payment attempt failed.'),
         'donations', d.id, true
  FROM public.donations d
  WHERE d.status = 'failed'
    AND d.created_at > now() - interval '14 days'
  ON CONFLICT (alert_type, source_id) DO UPDATE
    SET is_active = true, severity = EXCLUDED.severity,
        title = EXCLUDED.title, message = EXCLUDED.message,
        source_table = EXCLUDED.source_table, member_id = EXCLUDED.member_id,
        updated_at = now();

  -- ── Rule: webhook_orphan (warning) ───────────────────────
  INSERT INTO public.ops_alerts
    (member_id, alert_type, severity, title, message, source_table, source_id, is_active)
  SELECT NULL, 'webhook_orphan', 'warning',
         'Webhook needs attention',
         format('Source: %s · event: %s · received %s',
                COALESCE(wr.source,'?'),
                COALESCE(wr.event_type,'?'),
                to_char(wr.received_at AT TIME ZONE 'Pacific/Honolulu', 'Mon DD HH24:MI')),
         'webhook_receipts', wr.id, true
  FROM public.webhook_receipts wr
  WHERE wr.received_at > now() - interval '14 days'
    AND (
      wr.processing_status = 'failed'
      OR (wr.source = 'calendly' AND wr.lead_id IS NULL
          AND COALESCE(wr.processing_status,'') NOT IN ('success','processed'))
    )
  ON CONFLICT (alert_type, source_id) DO UPDATE
    SET is_active = true, severity = EXCLUDED.severity,
        title = EXCLUDED.title, message = EXCLUDED.message,
        source_table = EXCLUDED.source_table,
        updated_at = now();

  -- ── Rule: integration_call_gap (warning) ─────────────────
  INSERT INTO public.ops_alerts
    (member_id, alert_type, severity, title, message, source_table, source_id, is_active)
  SELECT cr.member_id, 'integration_call_gap', 'warning',
         'No integration calls logged',
         format('Ceremony on %s completed; integration_calls = 0.',
                to_char(cr.ceremony_date, 'Mon DD')),
         'ceremony_records', cr.id, true
  FROM public.ceremony_records cr
  WHERE cr.status = 'Complete'
    AND cr.ceremony_date < CURRENT_DATE - interval '14 days'
    AND COALESCE(cr.integration_calls, 0) = 0
  ON CONFLICT (alert_type, source_id) DO UPDATE
    SET is_active = true, severity = EXCLUDED.severity,
        title = EXCLUDED.title, message = EXCLUDED.message,
        source_table = EXCLUDED.source_table, member_id = EXCLUDED.member_id,
        updated_at = now();

  -- ── Rule: adverse_event_unresolved (critical/high) ───────
  INSERT INTO public.ops_alerts
    (member_id, alert_type, severity, title, message, source_table, source_id, is_active)
  SELECT ae.member_id, 'adverse_event_unresolved',
         CASE WHEN ae.severity IN ('severe','life_threatening') THEN 'critical' ELSE 'high' END,
         format('Adverse event unresolved: %s', COALESCE(ae.event_type, 'event')),
         COALESCE(NULLIF(ae.description,''), 'Open adverse event requires follow-up.'),
         'adverse_events', ae.id, true
  FROM public.adverse_events ae
  WHERE COALESCE(ae.resolution_status, 'open') NOT IN ('resolved','closed')
  ON CONFLICT (alert_type, source_id) DO UPDATE
    SET is_active = true, severity = EXCLUDED.severity,
        title = EXCLUDED.title, message = EXCLUDED.message,
        source_table = EXCLUDED.source_table, member_id = EXCLUDED.member_id,
        updated_at = now();

  -- ── Rule: post_ceremony_stalled (info) ───────────────────
  INSERT INTO public.ops_alerts
    (member_id, alert_type, severity, title, message, source_table, source_id, is_active)
  SELECT pcp.member_id, 'post_ceremony_stalled', 'info',
         'Post-ceremony tracking stalled',
         format('Last update %s; week %s.',
                to_char(pcp.last_updated AT TIME ZONE 'Pacific/Honolulu', 'Mon DD'),
                COALESCE(pcp.current_week::text, '?')),
         'post_ceremony_progress', pcp.id, true
  FROM public.post_ceremony_progress pcp
  WHERE pcp.last_updated < now() - interval '14 days'
  ON CONFLICT (alert_type, source_id) DO UPDATE
    SET is_active = true, severity = EXCLUDED.severity,
        title = EXCLUDED.title, message = EXCLUDED.message,
        source_table = EXCLUDED.source_table, member_id = EXCLUDED.member_id,
        updated_at = now();

  -- 2) Drop expired info alerts (e.g. payment_received older than 7d)
  UPDATE public.ops_alerts
  SET is_active = false, updated_at = now()
  WHERE is_active = true
    AND expires_at IS NOT NULL
    AND expires_at < now();

  SELECT COUNT(*) INTO v_active FROM public.ops_alerts WHERE is_active = true;
  RETURN v_active;
END;
$$;

-- ── Public wrapper: founder-only ────────────────────────────
CREATE OR REPLACE FUNCTION public.refresh_ops_alerts()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT public.is_founder() THEN
    RAISE EXCEPTION 'Founder access required';
  END IF;
  RETURN public._refresh_ops_alerts_internal();
END;
$$;

REVOKE ALL ON FUNCTION public._refresh_ops_alerts_internal() FROM public;
REVOKE ALL ON FUNCTION public.refresh_ops_alerts() FROM public;
GRANT EXECUTE ON FUNCTION public.refresh_ops_alerts() TO authenticated;

-- ── Schedule via pg_cron: every 15 minutes ──────────────────
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh_ops_alerts') THEN
    PERFORM cron.unschedule('refresh_ops_alerts');
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END
$cron$;

SELECT cron.schedule(
  'refresh_ops_alerts',
  '*/15 * * * *',
  $cmd$ SELECT public._refresh_ops_alerts_internal(); $cmd$
);

COMMIT;
