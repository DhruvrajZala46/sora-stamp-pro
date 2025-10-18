import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { video_id } = await req.json();

    // Get video details
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('storage_path')
      .eq('id', video_id)
      .single();

    if (videoError || !video) {
      throw new Error('Video not found');
    }

    // Update video status to processing
    await supabase
      .from('videos')
      .update({ 
        status: 'processing',
        processing_started_at: new Date().toISOString()
      })
      .eq('id', video_id);

    // Call Cloud Run worker to process video
    // REPLACE THIS URL with your actual Cloud Run service URL after deployment
    const WORKER_URL = Deno.env.get('WORKER_URL') || 'YOUR_CLOUD_RUN_URL_HERE';
    
    const workerResponse = await fetch(`${WORKER_URL}/process-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        video_id: video_id,
        storage_path: video.storage_path
      })
    });

    if (!workerResponse.ok) {
      const errorText = await workerResponse.text();
      console.error('Worker error:', errorText);
      throw new Error(`Worker failed: ${errorText}`);
    }

    console.log(`Processing started for video ${video_id}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Processing started' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
