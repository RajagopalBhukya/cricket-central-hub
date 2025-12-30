-- Drop existing policies on user_roles table
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

-- Ensure RLS is enabled and forced
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles FORCE ROW LEVEL SECURITY;

-- SELECT policies (permissive - OR'd together)
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- INSERT policy - only admins
CREATE POLICY "Only admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- UPDATE policy - only admins
CREATE POLICY "Only admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- DELETE policy - only admins
CREATE POLICY "Only admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add restrictive policy to explicitly block non-admins from modifications
-- This acts as an additional safety layer
CREATE POLICY "Block non-admin modifications"
ON public.user_roles
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (
  -- For SELECT: allow if viewing own role OR is admin
  (user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  -- For INSERT/UPDATE: must be admin
  has_role(auth.uid(), 'admin'::app_role)
);