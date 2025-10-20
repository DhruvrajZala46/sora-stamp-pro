import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateEvent } from "https://esm.sh/@polar-sh/sdk@latest/webhooks";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const webhookSecret = Deno.env.get('POLAR_WEBHOOK_SECRET')!;
    const polarAccessToken = Deno.env.get('POLAR_ACCESS_TOKEN')!;

    if (!webhookSecret) {
      console.error('POLAR_WEBHOOK_SECRET not configured');
      return new Response(JSON.stringify({ error: 'Server misconfiguration' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    if (!polarAccessToken) {
      console.error('POLAR_ACCESS_TOKEN not configured');
      return new Response(JSON.stringify({ error: 'Server misconfiguration' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the raw payload for signature verification
    const rawBody = new Uint8Array(await req.arrayBuffer());
    const payload = new TextDecoder('utf-8').decode(rawBody);
    console.log('Webhook received, payload length:', payload.length);

    // === POLAR SIGNATURE VALIDATION ===
    let event: any;
    try {
      // Build plain headers object (lowercased keys)
      const headersObj: Record<string, string> = {};
      for (const [k, v] of req.headers) headersObj[k.toLowerCase()] = v;
      event = validateEvent(payload, headersObj, webhookSecret);
    } catch (err) {
      const msg = (err as Error)?.message || String(err);
      console.error('Invalid webhook signature (SDK):', msg);
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Process the webhook event

    console.log('Processing webhook event:', event.type);

    // Handle different event types
    switch (event.type) {
      case 'subscription.created':
      case 'subscription.active':
      case 'subscription.uncanceled':
        await handleSubscriptionActive(supabase, polarAccessToken, event.data, event.id);
        break;

      case 'subscription.updated':
        await handleSubscriptionUpdated(supabase, polarAccessToken, event.data, event.id);
        break;

      case 'subscription.canceled':
      case 'subscription.revoked':
        await handleSubscriptionCanceled(supabase, polarAccessToken, event.data, event.id);
        break;

      case 'checkout.created':
      case 'checkout.updated':
        console.log('Checkout event:', event.type, event.data?.id);
        break;

      case 'order.created':
        console.log('Order created:', event.data?.id);
        break;

      default:
        console.log('Unhandled event type:', event.type);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Constant-time string comparison to prevent timing attacks
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function handleSubscriptionActive(supabase: any, polarAccessToken: string, subscription: any, webhookId: string) {
  console.log('Activating subscription:', subscription.id);

  // === SECONDARY VERIFICATION (non-fatal): Verify subscription with Polar API ===
  try {
    const polarVerifyResponse = await fetch(
      `https://api.polar.sh/v1/subscriptions/${subscription.id}`,
      {
        headers: { 'Authorization': `Bearer ${polarAccessToken}` }
      }
    );

    if (!polarVerifyResponse.ok) {
      const errText = await polarVerifyResponse.text();
      console.warn('Polar API verification failed:', polarVerifyResponse.status, errText);
    } else {
      const verifiedSubscription = await polarVerifyResponse.json();
      console.log('✅ Subscription verified with Polar API:', verifiedSubscription.id);
    }
  } catch (error) {
    console.warn('Secondary verification skipped due to error:', error);
  }

  const email = subscription.customer?.email;
  if (!email) {
    console.error('No email in subscription data:', subscription);
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (profileError) {
    console.error('Error fetching profile:', profileError);
    return;
  }

  if (!profile) {
    console.error('User profile not found for email:', email);
    return;
  }

  const productId = subscription.product?.id || subscription.product_id || '';
  let plan = 'free';
  let videosRemaining = 5;
  let maxFileSizeMb = 100;

  if (productId === '0dfb8146-7505-4dc9-b7ce-a669919533b2') {
    plan = 'pro';
    videosRemaining = 100;
    maxFileSizeMb = 500;
  } else if (productId === '240aaa37-f58b-4f9c-93ae-e0df52f0644c') {
    plan = 'unlimited';
    videosRemaining = 500;
    maxFileSizeMb = 1000;
  } else if (productId === '95d38e1c-8f47-4048-b3e3-f06edc38b8d9') {
    plan = 'starter';
    videosRemaining = 25;
    maxFileSizeMb = 250;
  }

  console.log(`Setting plan to ${plan} with ${videosRemaining} videos and ${maxFileSizeMb}MB limit for user ${profile.id}`);

  // Use secure database function with replay protection and validation
  const { data, error } = await supabase.rpc('update_subscription_from_webhook', {
    p_user_id: profile.id,
    p_plan: plan,
    p_videos_remaining: videosRemaining,
    p_max_file_size_mb: maxFileSizeMb,
    p_product_id: productId,
    p_subscription_id: subscription.id,
    p_webhook_id: webhookId,
    p_event_type: 'subscription.active'
  });

  if (error) {
    console.error('RPC Error updating subscription:', error);
    throw new Error(`Failed to update subscription: ${error.message}`);
  } else if (data && !data.success) {
    console.error('Subscription update failed:', data);
    throw new Error(`Subscription update returned failure: ${data.error || data.reason}`);
  } else {
    console.log(`✅ Subscription activated: user=${profile.id}, plan=${plan}, videos=${videosRemaining}, webhook=${webhookId}`, data);
  }
}

async function handleSubscriptionUpdated(supabase: any, polarAccessToken: string, subscription: any, webhookId: string) {
  console.log('Updating subscription:', subscription.id);
  await handleSubscriptionActive(supabase, polarAccessToken, subscription, webhookId);
}

async function handleSubscriptionCanceled(supabase: any, polarAccessToken: string, subscription: any, webhookId: string) {
  console.log('Canceling subscription:', subscription.id);

  // === SECONDARY VERIFICATION (non-fatal): Verify cancellation with Polar API ===
  try {
    const polarVerifyResponse = await fetch(
      `https://api.polar.sh/v1/subscriptions/${subscription.id}`,
      {
        headers: { 'Authorization': `Bearer ${polarAccessToken}` }
      }
    );

    if (!polarVerifyResponse.ok) {
      const errText = await polarVerifyResponse.text();
      console.warn('Polar API cancellation verification failed:', polarVerifyResponse.status, errText);
    } else {
      const verifiedSubscription = await polarVerifyResponse.json();
      console.log('✅ Subscription cancellation verified with Polar API:', verifiedSubscription.id);
    }
  } catch (error) {
    console.warn('Secondary cancellation verification skipped due to error:', error);
  }

  const email = subscription.customer?.email;
  if (!email) {
    console.error('No email in subscription data');
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (profileError) {
    console.error('Error fetching profile:', profileError);
    return;
  }

  if (!profile) {
    console.error('User profile not found for email:', email);
    return;
  }

  // Use secure database function with replay protection and validation
  const { data, error } = await supabase.rpc('update_subscription_from_webhook', {
    p_user_id: profile.id,
    p_plan: 'free',
    p_videos_remaining: 5,
    p_max_file_size_mb: 100,
    p_product_id: '',
    p_subscription_id: subscription.id,
    p_webhook_id: webhookId,
    p_event_type: 'subscription.canceled'
  });

  if (error) {
    console.error('RPC Error downgrading subscription:', error);
    throw new Error(`Failed to downgrade subscription: ${error.message}`);
  } else if (data && !data.success) {
    console.error('Subscription downgrade failed:', data);
    throw new Error(`Subscription downgrade returned failure: ${data.error || data.reason}`);
  } else {
    console.log(`✅ Subscription canceled: user=${profile.id}, downgraded to free plan, webhook=${webhookId}`, data);
  }
}
