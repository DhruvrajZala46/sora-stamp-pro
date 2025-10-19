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

    // Get the raw payload
    const payload = await req.text();

    // Robust webhook signature verification (Polar: "t=<timestamp>, v1=<signature>")
    const header = (n: string) => req.headers.get(n) || undefined;
    const rawSignatureHeaders = [
      header('webhook-signature'),
      header('polar-signature'),
      header('x-polar-signature'),
      header('signature'),
    ].filter(Boolean) as string[];

    if (!rawSignatureHeaders.length) {
      return new Response(JSON.stringify({ error: 'Missing signature' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Extract timestamp and v1 signatures from possible formats
    let ts = header('webhook-timestamp') || header('polar-timestamp') || header('x-polar-timestamp') || '';
    const headerSigs = new Set<string>();
    for (const h of rawSignatureHeaders) {
      const parts = h.split(',').map(s => s.trim());
      for (const p of parts) {
        const m = /^([a-z0-9_-]+)=(.+)$/i.exec(p);
        if (m) {
          const k = m[1].toLowerCase();
          const v = m[2];
          if ((k === 't' || k === 'timestamp') && !ts) { ts = v; continue; }
          if (k === 'v1' || k === 'sha256' || k === 'sig' || k === 'signature') { headerSigs.add(v); continue; }
        }
      }
      // Also handle legacy "v1,<sig>" or header containing only the signature
      const legacy = h.replace(/^v1,?\s*/i, '');
      if (legacy && legacy !== h) headerSigs.add(legacy);
      if (!h.includes('=') && h) headerSigs.add(h);
    }

    // Prepare HMAC keys (try base64-decoded secret first, then raw-encoded)
    const enc = new TextEncoder();
    const b64ToBytes = (b64: string): Uint8Array | null => {
      try {
        const bin = atob(b64);
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
      } catch {
        return null;
      }
    };
    const secretBytes = b64ToBytes(webhookSecret) ?? enc.encode(webhookSecret);
    const key = await crypto.subtle.importKey('raw', secretBytes.buffer as ArrayBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);

    const toHex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    const toB64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));

    const macPayload = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
    const candidates = new Set<string>([toHex(macPayload), toB64(macPayload)]);

    if (ts) {
      const macWithTs = await crypto.subtle.sign('HMAC', key, enc.encode(`${ts}.${payload}`));
      candidates.add(toHex(macWithTs));
      candidates.add(toB64(macWithTs));
    }

    const timingSafeEqual = (a: string, b: string) => {
      if (a.length !== b.length) return false;
      let res = 0;
      for (let i = 0; i < a.length; i++) res |= a.charCodeAt(i) ^ b.charCodeAt(i);
      return res === 0;
    };

    const valid = Array.from(headerSigs).some(sig => Array.from(candidates).some(c => timingSafeEqual(sig, c)));

    if (!valid) {
      console.error('Invalid webhook signature');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Parse the webhook event
    const event = JSON.parse(payload);

    console.log('Polar webhook received:', event.type);

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
  let videosRemaining = 5;

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

  // Upsert user subscription to be robust if row is missing
  const { error } = await supabase
    .from('user_subscriptions')
    .upsert([
      {
        user_id: profile.id,
        plan,
        videos_remaining: videosRemaining,
        updated_at: new Date().toISOString(),
      }
    ], { onConflict: 'user_id' });

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
      videos_remaining: 5,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', profile.id);

  if (error) {
    console.error('Error downgrading subscription:', error);
  } else {
    console.log('Subscription canceled for user:', profile.id);
  }
}
