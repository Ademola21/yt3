# Video Download API - Usage Guide

## Features
- ✅ **Instant download start** - Browser download begins within seconds
- ✅ **Real-time progress tracking** via WebSocket
- ✅ **Progress polling** for curl/API users
- ✅ **Direct streaming** from source to browser (no server storage)

---

## Quick Start

### 1. Generate an API Key
```bash
curl -X POST http://localhost:4000/v1/keys
```

Response:
```json
{
  "key": "vpa_abc123...",
  "id": 1,
  "createdAt": "2025-10-27T12:00:00.000Z"
}
```

---

## Using the API

### Method 1: Direct Download (Simple)

```bash
curl -X POST http://localhost:4000/v1/download \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://youtube.com/watch?v=VIDEO_ID"}' \
  -o video.mp4
```

**Note:** Download starts almost instantly! The `X-Job-ID` header contains the job ID for progress tracking.

---

### Method 2: Download with Progress Tracking (Recommended)

#### Using JavaScript/Node.js with WebSocket

```javascript
const API_KEY = 'vpa_abc123...';
const API_URL = 'http://localhost:4000';
const WS_URL = 'ws://localhost:4000';

// Start download and get job ID
async function downloadWithProgress(videoUrl, formatId = null) {
  const response = await fetch(`${API_URL}/v1/download`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url: videoUrl,
      format_id: formatId
    })
  });

  // Get job ID from response headers
  const jobId = response.headers.get('X-Job-ID');
  console.log(`Download started! Job ID: ${jobId}`);

  // Connect to WebSocket for real-time progress
  const ws = new WebSocket(WS_URL);
  
  ws.onopen = () => {
    // Subscribe to this job's progress updates
    ws.send(JSON.stringify({
      type: 'subscribe',
      jobId: jobId
    }));
  };

  ws.onmessage = (event) => {
    const progress = JSON.parse(event.data);
    console.log(`Status: ${progress.status}`);
    console.log(`Stage: ${progress.stage}`);
    console.log(`Progress: ${progress.progress}%`);
    
    if (progress.eta) {
      console.log(`ETA: ${progress.eta}`);
    }
    
    if (progress.totalSize) {
      console.log(`Size: ${progress.totalSize}`);
    }

    if (progress.status === 'completed') {
      console.log('Download completed!');
      ws.close();
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  // Handle the actual video download
  const reader = response.body.getReader();
  const chunks = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  // Combine chunks into final file
  const blob = new Blob(chunks, { type: 'video/mp4' });
  return blob;
}

// Usage
downloadWithProgress('https://youtube.com/watch?v=VIDEO_ID')
  .then(blob => {
    console.log('Video downloaded!', blob.size, 'bytes');
    // Save or use the blob
  });
```

---

### Method 3: Progress Polling (For curl/shell scripts)

```bash
#!/bin/bash

API_KEY="vpa_abc123..."
VIDEO_URL="https://youtube.com/watch?v=VIDEO_ID"

# Start download in background and capture job ID
RESPONSE=$(curl -X POST http://localhost:4000/v1/download \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"$VIDEO_URL\"}" \
  -D - \
  -o video.mp4 &)

# Extract job ID from response headers
JOB_ID=$(echo "$RESPONSE" | grep -i "x-job-id:" | cut -d' ' -f2 | tr -d '\r')

echo "Download started! Job ID: $JOB_ID"

# Poll for progress every 2 seconds
while true; do
  PROGRESS=$(curl -s -H "Authorization: Bearer $API_KEY" \
    "http://localhost:4000/v1/download/progress/$JOB_ID")
  
  STATUS=$(echo $PROGRESS | jq -r '.status')
  STAGE=$(echo $PROGRESS | jq -r '.stage')
  PERCENT=$(echo $PROGRESS | jq -r '.progress')
  
  echo "[$STATUS] $STAGE - $PERCENT%"
  
  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
    break
  fi
  
  sleep 2
done

echo "Download finished!"
```

---

### Method 4: Browser JavaScript (Frontend)

