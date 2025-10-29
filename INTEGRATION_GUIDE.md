
# Integration Guide - Video Download API

## Overview
This API provides powerful video processing capabilities that you can integrate into your website or application. All features are production-ready and can handle thousands of requests.

---

## Table of Contents
1. [Authentication](#authentication)
2. [Feature 1: Video Details Fetcher](#feature-1-video-details-fetcher)
3. [Feature 2: Channel Videos Fetcher](#feature-2-channel-videos-fetcher)
4. [Feature 3: Video Download with Progress Tracking](#feature-3-video-download-with-progress-tracking)
5. [Feature 4: Format Selection](#feature-4-format-selection)
6. [Production Deployment](#production-deployment)

---

## Authentication

### Step 1: Generate an API Key
```javascript
// Call this once to get your API key
const response = await fetch('https://your-replit-domain.repl.co/v1/keys', {
  method: 'POST'
});

const data = await response.json();
const apiKey = data.key; // Store this securely!
// Example: vpa_wur4gOr2tLpua7N65d2MIUzA0Z0X68T3
```

**⚠️ Security**: Store the API key on your backend, NOT in frontend JavaScript. Use environment variables.

---

## Feature 1: Video Details Fetcher

### What it does
Fetches comprehensive metadata for any YouTube video including title, description, duration, upload time, thumbnail URL, and statistics.

### Integration Example

#### Backend (Node.js/Express)
```javascript
// your-backend/routes/video.js
const express = require('express');
const router = express.Router();

const API_KEY = process.env.VIDEO_API_KEY; // Your API key
const API_URL = 'https://your-replit-domain.repl.co';

router.post('/get-video-info', async (req, res) => {
  const { videoUrl } = req.body;
  
  try {
    const response = await fetch(`${API_URL}/v1/video/details`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url: videoUrl })
    });
    
    const videoData = await response.json();
    res.json(videoData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch video details' });
  }
});

module.exports = router;
```

#### Frontend (React)
```jsx
import React, { useState } from 'react';

function VideoDetailsComponent() {
  const [videoUrl, setVideoUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchVideoDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/get-video-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl })
      });
      
      const data = await response.json();
      setVideoInfo(data.video);
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false);
  };

  return (
    <div className="video-details">
      <input
        type="text"
        value={videoUrl}
        onChange={(e) => setVideoUrl(e.target.value)}
        placeholder="Enter YouTube URL"
      />
      <button onClick={fetchVideoDetails} disabled={loading}>
        {loading ? 'Loading...' : 'Get Details'}
      </button>
      
      {videoInfo && (
        <div className="video-card">
          <img src={videoInfo.thumbnail} alt={videoInfo.title} />
          <h3>{videoInfo.title}</h3>
          <p>{videoInfo.description}</p>
          <p>Duration: {videoInfo.duration.formatted}</p>
          <p>Views: {videoInfo.view_count.toLocaleString()}</p>
          <p>Likes: {videoInfo.like_count.toLocaleString()}</p>
          <p>Channel: {videoInfo.channel.name}</p>
        </div>
      )}
    </div>
  );
}

export default VideoDetailsComponent;
```

#### Plain HTML + JavaScript
```html
<!DOCTYPE html>
<html>
<head>
  <title>Video Details</title>
</head>
<body>
  <input id="videoUrl" type="text" placeholder="YouTube URL">
  <button onclick="getVideoInfo()">Get Info</button>
  <div id="result"></div>

  <script>
    async function getVideoInfo() {
      const videoUrl = document.getElementById('videoUrl').value;
      const resultDiv = document.getElementById('result');
      
      const response = await fetch('/api/get-video-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl })
      });
      
      const data = await response.json();
      const video = data.video;
      
      resultDiv.innerHTML = `
        <img src="${video.thumbnail}" style="max-width: 300px">
        <h3>${video.title}</h3>
        <p>Duration: ${video.duration.formatted}</p>
        <p>Channel: ${video.channel.name}</p>
      `;
    }
  </script>
</body>
</html>
```

---

## Feature 2: Channel Videos Fetcher

### What it does
Fetches ALL videos from a YouTube channel that are 50+ minutes long, with full metadata for each video.

### Integration Example

#### Backend (Node.js)
```javascript
// your-backend/routes/channel.js
const express = require('express');
const router = express.Router();

const API_KEY = process.env.VIDEO_API_KEY;
const API_URL = 'https://your-replit-domain.repl.co';

router.post('/get-channel-videos', async (req, res) => {
  const { channelUrl } = req.body;
  
  try {
    const response = await fetch(`${API_URL}/v1/channel/videos`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ channelUrl })
    });
    
    const channelData = await response.json();
    res.json(channelData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch channel videos' });
  }
});

module.exports = router;
```

#### Frontend (React)
```jsx
import React, { useState } from 'react';

function ChannelVideosComponent() {
  const [channelUrl, setChannelUrl] = useState('');
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchChannelVideos = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/get-channel-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelUrl })
      });
      
      const data = await response.json();
      setVideos(data.videos);
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false);
  };

  return (
    <div>
      <input
        type="text"
        value={channelUrl}
        onChange={(e) => setChannelUrl(e.target.value)}
        placeholder="Enter Channel URL (e.g., https://youtube.com/@channelname)"
      />
      <button onClick={fetchChannelVideos} disabled={loading}>
        {loading ? 'Fetching Videos...' : 'Get Channel Videos'}
      </button>
      
      <div className="video-grid">
        {videos.map(video => (
          <div key={video.id} className="video-item">
            <img src={video.thumbnail} alt={video.title} />
            <h4>{video.title}</h4>
            <p>Duration: {video.duration.formatted}</p>
            <p>Views: {video.view_count.toLocaleString()}</p>
            <a href={video.url} target="_blank">Watch on YouTube</a>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ChannelVideosComponent;
```

---

## Feature 3: Video Download with Progress Tracking

### What it does
Downloads videos with **instant start** (2-5 seconds) and provides **real-time progress updates** via WebSocket or polling.

### Method 1: WebSocket (Real-time Progress - RECOMMENDED)

#### Backend (Node.js)
```javascript
// your-backend/routes/download.js
const express = require('express');
const router = express.Router();

const API_KEY = process.env.VIDEO_API_KEY;
const API_URL = 'https://your-replit-domain.repl.co';

router.post('/download-video', async (req, res) => {
  const { videoUrl, formatId } = req.body;
  
  try {
    const response = await fetch(`${API_URL}/v1/download`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        url: videoUrl,
        format_id: formatId // optional
      })
    });
    
    // Get job ID from response headers
    const jobId = response.headers.get('X-Job-ID');
    
    // Stream the video file to the client
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', 'attachment; filename="video.mp4"');
    res.setHeader('X-Job-ID', jobId);
    
    // Pipe the response stream
    response.body.pipe(res);
    
  } catch (error) {
    res.status(500).json({ error: 'Download failed' });
  }
});

module.exports = router;
```

#### Frontend (React with WebSocket)
```jsx
import React, { useState, useEffect, useRef } from 'react';

function VideoDownloadComponent() {
  const [videoUrl, setVideoUrl] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [eta, setEta] = useState('');
  const wsRef = useRef(null);

  const downloadVideo = async () => {
    setDownloading(true);
    setProgress(0);
    
    // Connect to WebSocket for progress updates
    const ws = new WebSocket('wss://your-replit-domain.repl.co');
    wsRef.current = ws;
    
    ws.onopen = () => {
      console.log('WebSocket connected');
    };
    
    ws.onmessage = (event) => {
      const progressData = JSON.parse(event.data);
      
      setStatus(progressData.stage);
      setProgress(progressData.progress);
      
      if (progressData.eta) {
        setEta(progressData.eta);
      }
      
      if (progressData.status === 'completed') {
        setDownloading(false);
        ws.close();
      }
    };
    
    // Start download
    const response = await fetch('/api/download-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrl })
    });
    
    // Get job ID and subscribe to progress
    const jobId = response.headers.get('X-Job-ID');
    ws.send(JSON.stringify({
      type: 'subscribe',
      jobId: jobId
    }));
    
    // Trigger browser download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'video.mp4';
    a.click();
    window.URL.revokeObjectURL(url);
  };
  
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return (
    <div className="download-container">
      <input
        type="text"
        value={videoUrl}
        onChange={(e) => setVideoUrl(e.target.value)}
        placeholder="Enter YouTube URL"
        disabled={downloading}
      />
      <button onClick={downloadVideo} disabled={downloading}>
        {downloading ? 'Downloading...' : 'Download Video'}
      </button>
      
      {downloading && (
        <div className="progress-container">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p>{status} - {progress.toFixed(1)}%</p>
          {eta && <p>ETA: {eta}</p>}
        </div>
      )}
    </div>
  );
}

export default VideoDownloadComponent;
```

#### CSS for Progress Bar
```css
.progress-container {
  margin-top: 20px;
  width: 100%;
}

.progress-bar {
  width: 100%;
  height: 30px;
  background-color: #e0e0e0;
  border-radius: 15px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4CAF50, #8BC34A);
  transition: width 0.3s ease;
}
```

### Method 2: Polling (No WebSocket Required)

#### Frontend (React with Polling)
```jsx
import React, { useState } from 'react';

function VideoDownloadPolling() {
  const [videoUrl, setVideoUrl] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');

  const pollProgress = async (jobId) => {
    const interval = setInterval(async () => {
      const response = await fetch(`/api/download-progress/${jobId}`);
      const data = await response.json();
      
      setStatus(data.stage);
      setProgress(data.progress);
      
      if (data.status === 'completed' || data.status === 'failed') {
        clearInterval(interval);
        setDownloading(false);
      }
    }, 2000); // Poll every 2 seconds
  };

  const downloadVideo = async () => {
    setDownloading(true);
    setProgress(0);
    
    const response = await fetch('/api/download-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrl })
    });
    
    const jobId = response.headers.get('X-Job-ID');
    pollProgress(jobId);
    
    // Trigger download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'video.mp4';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div>
      <input
        type="text"
        value={videoUrl}
        onChange={(e) => setVideoUrl(e.target.value)}
        placeholder="Enter YouTube URL"
      />
      <button onClick={downloadVideo} disabled={downloading}>
        Download
      </button>
      
      {downloading && (
        <div>
          <progress value={progress} max="100"></progress>
          <p>{status} - {progress}%</p>
        </div>
      )}
    </div>
  );
}

export default VideoDownloadPolling;
```

#### Backend for Polling
```javascript
// Add this to your backend
router.get('/download-progress/:jobId', async (req, res) => {
  const { jobId } = req.params;
  
  const response = await fetch(
    `${API_URL}/v1/download/progress/${jobId}`,
    {
      headers: { 'Authorization': `Bearer ${API_KEY}` }
    }
  );
  
  const data = await response.json();
  res.json(data);
});
```

---

## Feature 4: Format Selection

### What it does
Allows users to choose video quality (360p, 480p, 720p, 1080p, etc.) before downloading.

### Integration Example

#### Complete Flow with Format Selection
```jsx
import React, { useState } from 'react';

function VideoDownloadWithFormats() {
  const [videoUrl, setVideoUrl] = useState('');
  const [formats, setFormats] = useState([]);
  const [selectedFormat, setSelectedFormat] = useState(null);
  const [videoInfo, setVideoInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  // Step 1: Fetch available formats
  const fetchFormats = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/get-formats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl })
      });
      
      const data = await response.json();
      setVideoInfo({
        title: data.title,
        thumbnail: data.thumbnail,
        duration: data.duration
      });
      setFormats(data.formats);
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false);
  };

  // Step 2: Download with selected format
  const downloadWithFormat = async (formatId) => {
    const response = await fetch('/api/download-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        videoUrl,
        formatId 
      })
    });
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${videoInfo.title}.mp4`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="format-selector">
      <input
        type="text"
        value={videoUrl}
        onChange={(e) => setVideoUrl(e.target.value)}
        placeholder="Enter YouTube URL"
      />
      <button onClick={fetchFormats} disabled={loading}>
        {loading ? 'Loading...' : 'Get Formats'}
      </button>
      
      {videoInfo && (
        <div className="video-preview">
          <img src={videoInfo.thumbnail} alt={videoInfo.title} />
          <h3>{videoInfo.title}</h3>
        </div>
      )}
      
      {formats.length > 0 && (
        <div className="formats-list">
          <h4>Select Quality:</h4>
          {formats.map(format => (
            <button
              key={format.format_id}
              onClick={() => downloadWithFormat(format.format_id)}
              className="format-button"
            >
              {format.resolution} - {format.fps}fps
              <br />
              <small>Size: {(format.filesize / 1024 / 1024).toFixed(2)} MB</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default VideoDownloadWithFormats;
```

#### Backend for Formats
```javascript
// your-backend/routes/formats.js
router.post('/get-formats', async (req, res) => {
  const { videoUrl } = req.body;
  
  const response = await fetch(`${API_URL}/v1/formats`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ url: videoUrl })
  });
  
  const data = await response.json();
  res.json(data);
});
```

---

## Production Deployment

### 1. Deploy Your API on Replit

1. Click **Deploy** in your Replit workspace
2. Your API will be available at: `https://your-username-your-repl.repl.co`
3. Use this URL in your production code

### 2. Environment Variables

In your production website, add:

```env
# .env file
VIDEO_API_KEY=vpa_your_actual_api_key_here
VIDEO_API_URL=https://your-username-your-repl.repl.co
```

### 3. Security Best Practices

```javascript
// ✅ GOOD: API key on backend
// your-backend/config.js
module.exports = {
  videoApiKey: process.env.VIDEO_API_KEY,
  videoApiUrl: process.env.VIDEO_API_URL
};

// ❌ BAD: Never expose API key in frontend
const apiKey = 'vpa_abc123...'; // DON'T DO THIS!
```

### 4. Rate Limiting (Optional)

```javascript
// your-backend/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

const videoDownloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per 15 minutes
  message: 'Too many download requests, please try again later'
});

// Apply to download route
router.post('/download-video', videoDownloadLimiter, async (req, res) => {
  // ... download logic
});
```

---

## Complete Production Example

### Backend Setup (Express.js)
```javascript
// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

const API_KEY = process.env.VIDEO_API_KEY;
const API_URL = process.env.VIDEO_API_URL;

// Video details endpoint
app.post('/api/video-details', async (req, res) => {
  const { url } = req.body;
  
  const response = await fetch(`${API_URL}/v1/video/details`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ url })
  });
  
  const data = await response.json();
  res.json(data);
});

// Channel videos endpoint
app.post('/api/channel-videos', async (req, res) => {
  const { channelUrl } = req.body;
  
  const response = await fetch(`${API_URL}/v1/channel/videos`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ channelUrl })
  });
  
  const data = await response.json();
  res.json(data);
});

// Download endpoint
app.post('/api/download', async (req, res) => {
  const { url, formatId } = req.body;
  
  const response = await fetch(`${API_URL}/v1/download`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ 
      url,
      format_id: formatId 
    })
  });
  
  const jobId = response.headers.get('X-Job-ID');
  res.setHeader('X-Job-ID', jobId);
  res.setHeader('Content-Type', 'video/mp4');
  
  response.body.pipe(res);
});

// Formats endpoint
app.post('/api/formats', async (req, res) => {
  const { url } = req.body;
  
  const response = await fetch(`${API_URL}/v1/formats`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ url })
  });
  
  const data = await response.json();
  res.json(data);
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

---

## Support & Documentation

- **API Base URL**: `https://your-replit-domain.repl.co`
- **WebSocket URL**: `wss://your-replit-domain.repl.co`
- **Rate Limits**: No hard limits (recommended: 10 req/15min per user)
- **Max Video Duration**: No limit
- **Supported Platforms**: YouTube (more coming soon)

## Need Help?

Check the full API documentation in `API_USAGE.md` or test all features in the dashboard at your Replit URL.
