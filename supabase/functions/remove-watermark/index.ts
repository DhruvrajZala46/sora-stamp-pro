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
    const KIE_API_KEY = Deno.env.get('KIE_AI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!KIE_API_KEY) {
      throw new Error('KIE_AI_API_KEY not configured');
    }

    const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    // Get user from auth header
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

    const { videoUrl } = await req.json();

    if (!videoUrl || !videoUrl.startsWith('https://sora.chatgpt.com/')) {
      return new Response(JSON.stringify({ error: 'Invalid Sora video URL. Must be from sora.chatgpt.com' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Starting watermark removal for user:', user.id);

    // Get service cost
    const { data: serviceData, error: serviceError } = await supabaseAdmin
      .from('service_pricing')
      .select('credits_cost')
      .eq('service_type', 'watermark_remove')
      .single();

    if (serviceError || !serviceData) {
      throw new Error('Failed to get service pricing');
    }

    const creditsCost = serviceData.credits_cost;

    // Deduct credits using the database function
    const { data: deductResult, error: deductError } = await supabaseAdmin
      .rpc('deduct_credits', {
        p_user_id: user.id,
        p_credits: creditsCost,
        p_description: `Watermark removal for video`
      });

    if (deductError || !deductResult) {
      console.error('Failed to deduct credits:', deductError);
      return new Response(JSON.stringify({ 
        error: 'Insufficient credits',
        required: creditsCost 
      }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call Kie.ai API
    const kieResponse = await fetch('https://api.kie.ai/v1/sora-watermark-remover', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KIE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        video_url: videoUrl
      }),
    });

    if (!kieResponse.ok) {
      const errorText = await kieResponse.text();
      console.error('Kie.ai API error:', kieResponse.status, errorText);
      
      // Refund credits on API failure
      await supabaseAdmin.rpc('add_credits', {
        p_user_id: user.id,
        p_credits: creditsCost,
        p_description: 'Refund for failed watermark removal'
      });

      throw new Error(`Kie.ai API error: ${errorText}`);
    }

    const result = await kieResponse.json();
    console.log('Watermark removal successful for user:', user.id);

    return new Response(JSON.stringify({ 
      success: true,
      ...result 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in remove-watermark function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});