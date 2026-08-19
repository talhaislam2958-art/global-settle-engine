ALTER TABLE public.bot_settings
  ADD COLUMN IF NOT EXISTS poll_interval_seconds integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS notify_new_order boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_paid boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_appeal boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_release boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_sms boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_ambiguity boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.validate_poll_interval()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.poll_interval_seconds < 2 OR NEW.poll_interval_seconds > 300 THEN
    RAISE EXCEPTION 'poll_interval_seconds must be between 2 and 300';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bot_settings_validate_poll ON public.bot_settings;
CREATE TRIGGER bot_settings_validate_poll
  BEFORE INSERT OR UPDATE ON public.bot_settings
  FOR EACH ROW EXECUTE FUNCTION public.validate_poll_interval();

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS match_ambiguous boolean NOT NULL DEFAULT false;