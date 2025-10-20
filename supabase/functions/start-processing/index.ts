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

    if (!video_id) {
      return new Response(
        JSON.stringify({ error: 'Missing video_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get video details
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('storage_path, user_id')
      .eq('id', video_id)
      .single();

    if (videoError || !video) {
      console.error('Video not found:', videoError);
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

    // Generate signed URLs for worker (1 hour expiry)
    const { data: downloadData, error: downloadError } = await supabase.storage
      .from('uploads')
      .createSignedUrl(video.storage_path, 3600);

    if (downloadError || !downloadData) {
      console.error('Failed to create download URL:', downloadError);
      throw new Error('Failed to create signed URL for download');
    }

    // Generate upload URL for processed bucket
    const processedPath = `${video.user_id}/${video_id}_processed.mp4`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('processed')
      .createSignedUploadUrl(processedPath);

    if (uploadError || !uploadData) {
      console.error('Failed to create upload URL:', uploadError);
      throw new Error('Failed to create signed URL for upload');
    }

    // Get callback URL, shared secret, and optional logo URL
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const WORKER_SHARED_SECRET = Deno.env.get('WORKER_SHARED_SECRET');
    const callbackUrl = `${SUPABASE_URL}/functions/v1/processing-callback`;
    const WATERMARK_LOGO_URL = Deno.env.get('WATERMARK_LOGO_URL') || null;

    // Call Cloud Run worker
    const WORKER_URL = Deno.env.get('WORKER_URL');
    if (!WORKER_URL) {
      throw new Error('WORKER_URL not configured');
    }
    
    // Trigger worker asynchronously; don't await completion
    (async () => {
      try {
        const resp = await fetch(`${WORKER_URL}/process-video`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            video_id,
            download_url: downloadData.signedUrl,
            upload_url: uploadData.signedUrl,
            upload_path: processedPath,
            callback_url: callbackUrl,
            callback_secret: WORKER_SHARED_SECRET,
            logo_url: WATERMARK_LOGO_URL || undefined
          })
        });
        if (!resp.ok) {
          const errorText = await resp.text();
          console.error('Worker error:', errorText);
        }
      } catch (e) {
        console.error('Failed to trigger worker:', e);
      }
    })();

    console.log(`Processing started for video ${video_id}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Processing started' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Start processing error:', error);
    
    // Return safe error message to client
    let safeMessage = 'Failed to start processing';
    let statusCode = 500;
    
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        safeMessage = 'Video not found';
        statusCode = 404;
      } else if (error.message.includes('not configured')) {
        safeMessage = 'Service temporarily unavailable';
        statusCode = 503;
      }
    }
    
    return new Response(
      JSON.stringify({ error: safeMessage }),
      { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
