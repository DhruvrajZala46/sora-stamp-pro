import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get raw body for signature verification
    const payload = await req.text();

    // Validate using Polar SDK (Standard Webhooks)
    let event: any;
    try {
      event = validateEvent(
        payload,
        {
          'webhook-id': req.headers.get('webhook-id') ?? '',
          'webhook-signature': req.headers.get('webhook-signature') ?? '',
          'webhook-timestamp': req.headers.get('webhook-timestamp') ?? '',
        },
        webhookSecret,
      );
    } catch (err) {
      if (err instanceof WebhookVerificationError) {
        console.error('Invalid webhook signature');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      throw err;
    }
    
    console.log('Polar webhook received:', event.type);
    
    console.log('Polar webhook received:', event.type);

    // Handle different event types
    switch (event.type) {
      case 'subscription.created':
      case 'subscription.active':
        await handleSubscriptionActive(supabase, event.data);
        break;

      case 'subscription.updated':
        await handleSubscriptionUpdated(supabase, event.data);
        break;

      case 'subscription.canceled':
      case 'subscription.revoked':
        await handleSubscriptionCanceled(supabase, event.data);
        break;

      case 'checkout.created':
        console.log('Checkout created:', event.data);
        break;

      case 'order.created':
        console.log('Order created:', event.data);
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

async function handleSubscriptionActive(supabase: any, subscription: any) {
  console.log('Activating subscription:', subscription);

  // Get user by email from subscription
  const email = subscription.customer?.email;
  if (!email) {
    console.error('No email in subscription data');
    return;
  }

  // Find user by email
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single();

  if (!profile) {
    console.error('User not found for email:', email);
    return;
  }

  // Determine plan and videos based on product ID
  const productId = subscription.product?.id || '';
  let plan = 'free';
  let videosRemaining = 3;

  // Pro tier - $9/month
  if (productId === '0dfb8146-7505-4dc9-b7ce-a669919533b2') {
    plan = 'pro';
    videosRemaining = 100;
  } 
  // Unlimited tier - $29/month (500 videos backend limit)
  else if (productId === '240aaa37-f58b-4f9c-93ae-e0df52f0644c') {
    plan = 'unlimited';
    videosRemaining = 500;
  }

  // Update user subscription
  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      plan,
      videos_remaining: videosRemaining,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', profile.id);

  if (error) {
    console.error('Error updating subscription:', error);
  } else {
    console.log('Subscription activated for user:', profile.id, 'Plan:', plan);
  }
}

async function handleSubscriptionUpdated(supabase: any, subscription: any) {
  console.log('Updating subscription:', subscription);
  await handleSubscriptionActive(supabase, subscription);
}

async function handleSubscriptionCanceled(supabase: any, subscription: any) {
  console.log('Canceling subscription:', subscription);

  const email = subscription.customer?.email;
  if (!email) {
    console.error('No email in subscription data');
    return;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single();

  if (!profile) {
    console.error('User not found for email:', email);
    return;
  }

  // Downgrade to free plan
  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      plan: 'free',
      videos_remaining: 3,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', profile.id);

  if (error) {
    console.error('Error downgrading subscription:', error);
  } else {
    console.log('Subscription canceled for user:', profile.id);
  }
}
