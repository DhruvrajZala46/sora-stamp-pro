-- Reset credit packages to sandbox products and pricing
-- 1) Clear existing packages
DELETE FROM public.credit_packages;

-- 2) Insert new packages
INSERT INTO public.credit_packages (name, credits, price_usd, is_active, polar_product_id)
VALUES
  ('Starter Pack', 1000, 2.99, true, '2ecc2359-3a1a-459a-84bc-a94432580a9a'),
  ('Popular Pack', 3000, 6.99, true, '4b40a167-16b8-4504-ba99-2781ebaadc7a'),
  ('Pro Pack', 8000, 14.99, true, 'b2103a26-ca5a-43a1-913b-11b5773c203a'),
  ('Ultimate Pack', 20000, 30.99, true, '8a37747f-979f-4082-a58a-4984cc9187ff');

-- 3) Remove legacy subscription columns if they still exist
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_subscriptions' AND column_name='plan'
  ) THEN
    ALTER TABLE public.user_subscriptions DROP COLUMN plan;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_subscriptions' AND column_name='videos_remaining'
  ) THEN
    ALTER TABLE public.user_subscriptions DROP COLUMN videos_remaining;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_subscriptions' AND column_name='max_file_size_mb'
  ) THEN
    ALTER TABLE public.user_subscriptions DROP COLUMN max_file_size_mb;
  END IF;
END $$;

-- 4) Drop unused subscription-related functions if present
DROP FUNCTION IF EXISTS public.get_user_file_size_limit(uuid);
DROP FUNCTION IF EXISTS public.decrement_videos_remaining(uuid);
DROP FUNCTION IF EXISTS public.update_subscription_from_webhook(uuid, text, integer, integer, text, text, text, text);

-- Keep credits ledger functions and welcome-credits logic as-is