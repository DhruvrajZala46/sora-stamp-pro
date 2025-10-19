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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('authorization')?.replace('Bearer ', '') ?? undefined;
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const { data: { user }, error: userErr } = await supabase.auth.getUser(authHeader);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Fetch current subscription
    const { data: currentSub, error: fetchError } = await supabase
      .from('user_subscriptions')
      .select('plan, videos_remaining')
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching subscription:', fetchError);
      return new Response(JSON.stringify({ ok: false, error: fetchError.message }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // If no subscription exists, create one with free plan
    if (!currentSub) {
      const { error: insertError } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: user.id,
          plan: 'free',
          videos_remaining: 5,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error('Error creating subscription:', insertError);
        return new Response(JSON.stringify({ ok: false, error: insertError.message }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      console.log('Created free subscription for user:', user.id);
      return new Response(JSON.stringify({ ok: true, created: true }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // If user is on free plan and has less than 5 videos, normalize to 5
    if (currentSub.plan === 'free' && currentSub.videos_remaining < 5) {
      const { error: updateError } = await supabase
        .from('user_subscriptions')
        .update({ 
          videos_remaining: 5, 
          updated_at: new Date().toISOString() 
        })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Error normalizing subscription:', updateError);
        return new Response(JSON.stringify({ ok: false, error: updateError.message }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      console.log('Normalized free plan videos for user:', user.id);
      return new Response(JSON.stringify({ ok: true, normalized: true }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    return new Response(JSON.stringify({ ok: true, unchanged: true }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  } catch (e: any) {
    console.error('sync-subscription exception:', e);
    return new Response(JSON.stringify({ error: e?.message ?? 'Internal error' }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});