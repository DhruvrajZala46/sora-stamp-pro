-- Create function to automatically create user subscription with 100 welcome credits
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert a new user_subscriptions record with 100 welcome credits
  INSERT INTO public.user_subscriptions (user_id, credits, has_received_welcome_credits)
  VALUES (NEW.id, 100, true);
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically create subscription on user signup
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_subscription();