-- Create webhook_audit table for tracking processed webhooks
CREATE TABLE IF NOT EXISTS public.webhook_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  subscription_id TEXT,
  user_id UUID,
  plan TEXT,
  payload_hash TEXT NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS on webhook_audit
ALTER TABLE public.webhook_audit ENABLE ROW LEVEL SECURITY;

-- Only service role can access webhook audit (no user access needed)
CREATE POLICY "Service role only access"
ON public.webhook_audit
FOR ALL
USING (false);

-- Add index for quick replay detection
CREATE INDEX idx_webhook_audit_webhook_id ON public.webhook_audit(webhook_id);
CREATE INDEX idx_webhook_audit_processed_at ON public.webhook_audit(processed_at);

-- Create function to verify subscription update with additional validation
CREATE OR REPLACE FUNCTION public.update_subscription_from_webhook(
  p_user_id UUID,
  p_plan TEXT,
  p_videos_remaining INTEGER,
  p_max_file_size_mb INTEGER,
  p_product_id TEXT,
  p_subscription_id TEXT,
  p_webhook_id TEXT,
  p_event_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  valid_product_ids TEXT[] := ARRAY[
    '0dfb8146-7505-4dc9-b7ce-a669919533b2',
    '240aaa37-f58b-4f9c-93ae-e0df52f0644c',
    '95d38e1c-8f47-4048-b3e3-f06edc38b8d9'
  ];
  payload_hash TEXT;
BEGIN
  -- Validate product ID is in allowed list (or empty for free plan)
  IF p_product_id != '' AND NOT (p_product_id = ANY(valid_product_ids)) THEN
    RAISE EXCEPTION 'Invalid product ID: %', p_product_id;
  END IF;

  -- Validate plan values
  IF p_plan NOT IN ('free', 'starter', 'pro', 'unlimited') THEN
    RAISE EXCEPTION 'Invalid plan: %', p_plan;
  END IF;

  -- Create payload hash for audit
  payload_hash := encode(digest(
    p_user_id::TEXT || p_plan || p_videos_remaining::TEXT || p_max_file_size_mb::TEXT || p_product_id,
    'sha256'
  ), 'hex');

  -- Check for replay attack
  IF EXISTS (SELECT 1 FROM webhook_audit WHERE webhook_id = p_webhook_id) THEN
    RAISE EXCEPTION 'Webhook already processed: %', p_webhook_id;
  END IF;

  -- Insert audit record
  INSERT INTO webhook_audit (webhook_id, event_type, subscription_id, user_id, plan, payload_hash)
  VALUES (p_webhook_id, p_event_type, p_subscription_id, p_user_id, p_plan, payload_hash);

  -- Update subscription
  INSERT INTO user_subscriptions (user_id, plan, videos_remaining, max_file_size_mb, updated_at)
  VALUES (p_user_id, p_plan, p_videos_remaining, p_max_file_size_mb, NOW())
  ON CONFLICT (user_id) 
  DO UPDATE SET
    plan = EXCLUDED.plan,
    videos_remaining = EXCLUDED.videos_remaining,
    max_file_size_mb = EXCLUDED.max_file_size_mb,
    updated_at = NOW();

  -- Log the change
  RAISE NOTICE 'Subscription updated: user=%, plan=%, videos=%, webhook=%', 
    p_user_id, p_plan, p_videos_remaining, p_webhook_id;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to update subscription: %', SQLERRM;
    RETURN FALSE;
END;
$$;