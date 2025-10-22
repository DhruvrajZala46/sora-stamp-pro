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

    console.log('Processing webhook event:', event.type);
    const webhookId = event.id ?? crypto.randomUUID();
    console.log('Webhook ID:', webhookId);

    // Handle different event types
    switch (event.type) {
      case 'subscription.created':
      case 'subscription.active':
      case 'subscription.uncanceled':
        await handleSubscriptionActive(supabase, polarAccessToken, event.data, webhookId);
        break;

      case 'subscription.updated':
        await handleSubscriptionUpdated(supabase, polarAccessToken, event.data, webhookId);
        break;

      case 'subscription.canceled':
      case 'subscription.revoked':
        await handleSubscriptionCanceled(supabase, polarAccessToken, event.data, webhookId);
        break;

      case 'checkout.created':
      case 'checkout.updated':
        console.log('Checkout event:', event.type, event.data?.id, 'webhookId:', webhookId);
        break;

      case 'order.created':
        console.log('Order created:', event.data?.id, 'webhookId:', webhookId);
        break;

      default:
        console.log('Unhandled event type:', event.type, 'webhookId:', webhookId);
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

  if (productId === 'bfd8ca13-0f7e-4eea-a6fb-57cdb2fadda8') {
    plan = 'pro';
    videosRemaining = 100;
    maxFileSizeMb = 300;
  } else if (productId === '2725157f-517b-4afc-85b2-54134f0b97bd') {
    plan = 'unlimited';
    videosRemaining = 500;
    maxFileSizeMb = 500;
  }

  console.log(`Setting plan to ${plan} with ${videosRemaining} videos and ${maxFileSizeMb}MB limit for user ${profile.id}`);

  // Write audit record (with replay protection) and upsert subscription without RPC
  // Replay protection
  const { data: existingAudit } = await supabase
    .from('webhook_audit')
    .select('id')
    .eq('webhook_id', webhookId)
    .maybeSingle();

  if (existingAudit) {
    console.warn('Webhook already processed, skipping:', webhookId);
    return;
  }

  const { error: auditErr } = await supabase.from('webhook_audit').insert({
    webhook_id: webhookId,
    event_type: 'subscription.active',
    subscription_id: subscription.id,
    user_id: profile.id,
    plan,
    payload_hash: crypto
      .subtle
      ? ''
      : '' // placeholder; hashing not critical here, RPC handled before
  });
  if (auditErr) {
    console.error('Failed to insert webhook audit:', auditErr);
    throw new Error('Audit insert failed');
  }

  // Upsert subscription (update if exists, otherwise insert)
  const { data: existingSub } = await supabase
    .from('user_subscriptions')
    .select('id')
    .eq('user_id', profile.id)
    .maybeSingle();

  const subPayload = {
    user_id: profile.id,
    plan,
    videos_remaining: videosRemaining,
    max_file_size_mb: maxFileSizeMb,
    updated_at: new Date().toISOString(),
  };

  if (existingSub) {
    const { error: updErr } = await supabase
      .from('user_subscriptions')
      .update(subPayload)
      .eq('user_id', profile.id);
    if (updErr) {
      console.error('Failed to update subscription:', updErr);
      throw new Error(updErr.message);
    }
  } else {
    const { error: insErr } = await supabase
      .from('user_subscriptions')
      .insert({ ...subPayload, created_at: new Date().toISOString() });
    if (insErr) {
      console.error('Failed to insert subscription:', insErr);
      throw new Error(insErr.message);
    }
  }

  console.log(`✅ Subscription activated (direct DB): user=${profile.id}, plan=${plan}, videos=${videosRemaining}, webhook=${webhookId}`);
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

  // Write audit record (with replay protection) and update subscription to free without RPC
  const { data: existingAudit } = await supabase
    .from('webhook_audit')
    .select('id')
    .eq('webhook_id', webhookId)
    .maybeSingle();

  if (existingAudit) {
    console.warn('Webhook already processed, skipping:', webhookId);
    return;
  }

  const { error: auditErr } = await supabase.from('webhook_audit').insert({
    webhook_id: webhookId,
    event_type: 'subscription.canceled',
    subscription_id: subscription.id,
    user_id: profile.id,
    plan: 'free',
    payload_hash: ''
  });
  if (auditErr) {
    console.error('Failed to insert webhook audit (cancel):', auditErr);
    throw new Error('Audit insert failed');
  }

  // Determine safe downgrade payload: never increase free credits if already on free plan
  const { data: existingSub } = await supabase
    .from('user_subscriptions')
    .select('id, plan, videos_remaining')
    .eq('user_id', profile.id)
    .maybeSingle();

  const basePayload = {
    plan: 'free',
    max_file_size_mb: 100,
    updated_at: new Date().toISOString(),
  } as const;

  // If user already on free plan, do NOT touch videos_remaining (prevents unintended resets)
  // If downgrading from paid -> free, initialize free credits to 5
  const subPayload = (existingSub && existingSub.plan === 'free')
    ? { ...basePayload } // keep existing videos_remaining
    : { ...basePayload, videos_remaining: 5 };

  if (existingSub) {
    const { error: updErr } = await supabase
      .from('user_subscriptions')
      .update(subPayload)
      .eq('user_id', profile.id);
    if (updErr) {
      console.error('Failed to downgrade subscription:', updErr);
      throw new Error(updErr.message);
    }
  } else {
    const { error: insErr } = await supabase
      .from('user_subscriptions')
      .insert({ user_id: profile.id, ...subPayload, created_at: new Date().toISOString() });
    if (insErr) {
      console.error('Failed to insert downgraded subscription:', insErr);
      throw new Error(insErr.message);
    }
  }

  console.log(`✅ Subscription canceled (direct DB): user=${profile.id}, downgraded to free plan, webhook=${webhookId}`);
}
