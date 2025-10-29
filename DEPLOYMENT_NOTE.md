# Important: Local vs Production Setup

## 🏠 Local Development (Replit)

Your app runs with **TWO servers**:
- **Backend API**: `http://localhost:4000` (Express server)
- **Frontend**: `http://localhost:5000` (Vite dev server)

The frontend proxies API requests to the backend automatically.

**Command**: `bash start.sh` (runs both servers)

---

## 🚀 Production (Digital Ocean)

Your app runs with **ONE server**:
- **Everything**: `http://your-app.ondigitalocean.app:8080` (Express serves both)

The Express server:
1. Serves your built React files from `/dist`
2. Handles API requests at `/v1/*`
3. Serves your website at the root URL

**Build Command**: `npm install && npm run build`  
**Run Command**: `PORT=8080 HOST=0.0.0.0 npm start`

---

## 📝 Key Differences

| Feature | Local (Replit) | Production (Digital Ocean) |
|---------|---------------|---------------------------|
| Ports | 4000 + 5000 | 8080 only |
| Servers | 2 separate | 1 combined |
| Frontend | Vite dev server | Built static files |
| Hot Reload | ✅ Yes | ❌ No (build required) |
| ENV PORT | 4000 (default) | 8080 (required) |
| ENV HOST | 0.0.0.0 | 0.0.0.0 |

---

## ⚙️ How It Works

### Local Development Flow
```
Browser → Vite (5000) → Proxies /v1/* → Express (4000)
                      → Serves React files
```

### Production Flow
```
Browser → Express (8080) → Serves React from /dist
                         → Handles /v1/* API routes
```

---

## 🔧 Environment Variables

**For Digital Ocean**, set these in the app dashboard:
```bash
PORT=8080
HOST=0.0.0.0
NODE_ENV=production
```

**For Replit**, these are set automatically or use defaults.

---

## 📦 Deploying to Digital Ocean

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Your changes"
   git push
   ```

2. **Set environment variables** in Digital Ocean dashboard

3. **Configure build settings**:
   - Build Command: `npm install && npm run build`
   - Run Command: `npm start`
   - HTTP Port: `8080`

4. **Redeploy** and your app will use the production setup!

---

## ✅ Testing Production Setup Locally

To test the production setup on Replit:

```bash
# Build the frontend
npm run build

# Run with production port
PORT=8080 npm start

# Visit http://localhost:8080
```

You should see your React website (not just JSON)!
