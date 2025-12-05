-- Fix password_reset_otps security vulnerability
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Users can insert OTP for verification" ON public.password_reset_otps;
DROP POLICY IF EXISTS "Users can select OTP for verification" ON public.password_reset_otps;
DROP POLICY IF EXISTS "Users can update OTP after verification" ON public.password_reset_otps;

-- Create more restrictive policies - only allow through server-side functions
-- No direct client-side access to OTP table
CREATE POLICY "Only admins can view OTPs"
ON public.password_reset_otps
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Add INSERT policy for profiles (fixing the missing policy)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Ensure profiles table has proper SELECT policy
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

-- Ensure profiles table has proper UPDATE policy  
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Add admin delete policy for user management
CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));