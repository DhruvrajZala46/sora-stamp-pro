import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    const payload = await req.json();
    console.log('Credits webhook received:', JSON.stringify(payload, null, 2));

    const eventType = payload.type || payload.event_type;

    if (eventType === 'checkout.updated' && payload.data?.status === 'succeeded') {
      const metadata = payload.data.metadata;
      const userId = metadata?.user_id;
      const credits = parseInt(metadata?.credits || '0');

      if (!userId || !credits) {
        console.error('Missing user_id or credits in webhook metadata');
        return new Response(JSON.stringify({ error: 'Invalid metadata' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Adding ${credits} credits to user ${userId}`);

      // Add credits using the database function
      const { data, error } = await supabaseAdmin.rpc('add_credits', {
        p_user_id: userId,
        p_credits: credits,
        p_description: `Purchased ${credits} credits`
      });

      if (error) {
        console.error('Failed to add credits:', error);
        throw error;
      }

      console.log('Credits added successfully:', data);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in credits-webhook function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});