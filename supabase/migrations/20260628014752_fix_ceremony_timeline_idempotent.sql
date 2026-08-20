-- Fix: rescheduling a member's ceremony date threw
--   "duplicate key value violates unique constraint uq_member_timelines_system_event"
--
-- The sync_ceremony_date_to_member() trigger logs a system timeline event on
-- ceremony_records INSERT/UPDATE with a plain INSERT. The partial unique index
-- uq_member_timelines_system_event (member_id, event_type, source_table,
-- COALESCE(source_id::text,'')) WHERE is_system = true means a second date
-- change on the same ceremony_record collides and aborts the whole reschedule.
--
-- Make both inserts idempotent: on conflict, refresh the existing row's detail
-- and timestamp instead of erroring. Additive behavior change only; no data is
-- modified or removed.
CREATE OR REPLACE FUNCTION public.sync_ceremony_date_to_member()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NEW.ceremony_date IS NOT NULL THEN
    UPDATE public.members
    SET ceremony_date = NEW.ceremony_date
    WHERE id = NEW.member_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.member_timelines (
      member_id, event_type, event_title, event_detail,
      event_date, is_system, source_table, source_id
    ) VALUES (
      NEW.member_id, 'ceremony_scheduled', 'Ceremony scheduled',
      COALESCE('Date: ' || NEW.ceremony_date::text, 'Date TBD'),
      NOW(), true, 'ceremony_records', NEW.id
    )
    ON CONFLICT (member_id, event_type, source_table, COALESCE((source_id)::text, ''::text))
      WHERE (is_system = true)
    DO UPDATE SET
      event_detail = EXCLUDED.event_detail,
      event_date   = EXCLUDED.event_date;
  ELSIF TG_OP = 'UPDATE' AND NEW.ceremony_date IS DISTINCT FROM OLD.ceremony_date THEN
    INSERT INTO public.member_timelines (
      member_id, event_type, event_title, event_detail,
      event_date, is_system, source_table, source_id
    ) VALUES (
      NEW.member_id, 'ceremony_date_changed', 'Ceremony date updated',
      'Changed from ' || COALESCE(OLD.ceremony_date::text, 'TBD') ||
      ' to ' || COALESCE(NEW.ceremony_date::text, 'TBD'),
      NOW(), true, 'ceremony_records', NEW.id
    )
    ON CONFLICT (member_id, event_type, source_table, COALESCE((source_id)::text, ''::text))
      WHERE (is_system = true)
    DO UPDATE SET
      event_detail = EXCLUDED.event_detail,
      event_date   = EXCLUDED.event_date;
  END IF;

  RETURN NEW;
END;
$function$;
