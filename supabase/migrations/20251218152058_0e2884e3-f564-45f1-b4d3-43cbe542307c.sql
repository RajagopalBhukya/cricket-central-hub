-- Drop the insecure policy with OR condition
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Drop admin view policy (admins should use service role, not client RLS)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Create strict owner-only SELECT policy
CREATE POLICY "Users can view own profile only"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Note: Admins will access profiles via service role (bypasses RLS)
-- This is more secure than granting client-side admin access