```javascript
async function downloadVideo(videoUrl, formatId = null) {
  const API_KEY = 'vpa_abc123...';
  const API_URL = 'http://localhost:4000';
  
  // Connect to WebSocket first
  const ws = new WebSocket('ws://localhost:4000');
  let jobId = null;

  ws.onopen = () => {
    console.log('WebSocket connected');
  };

  ws.onmessage = (event) => {
    const progress = JSON.parse(event.data);
    
    // Update UI with progress
    updateProgressBar(progress.progress);
    updateStatusText(progress.stage);
    
    if (progress.totalSize) {
      updateFileSize(progress.totalSize);
    }
    
    if (progress.eta) {
      updateETA(progress.eta);
    }

    if (progress.status === 'completed') {
      console.log('Download completed!');
      ws.close();
    }
  };

  // Start download
  try {
    const response = await fetch(`${API_URL}/v1/download`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: videoUrl,
        format_id: formatId
      })
    });

    // Get job ID and subscribe to progress
    jobId = response.headers.get('X-Job-ID');
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
    
  } catch (error) {
    console.error('Download failed:', error);
  }
}

// Example UI update functions
function updateProgressBar(percent) {
  document.getElementById('progress-bar').style.width = `${percent}%`;
  document.getElementById('progress-text').textContent = `${percent}%`;
}

function updateStatusText(stage) {
  document.getElementById('status').textContent = stage;
}

function updateFileSize(size) {
  document.getElementById('file-size').textContent = size;
}

function updateETA(eta) {
  document.getElementById('eta').textContent = `ETA: ${eta}`;
}
```

---

## API Endpoints Reference

### POST /v1/keys
Generate a new API key.

**Response:**
```json
{
  "key": "vpa_...",
  "id": 1,
  "createdAt": "2025-10-27T12:00:00.000Z"
}
```

---

### POST /v1/formats
Get available video formats and quality options.

**Request:**
```json
{
  "url": "https://youtube.com/watch?v=VIDEO_ID"
}
```

**Response:**
```json
{
  "title": "Video Title",
  "duration": 300,
  "thumbnail": "https://...",
  "formats": [
    {
      "format_id": "95",
      "resolution": "720p",
      "height": 720,
      "fps": 30,
      "filesize": 45000000,
      "ext": "mp4"
    }
  ]
}
```

---

### POST /v1/download
Start a streaming download with instant browser download start.

**Request:**
```json
{
  "url": "https://youtube.com/watch?v=VIDEO_ID",
  "format_id": "95"  // optional, defaults to best quality
}
```

**Response:**
- Headers: `X-Job-ID` contains the job ID for progress tracking
- Body: Video file stream (starts almost immediately)

---

### GET /v1/download/progress/:jobId
Get current progress of a download job (polling method).

**Response:**
```json
{
  "jobId": "uuid-here",
  "status": "streaming",
  "progress": 45.5,
  "stage": "Downloading: 45.5%",
  "title": "Video Title",
  "totalSize": "50.5MiB",
  "eta": "00:30",
  "url": "https://..."
}
```

**Status values:**
- `initializing` - Fetching video metadata
- `downloading` - Starting download stream
- `streaming` - Actively downloading and streaming to browser
- `completed` - Download finished
- `failed` - Download failed (check `error` field)

---

## WebSocket Protocol

### Connection
```javascript
const ws = new WebSocket('ws://localhost:4000');
```

### Subscribe to Job Updates
```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  jobId: 'your-job-id'
}));
```

### Progress Messages
```json
{
  "jobId": "uuid",
  "status": "streaming",
  "progress": 67.3,
  "stage": "Downloading: 67.3%",
  "title": "Video Title",
  "totalSize": "50.5MiB",
  "eta": "00:15"
}
```

---

## Tips & Best Practices

1. **Instant Downloads**: The download starts streaming to your browser within 2-5 seconds after the API call
2. **Progress Tracking**: Use WebSocket for real-time updates or polling for simpler integrations
3. **Format Selection**: Call `/v1/formats` first to let users choose quality
4. **Error Handling**: Check the `status` field - if it's `failed`, the `error` field contains details
5. **Job Cleanup**: Jobs are automatically removed after 5 minutes of completion

---

## Example: Complete Download Flow

```javascript
// 1. Get available formats
const formats = await fetch('http://localhost:4000/v1/formats', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ url: 'https://youtube.com/watch?v=VIDEO_ID' })
}).then(r => r.json());

console.log('Available formats:', formats.formats);

// 2. User selects format (e.g., 720p)
const selectedFormat = formats.formats.find(f => f.resolution === '720p');

// 3. Start download with progress tracking
downloadWithProgress('https://youtube.com/watch?v=VIDEO_ID', selectedFormat.format_id);
```

---

## Troubleshooting

### Download doesn't start
- Check your API key is valid
- Ensure the video URL is accessible
- Check server logs for error messages

### Progress not updating
- For WebSocket: Ensure you've subscribed with the correct job ID
- For polling: Job might have completed or failed

### "Job not found" error
- Jobs are cleaned up 5 minutes after completion
- Ensure you're using the correct job ID from the `X-Job-ID` header

---

## Support

For issues or questions, check the server logs or contact support.
