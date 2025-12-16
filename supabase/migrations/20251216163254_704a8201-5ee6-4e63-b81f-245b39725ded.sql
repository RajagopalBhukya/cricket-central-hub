-- Remove insecure RLS policies that allow users to access OTPs
DROP POLICY IF EXISTS "Users can view own OTP by email" ON public.password_reset_otps;
DROP POLICY IF EXISTS "Users can update own OTP by email" ON public.password_reset_otps;

-- The table should only be accessible via edge functions using service role key
-- Keep only admin access for debugging purposes
-- The existing "Only admins can view OTPs" policy is already in place