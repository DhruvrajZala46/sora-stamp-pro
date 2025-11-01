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
    const WEBHOOK_SECRET = Deno.env.get('CREDITS_WEBHOOK_SECRET');

    if (!WEBHOOK_SECRET) {
      console.error('CREDITS_WEBHOOK_SECRET not configured');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    // Verify webhook signature
    const signature = req.headers.get('x-webhook-signature');
    if (!signature || signature !== WEBHOOK_SECRET) {
      console.error('Invalid webhook signature');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const payload = await req.json();
    console.log('Credits webhook received:', {
      event_type: payload.type || payload.event_type,
      event_id: payload.id || payload.event_id
    });

    const eventType = payload.type || payload.event_type;
    const webhookId = payload.id || payload.event_id || crypto.randomUUID();

    // Check for duplicate webhook (idempotency)
    const { data: existingEvent } = await supabaseAdmin
      .from('webhook_audit')
      .select('id')
      .eq('webhook_id', webhookId)
      .maybeSingle();

    if (existingEvent) {
      console.log('Webhook already processed, skipping:', webhookId);
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Log webhook attempt
    const payloadString = JSON.stringify(payload);
    const payloadHash = payloadString.substring(0, 100); // Simple hash for audit
    
    await supabaseAdmin.from('webhook_audit').insert({
      webhook_id: webhookId,
      event_type: eventType,
      payload_hash: payloadHash,
      processed_at: new Date().toISOString(),
    });

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

      console.log('Adding credits:', { credits, user_id_hash: userId.substring(0, 8) });

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