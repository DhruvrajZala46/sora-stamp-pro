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
      .select('plan, videos_remaining, created_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching subscription:', fetchError);
      return new Response(JSON.stringify({ ok: false, error: fetchError.message }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    if (!currentSub) {
      const { data: authUser } = await supabase.auth.admin.getUserById(user.id);
      const userCreatedAt = new Date(authUser?.user?.created_at || 0);
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (userCreatedAt > fiveMinutesAgo) {
        const { error: insertError } = await supabase
          .from('user_subscriptions')
          .insert({
            user_id: user.id,
            plan: 'free',
            videos_remaining: 5,
            max_file_size_mb: 100,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (insertError) {
          if (insertError.code === '23505') {
            return new Response(JSON.stringify({ ok: true, note: 'already_exists' }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          return new Response(JSON.stringify({ ok: false, error: insertError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        return new Response(JSON.stringify({ ok: true, created: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        console.error('⚠️ User has no subscription but is not new:', user.id);
        return new Response(JSON.stringify({ ok: false, error: 'Subscription not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
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