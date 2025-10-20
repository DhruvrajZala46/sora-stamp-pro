-- Add max_file_size_mb to user_subscriptions table
ALTER TABLE public.user_subscriptions 
ADD COLUMN max_file_size_mb integer NOT NULL DEFAULT 100;

-- Update existing users to have correct limits based on their plan
UPDATE public.user_subscriptions
SET max_file_size_mb = CASE 
  WHEN plan = 'free' THEN 100
  WHEN plan = 'starter' THEN 250
  WHEN plan = 'pro' THEN 500
  WHEN plan = 'unlimited' THEN 1000
  ELSE 100
END;

-- Update the handle_new_user function to set correct file size limit
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_subscriptions (user_id, plan, videos_remaining, max_file_size_mb)
  VALUES (NEW.id, 'free', 5, 100);
  RETURN NEW;
END;
$function$;

-- Create secure function to get user's file size limit
CREATE OR REPLACE FUNCTION public.get_user_file_size_limit(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  size_limit integer;
BEGIN
  SELECT max_file_size_mb INTO size_limit
  FROM user_subscriptions
  WHERE user_id = p_user_id;
  
  RETURN COALESCE(size_limit, 100);
END;
$function$;