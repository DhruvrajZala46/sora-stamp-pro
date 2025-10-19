import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Polar } from "npm:@polar-sh/sdk";

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

    const body = await req.json().catch(() => ({}));
    const productId: string | undefined = body.productId;

    if (!productId) {
      return new Response(JSON.stringify({ error: 'Missing productId' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Allow only known product IDs for safety
    const allowed = new Set([
      '0dfb8146-7505-4dc9-b7ce-a669919533b2', // Pro
      '240aaa37-f58b-4f9c-93ae-e0df52f0644c', // Unlimited
    ]);
    if (!allowed.has(productId)) {
      return new Response(JSON.stringify({ error: 'Invalid productId' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const url = new URL(req.url);
    const origin = `${url.protocol}//${url.host}`;

    const polar = new Polar({ accessToken, server: server as any });

    const checkout = await polar.checkouts.create({
      products: [productId],
      successUrl: `${origin}/pricing?status=success&checkout_id={CHECKOUT_ID}`,
      // Attach metadata to reconcile in webhooks
      metadata: {
        external_user_id: user?.id ?? null,
      },
      customerEmail: user?.email ?? undefined,
    } as any);

    return new Response(JSON.stringify({ url: checkout.url, id: checkout.id }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('create-polar-checkout error:', e);
    return new Response(JSON.stringify({ error: e?.message ?? 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});