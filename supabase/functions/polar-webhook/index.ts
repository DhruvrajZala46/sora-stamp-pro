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

    if (!webhookSecret) {
      console.error('POLAR_WEBHOOK_SECRET not configured');
      return new Response(JSON.stringify({ error: 'Server misconfiguration' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the raw payload for signature verification
    const payload = await req.text();
    console.log('Webhook received, payload length:', payload.length);

    // === ROBUST WEBHOOK SIGNATURE VERIFICATION ===
    const getHeader = (name: string) => req.headers.get(name) || undefined;
    
    // Try multiple common header names
    const signatureHeader = getHeader('webhook-signature') || 
                           getHeader('polar-signature') || 
                           getHeader('x-polar-signature') || 
                           getHeader('signature') || '';
    
    const timestampHeader = getHeader('webhook-timestamp') || 
                           getHeader('polar-timestamp') || 
                           getHeader('x-polar-timestamp') || '';

    if (!signatureHeader) {
      console.error('Missing webhook signature header');
      return new Response(JSON.stringify({ error: 'Missing signature' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Parse signature header (format: "v1,<signature>" or "t=<timestamp>,v1=<signature>")
    let timestamp = timestampHeader;
    let signature = '';

    const parts = signatureHeader.split(',').map(p => p.trim());
    for (const part of parts) {
      if (part.startsWith('t=')) {
        timestamp = timestamp || part.substring(2);
      } else if (part.startsWith('v1=')) {
        signature = part.substring(3);
      } else if (part.startsWith('v1,')) {
        signature = part.substring(3);
      } else if (!signature && part && !part.includes('=')) {
        signature = part;
      }
    }

    if (!signature) {
      console.error('Could not extract signature from header:', signatureHeader);
      return new Response(JSON.stringify({ error: 'Invalid signature format' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Prepare the secret key (handle both raw and base64-encoded secrets)
    const enc = new TextEncoder();
    
    let keyBytes: Uint8Array;
    if (webhookSecret.startsWith('whsec_')) {
      try {
        const base64Secret = webhookSecret.substring(6);
        const binaryString = atob(base64Secret);
        const arr = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          arr[i] = binaryString.charCodeAt(i);
        }
        keyBytes = arr;
        console.log('Using base64-decoded webhook secret');
      } catch (e) {
        console.error('Failed to decode base64 secret, using raw');
        keyBytes = enc.encode(webhookSecret);
      }
    } else {
      keyBytes = enc.encode(webhookSecret);
      console.log('Using raw webhook secret');
    }

    // Import the HMAC key - @ts-ignore to bypass type check
    // @ts-ignore
    const key = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: { name: 'SHA-256' } },
      false,
      ['sign']
    );

    // Create signed messages (both with and without timestamp)
    const toVerify: string[] = [];
    if (timestamp) {
      toVerify.push(`${timestamp}.${payload}`);
    }
    toVerify.push(payload);

    // Compute HMAC and compare
    const toBase64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
    
    let isValid = false;
    for (const msg of toVerify) {
      const computed = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
      const computedBase64 = toBase64(computed);
      
      if (constantTimeEqual(signature, computedBase64)) {
        isValid = true;
        console.log('Webhook signature verified successfully');
        break;
      }
    }

    if (!isValid) {
      console.error('Invalid webhook signature. Expected signatures do not match.');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Parse and process the webhook event
    const event = JSON.parse(payload);
    console.log('Processing webhook event:', event.type);

    // Handle different event types
    switch (event.type) {
      case 'subscription.created':
      case 'subscription.active':
      case 'subscription.uncanceled':
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

async function handleSubscriptionActive(supabase: any, subscription: any) {
  console.log('Activating subscription:', subscription.id);

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

  if (productId === '0dfb8146-7505-4dc9-b7ce-a669919533b2') {
    plan = 'pro';
    videosRemaining = 100;
  } else if (productId === '240aaa37-f58b-4f9c-93ae-e0df52f0644c') {
    plan = 'unlimited';
    videosRemaining = 500;
  }

  console.log(`Setting plan to ${plan} with ${videosRemaining} videos for user ${profile.id}`);

  const { error } = await supabase
    .from('user_subscriptions')
    .upsert({
      user_id: profile.id,
      plan,
      videos_remaining: videosRemaining,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id',
      ignoreDuplicates: false
    });

  if (error) {
    console.error('Error upserting subscription:', error);
  } else {
    console.log(`✅ Subscription activated: user=${profile.id}, plan=${plan}, videos=${videosRemaining}`);
  }
}

async function handleSubscriptionUpdated(supabase: any, subscription: any) {
  console.log('Updating subscription:', subscription.id);
  await handleSubscriptionActive(supabase, subscription);
}

async function handleSubscriptionCanceled(supabase: any, subscription: any) {
  console.log('Canceling subscription:', subscription.id);

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

  const { error } = await supabase
    .from('user_subscriptions')
    .upsert({
      user_id: profile.id,
      plan: 'free',
      videos_remaining: 5,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id',
      ignoreDuplicates: false
    });

  if (error) {
    console.error('Error downgrading subscription:', error);
  } else {
    console.log(`✅ Subscription canceled: user=${profile.id}, downgraded to free plan`);
  }
}
