-- Fix search_path for check_booking_conflict function
CREATE OR REPLACE FUNCTION public.check_booking_conflict(_ground_id uuid, _booking_date date, _start_time time without time zone, _end_time time without time zone, _exclude_booking_id uuid DEFAULT NULL::uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.bookings
    WHERE ground_id = _ground_id
      AND booking_date = _booking_date
      AND status IN ('pending', 'confirmed', 'active', 'completed')
      AND id != COALESCE(_exclude_booking_id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND (start_time, end_time) OVERLAPS (_start_time, _end_time)
  );
END;
$$;

-- Fix search_path for update_updated_at function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;