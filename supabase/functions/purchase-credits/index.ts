import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const requestSchema = z.object({
  packageId: z.string().uuid(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const POLAR_ACCESS_TOKEN = Deno.env.get('POLAR_ACCESS_TOKEN');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!POLAR_ACCESS_TOKEN) {
      throw new Error('POLAR_ACCESS_TOKEN not configured');
    }

    const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { packageId } = requestSchema.parse(body);

    // Get package details
    const { data: packageData, error: packageError } = await supabaseAdmin
      .from('credit_packages')
      .select('*')
      .eq('id', packageId)
      .eq('is_active', true)
      .single();

    if (packageError || !packageData || !packageData.polar_product_id) {
      return new Response(JSON.stringify({ error: 'Invalid package or missing product ID' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const origin = req.headers.get('origin') || req.headers.get('referer') || 
                   Deno.env.get('APP_URL') || `${SUPABASE_URL}`;

    // Determine Polar environment and base URL
    const polarEnv = Deno.env.get('POLAR_ENVIRONMENT') || 'production';
    const polarBaseUrl = polarEnv === 'sandbox' 
      ? 'https://sandbox-api.polar.sh/v1' 
      : 'https://api.polar.sh/v1';
    const polarUrl = `${polarBaseUrl}/checkouts/custom`;

    const checkoutData = {
      product_price_id: packageData.polar_product_id,
      customer_email: user.email,
      success_url: `${origin}/credits?status=success`,
      metadata: {
        user_id: user.id,
        package_id: packageId,
        credits: packageData.credits.toString(),
      },
    };

    console.log('Creating Polar checkout for credits:', checkoutData);

    const polarResponse = await fetch(polarUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${POLAR_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(checkoutData),
    });

    if (!polarResponse.ok) {
      const errorText = await polarResponse.text();
      console.error('Polar API error:', polarResponse.status, errorText);
      throw new Error(`Polar API error: ${errorText}`);
    }

    const checkout = await polarResponse.json();

    return new Response(JSON.stringify({ 
      checkoutUrl: checkout.url,
      checkoutId: checkout.id 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in purchase-credits function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});