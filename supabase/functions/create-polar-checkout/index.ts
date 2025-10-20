import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const accessToken = Deno.env.get('POLAR_ACCESS_TOKEN')!;
    const server = Deno.env.get('POLAR_ENVIRONMENT') ?? 'sandbox';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('authorization')?.replace('Bearer ', '') ?? undefined;
    const { data: userData } = authHeader ? await supabase.auth.getUser(authHeader) : { data: { user: null } } as any;
    const user = userData?.user;

    // Validate input schema
    const CheckoutSchema = z.object({
      productId: z.string().uuid({ message: 'Invalid productId format' }),
      redirectOrigin: z.string().url().optional()
    });

    let body;
    try {
      body = CheckoutSchema.parse(await req.json());
    } catch (validationError) {
      console.log('Invalid checkout request');
      return new Response(
        JSON.stringify({ error: 'Invalid request format' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { productId, redirectOrigin } = body;

    // Allow only known product IDs for safety
    const allowed = new Set([
      '0dfb8146-7505-4dc9-b7ce-a669919533b2', // Pro
      '240aaa37-f58b-4f9c-93ae-e0df52f0644c', // Unlimited
      '95d38e1c-8f47-4048-b3e3-f06edc38b8d9', // Starter
    ]);
    if (!allowed.has(productId)) {
      return new Response(JSON.stringify({ error: 'Invalid productId' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Derive the app origin from client or headers to avoid using the functions domain
    const url = new URL(req.url);
    const headerOrigin = req.headers.get('origin') || undefined;
    const headerReferer = req.headers.get('referer') || undefined;

    const getOrigin = (val?: string) => {
      try {
        if (!val) return undefined;
        const u = new URL(val);
        return `${u.protocol}//${u.host}`;
      } catch (_) {
        return undefined;
      }
    };

    let appOrigin = getOrigin(redirectOrigin) || getOrigin(headerOrigin) || getOrigin(headerReferer);
    if (!appOrigin) {
      const envSite = Deno.env.get('SITE_URL') || Deno.env.get('PUBLIC_SITE_URL');
      appOrigin = getOrigin(envSite) || `${url.protocol}//${url.host}`; // last resort
    }

    const base = (server === 'production') 
      ? 'https://api.polar.sh/v1'
      : 'https://sandbox-api.polar.sh/v1';

    const bodyPayload: Record<string, unknown> = {
      products: [productId],
      success_url: `${appOrigin}/pricing?status=success&checkout_id={CHECKOUT_ID}`,
      cancel_url: `${appOrigin}/pricing?status=cancelled`,
    };
    if (user?.id) bodyPayload["external_customer_id"] = user.id;
    if (user?.email) bodyPayload["customer_email"] = user.email;

    const resp = await fetch(`${base}/checkouts/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyPayload),
    });

    if (!resp.ok) {
      console.log('Checkout creation failed with status:', resp.status);
      return new Response(JSON.stringify({ error: 'Failed to create checkout session' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const checkout = await resp.json();

    return new Response(JSON.stringify({ url: checkout.url, id: checkout.id }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.log('Checkout request processing failed');
    return new Response(JSON.stringify({ error: 'An unexpected error occurred' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});