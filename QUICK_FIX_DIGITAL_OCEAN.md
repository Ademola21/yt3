# 🔧 Quick Fix: Install yt-dlp on Digital Ocean

## The Problem
Your app is failing because **yt-dlp is not installed** on Digital Ocean. You're seeing this error:
```
Error: spawn yt-dlp ENOENT
```

## The Solution
You need to update your build command in Digital Ocean to install Python and yt-dlp.

---

## 📝 Step-by-Step Fix

### Option 1: Use the App Spec File (Recommended)

1. **Push the updated code to GitHub:**
   ```bash
   git add .
   git commit -m "Add yt-dlp installation for Digital Ocean"
   git push
   ```

2. **In Digital Ocean Dashboard:**
   - Go to your app → Settings
   - Click "Edit" next to "App Spec"
   - Replace the entire spec with the contents of `.do/app.yaml` from your project
   - Click "Save"

3. **Redeploy:**
   - Click "Actions" → "Force Rebuild and Deploy"
   - Wait 3-5 minutes for the build

---

### Option 2: Update Build Command Manually

If you prefer to update manually without using the app spec:

1. **Go to Digital Ocean Dashboard**
2. **Click your app → Settings → Components → api**
3. **Edit Build Command** and replace it with:

```bash
apt-get update && apt-get install -y python3 python3-pip ffmpeg
python3 -m pip install --upgrade pip
python3 -m pip install yt-dlp
npm install
npm run build
```

4. **Keep Run Command as:**
```bash
npm start
```

5. **Save and redeploy**

---

## ✅ What This Installs

The build command now installs:
- **Python 3** - Required to run yt-dlp
- **pip** - Python package manager
- **ffmpeg** - Video processing (needed for merging video/audio)
- **yt-dlp** - The actual video downloader

---

## 🧪 How to Test After Deployment

Once deployed, test your API:

```bash
curl -X POST 'https://ytprojectapi-3lgx6.ondigitalocean.app/v1/video/details' \
  -H 'Authorization: Bearer vpa_MXL1jGEp7s44l6Fcym_5ovy4dwC8IJnw' \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://youtu.be/wKDNQeFEzRY"}'
```

You should get video details (not an error)!

---

## ⚠️ Notes

- **Build time will increase** to about 2-3 minutes (instead of 1 minute) because it needs to install these packages
- **This only happens during build**, not every time the app starts
- **These packages persist** across app restarts but are reinstalled on each deployment

---

## 🆘 If It Still Fails

Check the Digital Ocean build logs:
1. Go to your app in Digital Ocean
2. Click "Runtime Logs" tab
3. Look for errors during the build phase
4. Make sure all packages installed successfully

Common issues:
- **Insufficient permissions:** The build command needs sudo access (Digital Ocean provides this)
- **Network timeout:** Try redeploying if the build times out
- **Out of memory:** Upgrade to a larger instance size if needed
