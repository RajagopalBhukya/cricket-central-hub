-- Drop the existing policy that combines user and admin access
DROP POLICY IF EXISTS "Users can view own profile only" ON public.profiles;

-- Create separate policy for users to view ONLY their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Create separate policy for admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));