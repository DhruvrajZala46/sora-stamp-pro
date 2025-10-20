import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Verify authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate input
    const ValidationSchema = z.object({
      fileSize: z.number().positive().max(1024 * 1024 * 500), // Max 500MB (highest plan limit)
      fileType: z.string().regex(/^video\//)
    });

    let body;
    try {
      body = ValidationSchema.parse(await req.json());
    } catch (validationError) {
      return new Response(
        JSON.stringify({ error: 'Invalid request format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { fileSize, fileType } = body;

    // Get user subscription details with service role for reliable reads
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: subscription, error: subError } = await supabaseAdmin
      .from('user_subscriptions')
      .select('videos_remaining, max_file_size_mb, plan')
      .eq('user_id', user.id)
      .single();

    if (subError || !subscription) {
      console.log('Subscription lookup failed');
      return new Response(
        JSON.stringify({ error: 'Subscription not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Server-side quota validation
    if (subscription.videos_remaining <= 0) {
      return new Response(
        JSON.stringify({ 
          allowed: false, 
          reason: 'quota_exceeded',
          plan: subscription.plan 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Server-side file size validation
    const maxSizeBytes = subscription.max_file_size_mb * 1024 * 1024;
    if (fileSize > maxSizeBytes) {
      return new Response(
        JSON.stringify({ 
          allowed: false, 
          reason: 'file_too_large',
          maxSizeMb: subscription.max_file_size_mb,
          plan: subscription.plan
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // All validations passed
    return new Response(
      JSON.stringify({ 
        allowed: true,
        maxSizeMb: subscription.max_file_size_mb,
        videosRemaining: subscription.videos_remaining,
        plan: subscription.plan
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.log('Upload validation failed');
    return new Response(
      JSON.stringify({ error: 'Validation failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
