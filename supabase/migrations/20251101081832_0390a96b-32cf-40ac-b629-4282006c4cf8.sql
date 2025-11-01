-- Add flag to track welcome credits (one-time bonus)
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS has_received_welcome_credits BOOLEAN DEFAULT false;

-- Remove subscription-based columns (keeping them as nullable for migration compatibility)
ALTER TABLE user_subscriptions ALTER COLUMN plan DROP NOT NULL;
ALTER TABLE user_subscriptions ALTER COLUMN videos_remaining DROP NOT NULL;
ALTER TABLE user_subscriptions ALTER COLUMN max_file_size_mb DROP NOT NULL;

-- Update default credits to 100 for new users
ALTER TABLE user_subscriptions ALTER COLUMN credits SET DEFAULT 100;

-- Update service pricing: Remove = 100 credits, Add = 200 credits
UPDATE service_pricing SET credits_cost = 100 WHERE service_type = 'watermark_remove';
UPDATE service_pricing SET credits_cost = 200 WHERE service_type = 'watermark_add';

-- Clear and update credit packages with new pricing
DELETE FROM credit_packages;

INSERT INTO credit_packages (name, credits, price_usd, polar_product_id, is_active) VALUES
('Starter Pack', 1000, 2.99, NULL, true),
('Popular Pack', 3000, 6.99, NULL, true),
('Pro Pack', 8000, 14.99, NULL, true),
('Ultimate Pack', 20000, 30.99, NULL, true);

-- Update the handle_new_user function to give 100 credits once
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_subscriptions (user_id, credits, has_received_welcome_credits)
  VALUES (NEW.id, 100, true);
  RETURN NEW;
END;
$function$;

-- Add operation_type to videos table to track removal vs addition
ALTER TABLE videos ADD COLUMN IF NOT EXISTS operation_type TEXT DEFAULT 'watermark_add';

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_videos_user_created ON videos(user_id, created_at DESC);