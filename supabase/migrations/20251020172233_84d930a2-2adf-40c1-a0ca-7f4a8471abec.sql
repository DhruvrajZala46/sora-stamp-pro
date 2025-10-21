-- Drop and recreate the update_subscription_from_webhook function with explicit parameter names
DROP FUNCTION IF EXISTS public.update_subscription_from_webhook(UUID, TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT);

-- Create function with named parameters in the exact order the webhook calls it
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
RETURNS JSONB
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
  result JSONB;
BEGIN
  -- Log the incoming parameters for debugging
  RAISE NOTICE 'update_subscription_from_webhook called: user=%, plan=%, videos=%, webhook=%', 
    p_user_id, p_plan, p_videos_remaining, p_webhook_id;

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
    RAISE WARNING 'Webhook already processed: %', p_webhook_id;
    RETURN jsonb_build_object('success', false, 'reason', 'already_processed');
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
    videos_remaining = 
      CASE 
        WHEN user_subscriptions.plan != EXCLUDED.plan THEN EXCLUDED.videos_remaining
        ELSE user_subscriptions.videos_remaining
      END,
    max_file_size_mb = EXCLUDED.max_file_size_mb,
    updated_at = NOW();

  -- Log the successful change
  RAISE NOTICE 'Subscription updated successfully: user=%, plan=%, videos=%, webhook=%', 
    p_user_id, p_plan, p_videos_remaining, p_webhook_id;

  RETURN jsonb_build_object('success', true, 'plan', p_plan, 'videos', p_videos_remaining);
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to update subscription: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'sqlstate', SQLSTATE);
END;
$$;