-- Create idempotent RPC to ensure a subscription exists and return current credits
CREATE OR REPLACE FUNCTION public.ensure_user_subscription()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_credits integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Insert welcome credits if missing, do nothing if already exists
  INSERT INTO public.user_subscriptions (user_id, credits, has_received_welcome_credits, created_at, updated_at)
  VALUES (auth.uid(), 100, true, now(), now())
  ON CONFLICT (user_id) DO NOTHING;

  -- Return current balance
  SELECT credits INTO current_credits
  FROM public.user_subscriptions
  WHERE user_id = auth.uid();

  RETURN COALESCE(current_credits, 0);
END;
$$;

-- Remove auth.users signup triggers to prevent callback failures
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_profile ON auth.users;