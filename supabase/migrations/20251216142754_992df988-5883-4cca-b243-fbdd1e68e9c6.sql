
-- Add unique constraint to prevent double booking at database level
ALTER TABLE public.bookings 
ADD CONSTRAINT unique_booking_slot 
UNIQUE (ground_id, booking_date, start_time);

-- Create index on created_at for timestamp-based conflict resolution
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON public.bookings (created_at);
