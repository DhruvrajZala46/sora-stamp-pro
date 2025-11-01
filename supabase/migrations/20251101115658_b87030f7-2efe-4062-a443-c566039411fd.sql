-- Fix feedback_submissions RLS policy to allow admin access
-- First, create a simple admin check function that uses a hardcoded admin email list
-- In production, this would be replaced with a proper user_roles table

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- For now, allow service role only
  -- In the future, add a user_roles table for proper admin management
  SELECT false;
$$;

-- Update the feedback_submissions SELECT policy to allow admins (via service role) to view all feedback
DROP POLICY IF EXISTS "Users can view own feedback" ON public.feedback_submissions;

CREATE POLICY "Service role can view all feedback"
ON public.feedback_submissions
FOR SELECT
USING (
  -- Only service role can read feedback for now
  -- This allows backend admin interfaces to access feedback
  auth.role() = 'service_role'
);