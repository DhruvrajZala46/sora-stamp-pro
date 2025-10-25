-- Remove old check constraint if it exists and add new one that includes 'starter'
ALTER TABLE user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_plan_check;

-- Add check constraint that includes all valid plans
ALTER TABLE user_subscriptions ADD CONSTRAINT user_subscriptions_plan_check 
  CHECK (plan IN ('free', 'starter', 'pro', 'unlimited'));

-- Update default max_file_size_mb for existing free users to 200MB
UPDATE user_subscriptions 
SET max_file_size_mb = 200 
WHERE plan = 'free' AND max_file_size_mb = 100;

-- Update the handle_new_user function to set 200MB for new free users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_subscriptions (user_id, plan, videos_remaining, max_file_size_mb)
  VALUES (NEW.id, 'free', 5, 200);
  RETURN NEW;
END;
$function$;

-- Update get_user_file_size_limit function to return 200 as default
CREATE OR REPLACE FUNCTION public.get_user_file_size_limit(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  
  RETURN COALESCE(size_limit, 200);
END;
$function$;