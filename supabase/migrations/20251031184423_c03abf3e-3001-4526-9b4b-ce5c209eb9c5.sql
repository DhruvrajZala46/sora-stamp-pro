-- Update handle_new_user function to give 150 free credits
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_subscriptions (user_id, plan, videos_remaining, max_file_size_mb, credits)
  VALUES (NEW.id, 'free', 0, 200, 150);
  RETURN NEW;
END;
$function$;