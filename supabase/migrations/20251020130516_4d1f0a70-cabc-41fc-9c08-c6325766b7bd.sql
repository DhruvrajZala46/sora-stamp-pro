-- Fix SECURITY DEFINER functions to validate caller owns the user_id
-- This prevents privilege escalation where users could manipulate other users' data

CREATE OR REPLACE FUNCTION public.decrement_videos_remaining(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_remaining integer;
BEGIN
  -- SECURITY: Validate caller owns this user_id
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: cannot modify another user''s quota';
  END IF;

  -- Get current videos remaining with row lock
  SELECT videos_remaining INTO current_remaining
  FROM user_subscriptions
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- Check if user has videos remaining
  IF current_remaining IS NULL OR current_remaining <= 0 THEN
    RETURN false;
  END IF;

  -- Decrement the count
  UPDATE user_subscriptions
  SET videos_remaining = videos_remaining - 1,
      updated_at = now()
  WHERE user_id = p_user_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_file_size_limit(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  size_limit integer;
BEGIN
  -- SECURITY: Validate caller owns this user_id
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: cannot access another user''s data';
  END IF;
  
  SELECT max_file_size_mb INTO size_limit
  FROM user_subscriptions
  WHERE user_id = p_user_id;
  
  RETURN COALESCE(size_limit, 100);
END;
$$;