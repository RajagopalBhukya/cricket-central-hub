-- Fix password_reset_otps RLS policies to prevent public exposure
DROP POLICY IF EXISTS "Users can view own OTP" ON public.password_reset_otps;
DROP POLICY IF EXISTS "Users can insert own OTP" ON public.password_reset_otps;
DROP POLICY IF EXISTS "Users can update own OTP" ON public.password_reset_otps;

-- Create secure policies that only allow access based on email
CREATE POLICY "Users can view own OTP by email" 
ON public.password_reset_otps 
FOR SELECT 
USING (email = auth.jwt()->>'email');

CREATE POLICY "Users can insert OTP for verification" 
ON public.password_reset_otps 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update own OTP by email" 
ON public.password_reset_otps 
FOR UPDATE 
USING (email = auth.jwt()->>'email');