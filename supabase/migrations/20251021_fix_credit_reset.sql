-- Prevent free plan credit increases
CREATE OR REPLACE FUNCTION prevent_free_credit_increase()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.plan = 'free' AND NEW.videos_remaining > OLD.videos_remaining THEN
    IF OLD.videos_remaining > 0 AND OLD.plan = 'free' THEN
      RAISE EXCEPTION 'Cannot increase free plan credits from % to %. Contact support for credits.', 
        OLD.videos_remaining, NEW.videos_remaining;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_free_credit_limit ON user_subscriptions;
CREATE TRIGGER enforce_free_credit_limit
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_free_credit_increase();
