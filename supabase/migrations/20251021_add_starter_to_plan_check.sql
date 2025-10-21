DO $$
BEGIN
  ALTER TABLE user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_plan_check;
  ALTER TABLE user_subscriptions
    ADD CONSTRAINT user_subscriptions_plan_check
    CHECK (plan IN ('free', 'starter', 'pro', 'unlimited'));
END$$;
