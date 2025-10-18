# FFmpeg Video Watermarking Worker - Deployment Guide

## What is This?

This is a **background worker** that:
1. Receives requests to process videos
2. Downloads video from Supabase storage
3. Adds "Made with Sora AI" watermark using FFmpeg
4. Uploads processed video back to storage
5. Updates database when done

## Prerequisites

1. **Google Cloud Account** (free tier available)
2. **Google Cloud CLI installed** - Download from: https://cloud.google.com/sdk/docs/install
3. Your Supabase project credentials

## Step-by-Step Deployment to Google Cloud Run

### Step 1: Set Up Google Cloud Project

```bash
# Login to Google Cloud
gcloud auth login

# Create new project (or use existing)
gcloud projects create sorastamp-worker --name="SoraStamp Worker"

# Set project
gcloud config set project sorastamp-worker

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### Step 2: Build and Deploy

```bash
# Navigate to worker directory
cd worker

# Build and deploy to Cloud Run (this does everything automatically!)
gcloud run deploy sorastamp-worker \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --timeout 300 \
  --set-env-vars SUPABASE_URL=https://opeadmwkryojfkxhnrix.supabase.co \
  --set-env-vars SUPABASE_SERVICE_KEY=YOUR_SERVICE_KEY_HERE
```

**IMPORTANT**: Replace `YOUR_SERVICE_KEY_HERE` with your actual Supabase service role key.

### Step 3: Get Your Worker URL

After deployment completes, you'll see output like:
```
Service [sorastamp-worker] revision [sorastamp-worker-00001-abc] has been deployed and is serving 100 percent of traffic.
Service URL: https://sorastamp-worker-xxxxx-uc.a.run.app
```

**COPY THIS URL** - you need it to connect your app!

### Step 4: Test the Worker

```bash
# Test health check
curl https://YOUR-WORKER-URL/health

# Should return: {"status":"healthy"}
```

## How It Connects to Your App

1. User uploads video → Saved to Supabase storage
2. Your app calls edge function `start-processing`
3. Edge function calls Cloud Run worker at `/process-video`
4. Worker processes video and updates database
5. Frontend shows processed video when status = 'done'

## Cost Estimate

Google Cloud Run pricing (free tier):
- **2 million requests/month FREE**
- **360,000 GB-seconds/month FREE**
- After free tier: ~$0.00002 per request

For 1000 videos/month: **FREE** ✅

## Monitoring & Logs

View logs in Google Cloud Console:
```bash
# Or view logs in terminal
gcloud run logs read sorastamp-worker --region us-central1 --limit 50
```

## Troubleshooting

### Issue: "Permission denied"
**Solution**: Make sure service is `--allow-unauthenticated`

### Issue: "FFmpeg not found"
**Solution**: Dockerfile already includes FFmpeg installation

### Issue: "Timeout"
**Solution**: Increase timeout with `--timeout 600`

### Issue: "Out of memory"
**Solution**: Increase memory with `--memory 2Gi`

## Environment Variables Needed

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_KEY`: Your Supabase service role key (NOT anon key)

## Security Notes

- Worker requires service role key for storage access
- Keep service role key secret
- Cloud Run service is public but validates requests
- Videos are processed in temporary storage and deleted after

## Next Steps

After deployment:
1. Copy your Cloud Run service URL
2. Update the edge function to call this URL
3. Test by uploading a video in your app
