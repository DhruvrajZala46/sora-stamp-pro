-- Consolidate user creation logic to prevent duplicate inserts and signup failures
-- 1) Create a single handler that upserts profile and grants welcome credits once
CREATE OR REPLACE FUNCTION public.handle_auth_user_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Upsert profile safely (id is PK)
  INSERT INTO public.profiles (id, email, full_name, avatar_url, created_at, updated_at)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url', now(), now())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    updated_at = now();

  -- Grant 100 welcome credits exactly once
  INSERT INTO public.user_subscriptions (user_id, credits, has_received_welcome_credits, created_at, updated_at)
  VALUES (NEW.id, 100, true, now(), now())
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 2) Remove any existing overlapping triggers so only one runs
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_profile ON auth.users;

-- 3) Create the single, consolidated trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_created();