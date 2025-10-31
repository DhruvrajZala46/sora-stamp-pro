-- Drop old subscription constraints and add credit system tables

-- First, update user_subscriptions to support credit system
ALTER TABLE user_subscriptions 
DROP CONSTRAINT IF EXISTS user_subscriptions_plan_check;

ALTER TABLE user_subscriptions
ADD COLUMN IF NOT EXISTS credits INTEGER NOT NULL DEFAULT 15;

-- Update existing users to have 15 free credits
UPDATE user_subscriptions SET credits = 15 WHERE plan = 'free';

-- Create credits_transactions table to track all credit purchases and usage
CREATE TABLE IF NOT EXISTS public.credits_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'deduction', 'refund', 'bonus')),
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on credits_transactions
ALTER TABLE public.credits_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for credits_transactions
CREATE POLICY "Users can view own transactions"
ON public.credits_transactions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users cannot insert transactions directly"
ON public.credits_transactions
FOR INSERT
WITH CHECK (false);

CREATE POLICY "Users cannot update transactions"
ON public.credits_transactions
FOR UPDATE
USING (false);

CREATE POLICY "Users cannot delete transactions"
ON public.credits_transactions
FOR DELETE
USING (false);

-- Create credit_packages table for different credit purchase options
CREATE TABLE IF NOT EXISTS public.credit_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  credits INTEGER NOT NULL,
  price_usd DECIMAL(10, 2) NOT NULL,
  polar_product_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on credit_packages
ALTER TABLE public.credit_packages ENABLE ROW LEVEL SECURITY;

-- RLS policy - everyone can view active packages
CREATE POLICY "Anyone can view active packages"
ON public.credit_packages
FOR SELECT
USING (is_active = true);

-- Insert default credit packages (you'll update with actual Polar product IDs)
INSERT INTO public.credit_packages (name, credits, price_usd, polar_product_id, is_active) VALUES
('Starter Pack', 50, 5.00, NULL, true),
('Popular Pack', 150, 12.00, NULL, true),
('Pro Pack', 350, 25.00, NULL, true),
('Ultimate Pack', 1000, 60.00, NULL, true)
ON CONFLICT DO NOTHING;

-- Create service pricing table
CREATE TABLE IF NOT EXISTS public.service_pricing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_type TEXT NOT NULL UNIQUE CHECK (service_type IN ('watermark_add', 'watermark_remove')),
  credits_cost INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on service_pricing
ALTER TABLE public.service_pricing ENABLE ROW LEVEL SECURITY;

-- RLS policy - everyone can view service pricing
CREATE POLICY "Anyone can view service pricing"
ON public.service_pricing
FOR SELECT
USING (true);

-- Insert service pricing
INSERT INTO public.service_pricing (service_type, credits_cost, description) VALUES
('watermark_add', 5, 'Add Sora watermark to video'),
('watermark_remove', 15, 'Remove Sora watermark from video using AI')
ON CONFLICT (service_type) DO UPDATE SET 
  credits_cost = EXCLUDED.credits_cost,
  description = EXCLUDED.description;

-- Function to deduct credits and log transaction
CREATE OR REPLACE FUNCTION public.deduct_credits(
  p_user_id UUID,
  p_credits INTEGER,
  p_description TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_credits INTEGER;
BEGIN
  -- SECURITY: Validate caller owns this user_id
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: cannot modify another user''s credits';
  END IF;

  -- Get current credits with row lock
  SELECT credits INTO current_credits
  FROM user_subscriptions
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- Check if user has enough credits
  IF current_credits IS NULL OR current_credits < p_credits THEN
    RETURN false;
  END IF;

  -- Deduct credits
  UPDATE user_subscriptions
  SET credits = credits - p_credits,
      updated_at = now()
  WHERE user_id = p_user_id;

  -- Log transaction
  INSERT INTO credits_transactions (user_id, amount, transaction_type, description)
  VALUES (p_user_id, -p_credits, 'deduction', p_description);

  RETURN true;
END;
$$;

-- Function to add credits (for purchases)
CREATE OR REPLACE FUNCTION public.add_credits(
  p_user_id UUID,
  p_credits INTEGER,
  p_description TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Add credits
  UPDATE user_subscriptions
  SET credits = credits + p_credits,
      updated_at = now()
  WHERE user_id = p_user_id;

  -- Log transaction
  INSERT INTO credits_transactions (user_id, amount, transaction_type, description)
  VALUES (p_user_id, p_credits, 'purchase', p_description);

  RETURN true;
END;
$$;

-- Update handle_new_user function to give 15 free credits
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_subscriptions (user_id, plan, videos_remaining, max_file_size_mb, credits)
  VALUES (NEW.id, 'free', 5, 200, 15);
  RETURN NEW;
END;
$$;