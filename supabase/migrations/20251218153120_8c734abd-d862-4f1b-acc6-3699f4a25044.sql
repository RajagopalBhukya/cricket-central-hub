-- Drop the current restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view own profile only" ON public.profiles;

-- Create new SELECT policy: owner OR verified admin (via user_roles table)
CREATE POLICY "Users can view own profile only"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Drop existing UPDATE policy to recreate with admin access
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Create new UPDATE policy: owner OR verified admin
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  auth.uid() = id 
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  auth.uid() = id 
  OR has_role(auth.uid(), 'admin'::app_role)
);