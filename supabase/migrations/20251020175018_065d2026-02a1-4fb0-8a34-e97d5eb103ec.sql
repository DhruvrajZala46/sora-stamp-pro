-- Update file size limits for all plans
-- Free and Starter: 100MB, Pro: 300MB, Unlimited: 500MB

-- Update existing subscriptions to new limits
UPDATE user_subscriptions 
SET max_file_size_mb = 100 
WHERE plan IN ('free', 'starter') AND max_file_size_mb != 100;

UPDATE user_subscriptions 
SET max_file_size_mb = 300 
WHERE plan = 'pro' AND max_file_size_mb != 300;

UPDATE user_subscriptions 
SET max_file_size_mb = 500 
WHERE plan = 'unlimited' AND max_file_size_mb != 500;

-- Update default for new free users
ALTER TABLE user_subscriptions 
ALTER COLUMN max_file_size_mb SET DEFAULT 100;