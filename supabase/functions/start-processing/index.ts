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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Validate input schema
    const RequestSchema = z.object({
      video_id: z.string().uuid({ message: 'Invalid video_id format' })
    });

    let body;
    try {
      body = RequestSchema.parse(await req.json());
    } catch (validationError) {
      console.log('Invalid request format');
      return new Response(
        JSON.stringify({ error: 'Invalid request format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { video_id } = body;

    // Verify user authentication and ownership
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
      console.log('Authentication failed');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get video details and verify ownership
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('storage_path, user_id')
      .eq('id', video_id)
      .single();

    if (videoError || !video) {
      console.log('Video lookup failed');
      return new Response(
        JSON.stringify({ error: 'Video not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Verify user owns this video
    if (video.user_id !== user.id) {
      console.log('Ownership verification failed');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get service cost for watermark addition
    const { data: serviceData, error: serviceError } = await supabase
      .from('service_pricing')
      .select('credits_cost')
      .eq('service_type', 'watermark_add')
      .single();

    if (serviceError || !serviceData) {
      console.log('Service pricing lookup failed');
      throw new Error('Failed to get service pricing');
    }

    const creditsCost = serviceData.credits_cost;

    // Deduct credits using the database function
    const { data: deductResult, error: deductError } = await supabase
      .rpc('deduct_credits', {
        p_user_id: user.id,
        p_credits: creditsCost,
        p_description: `Watermark addition for ${video_id}`
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
      console.log('Download URL generation failed');
      throw new Error('Failed to create signed URL for download');
    }

    // Generate upload URL for processed bucket
    const processedPath = `${video.user_id}/${video_id}_processed.mp4`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('processed')
      .createSignedUploadUrl(processedPath);

    if (uploadError || !uploadData) {
      console.log('Upload URL generation failed');
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
          console.log('Worker processing initiation failed');
        }
      } catch (e) {
        console.log('Worker trigger failed');
      }
    })();

    console.log(`Processing started for video ${video_id}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Processing started' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.log('Processing request failed');
    
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
