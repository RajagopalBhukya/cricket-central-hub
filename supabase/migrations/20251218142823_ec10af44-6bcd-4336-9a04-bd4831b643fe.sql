-- Add index for faster booking queries
CREATE INDEX IF NOT EXISTS idx_bookings_ground_date_status ON public.bookings(ground_id, booking_date, status);

-- Add index for user search
CREATE INDEX IF NOT EXISTS idx_profiles_full_name ON public.profiles USING gin(to_tsvector('english', full_name));
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone_number);

-- Add last_active and is_online columns to profiles for user tracking
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_active timestamp with time zone DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_online boolean DEFAULT false;

-- Create function to auto-complete bookings after slot end time
CREATE OR REPLACE FUNCTION public.update_completed_bookings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.bookings
  SET status = 'completed'
  WHERE status IN ('confirmed', 'active')
    AND (booking_date < CURRENT_DATE 
         OR (booking_date = CURRENT_DATE AND end_time < CURRENT_TIME));
END;
$$;