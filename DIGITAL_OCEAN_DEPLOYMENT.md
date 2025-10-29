# Digital Ocean App Platform Deployment Guide

This guide will help you deploy your Video Download API to Digital Ocean App Platform.

## ⚠️ Important: Development vs Production

Your app works differently in development (Replit) vs production (Digital Ocean):

- **Replit**: Runs 2 servers (backend on 4000, frontend on 5000)
- **Digital Ocean**: Runs 1 server (everything on 8080)

See `DEPLOYMENT_NOTE.md` for details.

## Quick Fix for Your Current Deployment

Your deployment is failing because of configuration issues. Here's how to fix it:

### 1. Update Environment Variables in Digital Ocean

Go to your Digital Ocean App Platform dashboard and add these environment variables:

```
PORT=8080
HOST=0.0.0.0
NODE_ENV=production
```

### 2. Update App Spec Settings

In your Digital Ocean app settings, make sure you have:

**Build Command:**
```bash
apt-get update && apt-get install -y python3 python3-pip ffmpeg
python3 -m pip install --upgrade pip
python3 -m pip install yt-dlp
npm install
npm run build
```

**Run Command:**
```bash
npm start
```

**HTTP Port:** `8080`

> **Note:** The build command installs Python, pip, ffmpeg, and yt-dlp which are required for video downloading to work.

### 3. Important: The 503 Error Issue

The 503 error you're seeing happens because:

1. **Port mismatch**: Digital Ocean expects port 8080, not 4000
2. **Build not run**: The React frontend wasn't built, so only the API exists
3. **100-second timeout**: Digital Ocean has a hard 100-second limit on requests

For video downloads that might take longer than 100 seconds, you have two options:

**Option A: Quick Downloads Only**
- Only allow videos under ~100MB
- These should complete within the timeout

**Option B: Async Processing (Recommended for Production)**
- Use the existing WebSocket/polling system
- Downloads start immediately and stream to the user
- For very long downloads, consider using Digital Ocean Spaces to store files temporarily

## Understanding the New Setup

### How It Works Now

1. **Single Process**: One Express server handles everything
2. **Port 8080**: Digital Ocean requirement (changed from 4000)
3. **Static Frontend**: Your React app is built and served from `/dist`
4. **API Routes**: All `/v1/*` routes still work as before
5. **Website**: When you visit the root URL, you get your React app

### What Changed

**Before (Not Working on Digital Ocean):**
```
start.sh → Runs two processes:
  ├─ Backend on port 4000
  └─ Frontend on port 5000 (only worked locally)
```

**After (Works on Digital Ocean):**
```
npm start → Single process on port 8080:
  ├─ Serves React app (built files)
  └─ Handles API requests at /v1/*
  └─ WebSocket support included
```

## Testing Locally Before Deploying

To test the production setup locally:

```bash
# 1. Build the React frontend
npm run build

# 2. Start the server (will serve both frontend and API)
PORT=8080 npm start

# 3. Visit http://localhost:8080
# You should see your React app, not JSON!

# 4. Test the API
curl -X POST 'http://localhost:8080/v1/video/details' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://youtu.be/VIDEO_ID"}'
```

## After Updating Code

1. **Push to GitHub**: Your code changes need to be in your repository
   ```bash
   git add .
   git commit -m "Fix Digital Ocean deployment"
   git push
   ```

2. **Redeploy in Digital Ocean**: 
   - Go to your app in Digital Ocean dashboard
   - Click "Actions" → "Force Rebuild and Deploy"
   - Wait for the build to complete

3. **Visit Your URL**: You should now see your React website instead of JSON!

## Checking If It Works

### Health Check
```bash
curl https://your-app-url.ondigitalocean.app/health
# Should return: OK
```

### API Test
```bash
curl -X POST 'https://your-app-url.ondigitalocean.app/v1/video/details' \
  -H 'Authorization: Bearer vpa_MXL1jGEp7s44l6Fcym_5ovy4dwC8IJnw' \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://youtu.be/L0OfvNL05gM"}'
```

### Website
Open `https://your-app-url.ondigitalocean.app` in your browser - you should see your React interface!

## Common Issues

### Still seeing JSON at the root URL?
- Make sure you ran `npm run build` in the build command
- Check that the `dist` folder exists in your deployment
- Verify the app redeployed after your code changes

### API still returning 503 errors?
- Check the PORT environment variable is set to 8080
- Verify the app is listening on 0.0.0.0, not 127.0.0.1
- Check Digital Ocean logs for specific errors

### Downloads timing out?
- Digital Ocean has a 100-second hard limit
- Use WebSocket for progress tracking (already built in)
- Consider smaller video files or implement async processing

## Production Considerations

### Database
- Your app uses SQLite which stores data in a file
- Digital Ocean App Platform may reset this file on redeployment
- For production, consider migrating to PostgreSQL (Digital Ocean managed database)

### File Storage
- Downloaded files are temporary
- Consider using Digital Ocean Spaces for permanent storage
- Current setup streams directly to users (no server storage)

### Scaling
- Start with Basic tier ($5/month)
- Monitor CPU/memory usage in DO dashboard
- Scale up if you see performance issues

### Security
- Your API keys are stored in the database
- Add rate limiting (already built in)
- Consider adding authentication for the web interface

## Need Help?

Check these in order:

1. **Digital Ocean Logs**: App Platform dashboard → Runtime Logs
2. **Health Endpoint**: `https://your-app.ondigitalocean.app/health`
3. **API Info**: `https://your-app.ondigitalocean.app/api`

## What's Next?

Once your deployment is working:

1. Set up a custom domain (optional)
2. Configure automatic deployments from GitHub
3. Set up monitoring and alerts
4. Consider database migration to PostgreSQL for production use
