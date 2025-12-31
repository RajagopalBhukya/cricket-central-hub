-- Prevent overlapping/double bookings at DB level
CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_no_overlap'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_no_overlap
      EXCLUDE USING gist (
        ground_id WITH =,
        booking_date WITH =,
        tsrange(
          (booking_date::timestamp + start_time),
          (booking_date::timestamp + end_time),
          '[)'
        ) WITH &&
      )
      WHERE (status IN ('pending','confirmed','active','completed'));
  END IF;
END $$;

-- Public availability table (no PII) for UI + realtime
CREATE TABLE IF NOT EXISTS public.booking_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  ground_id uuid NOT NULL,
  booking_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  status booking_status NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id)
);

CREATE INDEX IF NOT EXISTS booking_slots_ground_date_idx
  ON public.booking_slots (ground_id, booking_date);

ALTER TABLE public.booking_slots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'booking_slots'
      AND policyname = 'Authenticated users can view booking slots'
  ) THEN
    CREATE POLICY "Authenticated users can view booking slots"
    ON public.booking_slots
    FOR SELECT
    USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Keep booking_slots in sync with bookings (SECURITY DEFINER so it can write regardless of caller RLS)
CREATE OR REPLACE FUNCTION public.sync_booking_slots()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM public.booking_slots WHERE booking_id = OLD.id;
    RETURN OLD;
  END IF;

  IF (NEW.status IN ('pending','confirmed','active','completed')) THEN
    INSERT INTO public.booking_slots (booking_id, ground_id, booking_date, start_time, end_time, status, updated_at)
    VALUES (NEW.id, NEW.ground_id, NEW.booking_date, NEW.start_time, NEW.end_time, NEW.status, now())
    ON CONFLICT (booking_id) DO UPDATE
      SET ground_id = EXCLUDED.ground_id,
          booking_date = EXCLUDED.booking_date,
          start_time = EXCLUDED.start_time,
          end_time = EXCLUDED.end_time,
          status = EXCLUDED.status,
          updated_at = now();
  ELSE
    DELETE FROM public.booking_slots WHERE booking_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_booking_slots_ins ON public.bookings;
CREATE TRIGGER trg_sync_booking_slots_ins
AFTER INSERT ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.sync_booking_slots();

DROP TRIGGER IF EXISTS trg_sync_booking_slots_upd ON public.bookings;
CREATE TRIGGER trg_sync_booking_slots_upd
AFTER UPDATE OF status, ground_id, booking_date, start_time, end_time ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.sync_booking_slots();

DROP TRIGGER IF EXISTS trg_sync_booking_slots_del ON public.bookings;
CREATE TRIGGER trg_sync_booking_slots_del
AFTER DELETE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.sync_booking_slots();

-- Realtime support for booking_slots
ALTER TABLE public.booking_slots REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_slots;