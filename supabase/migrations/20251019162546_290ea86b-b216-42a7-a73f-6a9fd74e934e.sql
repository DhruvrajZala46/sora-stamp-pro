-- Update default free tier to 5 videos
ALTER TABLE public.user_subscriptions 
ALTER COLUMN videos_remaining SET DEFAULT 5;

-- Update the trigger function to give 5 videos for free tier
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  INSERT INTO public.user_subscriptions (user_id, plan, videos_remaining)
  VALUES (NEW.id, 'free', 5);
  RETURN NEW;
END;
$function$;