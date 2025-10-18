import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-worker-secret',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify shared secret
    const workerSecret = req.headers.get('x-worker-secret');
    const expectedSecret = Deno.env.get('WORKER_SHARED_SECRET');
    
    if (!workerSecret || workerSecret !== expectedSecret) {
      console.error('Invalid or missing worker secret');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { video_id, status, processed_path, error_text } = await req.json();

    if (!video_id || !status) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update video status
    const updateData: any = {
      status,
      processing_finished_at: new Date().toISOString()
    };

    if (processed_path) {
      updateData.processed_path = processed_path;
    }

    if (error_text) {
      updateData.error_text = error_text;
    }

    const { error: updateError } = await supabase
      .from('videos')
      .update(updateData)
      .eq('id', video_id);

    if (updateError) {
      console.error('Database update error:', updateError);
      throw new Error('Failed to update video status');
    }

    console.log(`Video ${video_id} status updated to ${status}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Callback error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
