-- Add 'pending' and 'confirmed' to booking_status enum
ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'confirmed';

-- Add booked_by column to track who made the booking
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS booked_by TEXT DEFAULT 'user' CHECK (booked_by IN ('user', 'admin'));

-- Add confirmed_at timestamp
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP WITH TIME ZONE;

-- Add confirmed_by to track which admin confirmed
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES auth.users(id);

-- Update check_booking_conflict function to include pending bookings (they should block slots too)
CREATE OR REPLACE FUNCTION public.check_booking_conflict(_ground_id uuid, _booking_date date, _start_time time without time zone, _end_time time without time zone, _exclude_booking_id uuid DEFAULT NULL::uuid)
RETURNS boolean
LANGUAGE plpgsql
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