-- Add check constraint to ensure videos_remaining is non-negative
ALTER TABLE public.user_subscriptions 
ADD CONSTRAINT videos_remaining_non_negative 
CHECK (videos_remaining >= 0);

-- Add index for faster plan lookups
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan 
ON public.user_subscriptions(plan);

-- Add index for faster user_id lookups
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id 
ON public.user_subscriptions(user_id);

-- Create function to decrement videos remaining
CREATE OR REPLACE FUNCTION public.decrement_videos_remaining(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_remaining integer;
BEGIN
  -- Get current videos remaining with row lock
  SELECT videos_remaining INTO current_remaining
  FROM user_subscriptions
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- Check if user has videos remaining
  IF current_remaining <= 0 THEN
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

-- Add RLS policy for the decrement function (service role can execute)
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Update plan enum to include new tiers
DO $$ 
BEGIN
  -- Drop existing check constraint if it exists
  ALTER TABLE user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_plan_check;
  
  -- Add new check constraint with updated plans
  ALTER TABLE user_subscriptions 
  ADD CONSTRAINT user_subscriptions_plan_check 
  CHECK (plan IN ('free', 'pro', 'unlimited'));
END $$;