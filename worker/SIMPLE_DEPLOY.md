# SIMPLIFIED DEPLOYMENT - No Supabase Service Key Needed! ✅

## What Changed?
The worker now uses **signed URLs** instead of needing the service_role key, so deployment is much simpler!

## Prerequisites
1. **Google Cloud account** with billing enabled
2. **gcloud CLI installed**
3. **Worker files downloaded** to your computer

---

## Deployment Steps

### 1. Enable Billing on Google Cloud
**IMPORTANT**: You saw this error before:
```
FAILED_PRECONDITION: Billing account for project '927527770925' is not found
```

To fix this:
1. Go to https://console.cloud.google.com/billing
2. Click "Link a billing account" 
3. Add a credit card (Google has a FREE tier, you won't be charged for normal usage)

### 2. Open Terminal and Navigate to Worker Folder
```bash
cd C:\Users\Admin\Desktop\worker
```

### 3. Deploy to Cloud Run (ONE COMMAND!)
```bash
gcloud run deploy sorastamp-worker \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --timeout 300
```

**That's it!** No environment variables needed anymore! 🎉

### 4. Get Your Worker URL
After deployment, copy the URL shown:
```
Service URL: https://sorastamp-worker-xxxxx-uc.a.run.app
```

### 5. Add URL as Secret in Lovable
1. In Lovable, click **Cloud** → **Secrets**
2. Add new secret:
   - Name: `WORKER_URL`
   - Value: `https://sorastamp-worker-xxxxx-uc.a.run.app` (your actual URL)
3. Click **Save**

---

## What's Different?

### Before (Complex):
- Needed service_role key from Supabase ❌
- Security risk if key leaked ❌
- Complex configuration ❌

### Now (Simple):
- Uses temporary signed URLs ✅
- No sensitive keys in worker ✅
- Secure callback system ✅
- Only need WORKER_URL ✅

---

## Testing

After deploying and adding the WORKER_URL secret:

1. Upload a video in your app
2. Check logs:
   ```bash
   gcloud run logs read sorastamp-worker --region us-central1 --limit 50
   ```

---

## Troubleshooting

**Issue**: Still getting billing error
- **Solution**: Enable billing at https://console.cloud.google.com/billing

**Issue**: Deploy command not found
- **Solution**: Make sure you're in the worker directory: `cd C:\Users\Admin\Desktop\worker`

**Issue**: Video stays in "processing" forever
- **Solution**: Make sure you added WORKER_URL secret in Lovable Cloud

---

## Cost Estimate
- **FREE tier**: 2 million requests/month
- For 1000 videos: **$0** ✅
