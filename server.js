const express = require('express');
const { exec } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
require('dotenv').config();
const { db, apiKeys, requestLogs } = require('./db');
const { eq, desc, sql: drizzleSql } = require('drizzle-orm');
const { hashApiKey, generateSecureApiKey, verifyApiKey, checkRateLimit } = require('./utils/security');
const { requestLoggerMiddleware } = require('./middleware/requestLogger');
const { downloadManager } = require('./utils/downloadManager');
const { checkYtDlpVersion, updateYtDlp, getSystemInfo, updateNodePackages } = require('./utils/packageUpdater');

const app = express();
const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Store active download jobs and their progress
const activeJobs = new Map();

// Use custom ffmpeg with libfdk-aac support
const FFMPEG_PATH = path.join(__dirname, 'node_modules', 'ffmpeg-for-homebridge', 'ffmpeg');

// Use system yt-dlp (installed via pip on both Replit and DigitalOcean)
// On DigitalOcean (Docker), yt-dlp is at /usr/local/bin/yt-dlp
// On Replit, it's in PATH as 'yt-dlp'
let YT_DLP_PATH = 'yt-dlp';

if (process.env.NODE_ENV === 'production') {
  // In production, try to find yt-dlp using which command
  try {
    const { execSync } = require('child_process');
    const whichResult = execSync('which yt-dlp', { encoding: 'utf8' }).trim();
    if (whichResult && fs.existsSync(whichResult)) {
      YT_DLP_PATH = whichResult;
      console.log('Found yt-dlp using which:', YT_DLP_PATH);
    } else {
      throw new Error('which returned invalid path');
    }
  } catch (error) {
    // Fallback to checking common paths
    console.warn('Could not find yt-dlp using which, checking common paths...');
    const commonPaths = [
      '/usr/local/bin/yt-dlp',
      '/usr/bin/yt-dlp',
      '/home/runner/.local/bin/yt-dlp'
    ];
    
    let found = false;
    for (const testPath of commonPaths) {
      if (fs.existsSync(testPath)) {
        YT_DLP_PATH = testPath;
        found = true;
        console.log('Found yt-dlp at:', YT_DLP_PATH);
        break;
      }
    }
    
    if (!found) {
      console.error('ERROR: yt-dlp not found in any expected location!');
      console.error('Please check Docker build logs to ensure yt-dlp was installed successfully.');
      // Keep default 'yt-dlp' and hope it's in PATH
    }
  }
}

console.log('Using yt-dlp:', YT_DLP_PATH);

// YouTube cookies file for authenticated requests (optional)
const COOKIES_PATH = path.join(__dirname, 'youtube-cookies.txt');
const cookiesExist = fs.existsSync(COOKIES_PATH);

console.log('Database connection initialized.');

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(requestLoggerMiddleware);

// Serve static files from the React app (for production)
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath, {
    setHeaders: (res) => {
      res.set('Cache-Control', 'no-cache');
    }
  }));
  console.log('Serving static files from:', distPath);
}

const authenticateKey = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  try {
    const hashedToken = hashApiKey(token);
    const [matchedKey] = await db.select().from(apiKeys).where(eq(apiKeys.key, hashedToken));
    
    if (!matchedKey) {
      return res.status(403).json({ error: 'Forbidden: Invalid API key. Please generate a key from the dashboard.' });
    }

    if (matchedKey.status !== 'active') {
      return res.status(403).json({ error: 'Forbidden: API key has been revoked' });
    }

    if (matchedKey.maxRequests && matchedKey.totalRequests >= matchedKey.maxRequests) {
      return res.status(429).json({ error: 'Rate limit exceeded: Maximum requests reached for this API key' });
    }

    const rateLimitResult = checkRateLimit(matchedKey.id, matchedKey.rateLimit);
    
    if (!rateLimitResult.allowed) {
      res.set({
        'X-RateLimit-Limit': matchedKey.rateLimit.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': rateLimitResult.resetAt.toISOString()
      });
      return res.status(429).json({ 
        error: 'Rate limit exceeded: Too many requests',
        resetAt: rateLimitResult.resetAt
      });
    }

    res.set({
      'X-RateLimit-Limit': matchedKey.rateLimit.toString(),
      'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
      'X-RateLimit-Reset': rateLimitResult.resetAt.toISOString()
    });

    req.apiKeyId = matchedKey.id;
    req.apiKey = matchedKey;

    await db.update(apiKeys)
      .set({ 
        totalRequests: drizzleSql`${apiKeys.totalRequests} + 1`,
        lastUsedAt: new Date()
      })
      .where(eq(apiKeys.id, matchedKey.id));

    next();
  } catch (error) {
    console.error('Error authenticating API key:', error);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
};

// --- Helper Functions ---
const { spawn } = require('child_process');

const runCommand = (command, args = []) => {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args);
    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code !== 0) {
        console.error(`Command failed: ${command} ${args.join(' ')}\n${stderr}`);
        reject(new Error(`Execution failed: ${stderr}`));
        return;
      }
      resolve(stdout);
    });
  });
};

const generateApiKey = () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'vpa_';
  for (let i = 0; i < 32; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

// --- API Endpoints ---

// Health check endpoint (required for Digital Ocean and load balancers)
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({ 
    message: 'Video Download API Server with Real-Time Progress',
    version: '2.1.0',
    endpoints: {
      'POST /v1/keys': 'Generate a new API key',
      'GET /v1/keys': 'List all API keys',
      'POST /v1/formats': 'Get available video formats and file sizes',
      'POST /v1/video/details': 'Fetch details for a single YouTube video',
      'POST /v1/channel/videos': 'Fetch all videos from a YouTube channel (50+ min only)',
      'POST /v1/download': 'Stream download with instant start (requires API key)',
      'GET /v1/download/progress/:jobId': 'Get download progress (polling method)',
      'GET /v1/docs/integration': 'Get complete integration guide for third-party platforms',
      'WebSocket ws://host:port': 'Real-time progress via WebSocket'
    },
    features: [
      'Instant download start - browser download begins immediately',
      'Real-time progress tracking via WebSocket',
      'Progress polling endpoint for curl/API users',
      'Direct streaming from source to browser'
    ],
    websocket: {
      url: `ws://${req.get('host')}`,
      usage: 'Connect and send: {"type":"subscribe","jobId":"your-job-id"}'
    }
  });
});

// Integration documentation endpoint
app.get('/v1/docs/integration', (req, res) => {
  const baseUrl = req.protocol + '://' + req.get('host');
  
  res.json({
    title: 'Video Download API - Integration Guide for Third-Party Platforms',
    version: '2.1.0',
    overview: {
      description: 'This API provides video download, metadata fetching, and channel scraping capabilities with real-time progress tracking.',
      base_url: baseUrl,
      authentication: 'Bearer token in Authorization header'
    },
    features: [
      {
        name: 'Video Download with Progress Tracking',
        endpoint: 'POST /v1/download',
        description: 'Download videos with instant streaming and real-time progress updates',
        integration_methods: {
          browser: {
            description: 'Direct browser download with progress tracking via WebSocket',
            example: `// Step 1: Connect to WebSocket for progress updates
const ws = new WebSocket('${baseUrl.replace('http', 'ws')}');
let jobId = null;

ws.onopen = () => {
  console.log('WebSocket connected');
};

ws.onmessage = (event) => {
  const progress = JSON.parse(event.data);
  
  // Update your UI with progress
  updateProgressBar(progress.progress); // 0-100
  updateStatusText(progress.stage); // e.g., "Downloading: 45.3%"
  
  if (progress.totalSize) {
    updateFileSize(progress.totalSize); // e.g., "50.5MiB"
  }
  
  if (progress.eta) {
    updateETA(progress.eta); // e.g., "00:30"
  }

  if (progress.status === 'completed') {
    console.log('Download completed!');
    ws.close();
  } else if (progress.status === 'failed') {
    console.error('Download failed:', progress.error);
    ws.close();
  }
};

// Step 2: Start the download
async function downloadVideo(videoUrl, formatId = null) {
  const response = await fetch('${baseUrl}/v1/download', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url: videoUrl,
      format_id: formatId // optional, defaults to best quality
    })
  });

  // Get job ID from response headers
  jobId = response.headers.get('X-Job-ID');
  
  // Subscribe to progress updates
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
}

// Helper functions to update your UI
function updateProgressBar(percent) {
  document.getElementById('progress-bar').style.width = percent + '%';
  document.getElementById('progress-text').textContent = percent + '%';
}

function updateStatusText(stage) {
  document.getElementById('status').textContent = stage;
}

function updateFileSize(size) {
  document.getElementById('file-size').textContent = size;
}

function updateETA(eta) {
  document.getElementById('eta').textContent = 'ETA: ' + eta;
}`
          },
          curl: {
            description: 'Command-line download with progress polling',
            example: `# Start download in background
curl -X POST '${baseUrl}/v1/download' \\
  -H 'Authorization: Bearer YOUR_API_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{"url": "https://youtube.com/watch?v=VIDEO_ID"}' \\
  -D headers.txt \\
  -o video.mp4 &

# Extract job ID from headers
JOB_ID=$(grep -i "x-job-id:" headers.txt | cut -d' ' -f2 | tr -d '\\r')

# Poll for progress
while true; do
  PROGRESS=$(curl -s -H "Authorization: Bearer YOUR_API_KEY" \\
    "${baseUrl}/v1/download/progress/$JOB_ID")
  
  STATUS=$(echo $PROGRESS | jq -r '.status')
  STAGE=$(echo $PROGRESS | jq -r '.stage')
  PERCENT=$(echo $PROGRESS | jq -r '.progress')
  
  echo "[$STATUS] $STAGE - $PERCENT%"
  
  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
    break
  fi
  
  sleep 2
done`
          },
          server_side: {
            description: 'Backend integration (Node.js, Python, etc.)',
            example: `// Node.js example
const fetch = require('node-fetch');
const fs = require('fs');
const WebSocket = require('ws');

async function downloadVideoServerSide(videoUrl, outputPath) {
  // Connect to WebSocket
  const ws = new WebSocket('${baseUrl.replace('http', 'ws')}');
  
  ws.on('message', (data) => {
    const progress = JSON.parse(data);
    console.log(\`Progress: \${progress.progress}% - \${progress.stage}\`);
  });

  // Start download
  const response = await fetch('${baseUrl}/v1/download', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ url: videoUrl })
  });

  const jobId = response.headers.get('X-Job-ID');
  ws.send(JSON.stringify({ type: 'subscribe', jobId: jobId }));

  // Save to file
  const fileStream = fs.createWriteStream(outputPath);
  response.body.pipe(fileStream);

  return new Promise((resolve, reject) => {
    fileStream.on('finish', () => {
      ws.close();
      resolve();
    });
    fileStream.on('error', reject);
  });
}`
          }
        }
      },
      {
        name: 'Video Metadata Fetching',
        endpoint: 'POST /v1/video/details',
        description: 'Get comprehensive metadata for a single video',
        integration_example: {
          curl: `curl -X POST '${baseUrl}/v1/video/details' \\
  -H 'Authorization: Bearer YOUR_API_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{"url": "https://youtube.com/watch?v=VIDEO_ID"}'`,
          javascript: `const response = await fetch('${baseUrl}/v1/video/details', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    url: 'https://youtube.com/watch?v=VIDEO_ID'
  })
});

const data = await response.json();
console.log('Title:', data.video.title);
console.log('Duration:', data.video.duration.formatted);
console.log('Thumbnail:', data.video.thumbnail);
console.log('Description:', data.video.description);`,
          response_example: {
            success: true,
            video: {
              id: 'VIDEO_ID',
              title: 'Video Title',
              description: 'Video description...',
              url: 'https://youtube.com/watch?v=VIDEO_ID',
              duration: {
                total_seconds: 3600,
                seconds: 0,
                minutes: 0,
                hours: 1,
                days: 0,
                formatted: '1h 0m 0s'
              },
              upload_time: {
                date: '20250127',
                timestamp: 1738012800,
                formatted: '2025-01-27T12:00:00.000Z'
              },
              thumbnail: 'https://i.ytimg.com/...',
              view_count: 1000000,
              like_count: 50000,
              channel: {
                name: 'Channel Name',
                id: 'CHANNEL_ID',
                url: 'https://youtube.com/@channelname'
              }
            }
          }
        }
      },
      {
        name: 'Channel Video Scraping',
        endpoint: 'POST /v1/channel/videos',
        description: 'Fetch all videos from a channel (filters for 50+ minute videos)',
        integration_example: {
          curl: `curl -X POST '${baseUrl}/v1/channel/videos' \\
  -H 'Authorization: Bearer YOUR_API_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{"channelUrl": "https://youtube.com/@channelname"}' \\
  -o channel_videos.json`,
          javascript: `const response = await fetch('${baseUrl}/v1/channel/videos', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    channelUrl: 'https://youtube.com/@channelname'
  })
});

const data = await response.json();
console.log('Total videos found:', data.total_videos_found);
console.log('Videos matching criteria:', data.videos_returned);

// Display each video
data.videos.forEach(video => {
  console.log('Title:', video.title);
  console.log('Duration:', video.duration.formatted);
  console.log('URL:', video.url);
  console.log('Thumbnail:', video.thumbnail);
});`,
          response_example: {
            channel_url: 'https://youtube.com/@channelname',
            total_videos_found: 100,
            total_matching_criteria: 25,
            videos_returned: 25,
            videos: [
              {
                id: 'VIDEO_ID',
                title: 'Long Video Title',
                description: 'Description...',
                url: 'https://youtube.com/watch?v=VIDEO_ID',
                duration: {
                  total_seconds: 3600,
                  formatted: '1h 0m 0s'
                },
                thumbnail: 'https://i.ytimg.com/...',
                view_count: 50000
              }
            ]
          }
        }
      },
      {
        name: 'Format Selection',
        endpoint: 'POST /v1/formats',
        description: 'Get available video qualities and file sizes before downloading',
        integration_example: {
          curl: `curl -X POST '${baseUrl}/v1/formats' \\
  -H 'Authorization: Bearer YOUR_API_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{"url": "https://youtube.com/watch?v=VIDEO_ID"}'`,
          javascript: `// Step 1: Get available formats
const formatsResponse = await fetch('${baseUrl}/v1/formats', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    url: 'https://youtube.com/watch?v=VIDEO_ID'
  })
});

const formats = await formatsResponse.json();

// Step 2: Let user select format
// Display formats.formats array in your UI
formats.formats.forEach(format => {
  console.log(\`\${format.resolution} - \${(format.filesize / 1024 / 1024).toFixed(2)}MB\`);
});

// Step 3: Download with selected format
const selectedFormat = formats.formats.find(f => f.resolution === '720p');

const downloadResponse = await fetch('${baseUrl}/v1/download', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    url: 'https://youtube.com/watch?v=VIDEO_ID',
    format_id: selectedFormat.format_id
  })
});`,
          response_example: {
            title: 'Video Title',
            duration: 3600,
            thumbnail: 'https://i.ytimg.com/...',
            formats: [
              {
                format_id: '95',
                resolution: '720p',
                height: 720,
                fps: 30,
                filesize: 45000000,
                ext: 'mp4'
              },
              {
                format_id: '96',
                resolution: '1080p',
                height: 1080,
                fps: 30,
                filesize: 85000000,
                ext: 'mp4'
              }
            ]
          }
        }
      }
    ],
    authentication: {
      description: 'Generate and use API keys',
      generate_key: {
        endpoint: 'POST /v1/keys',
        curl_example: `curl -X POST '${baseUrl}/v1/keys'`,
        response: {
          key: 'vpa_...',
          id: 1,
          createdAt: '2025-01-27T12:00:00.000Z'
        }
      },
      use_key: {
        description: 'Include API key in Authorization header for all authenticated endpoints',
        example: `Authorization: Bearer vpa_your_api_key_here`
      }
    },
    production_tips: [
      'Store API keys securely in environment variables',
      'Implement rate limiting on your platform to prevent abuse',
      'Use WebSocket connections for real-time progress in production',
      'Handle network errors and implement retry logic',
      'Cache video metadata when possible to reduce API calls',
      'For channel scraping, implement pagination if needed for large channels'
    ],
    error_handling: {
      description: 'Handle common error responses',
      examples: {
        unauthorized: {
          status: 401,
          response: { error: 'Unauthorized: No token provided' }
        },
        forbidden: {
          status: 403,
          response: { error: 'Forbidden: Invalid API key' }
        },
        bad_request: {
          status: 400,
          response: { error: 'Missing required parameter' }
        },
        not_found: {
          status: 404,
          response: { error: 'Job not found' }
        },
        server_error: {
          status: 500,
          response: { error: 'Failed to process request', details: '...' }
        }
      }
    },
    support: {
      documentation: baseUrl + '/v1/docs/integration',
      api_reference: baseUrl + '/',
      test_endpoint: baseUrl + '/v1/formats'
    }
  });
});

// Endpoint to delete ALL API keys (use with caution!)
app.delete('/v1/keys/all', async (req, res) => {
  try {
    const result = await db.delete(apiKeys);
    console.log('All API keys deleted from database');
    res.json({ 
      success: true, 
      message: 'All API keys have been deleted. You can now create a new bootstrap key.' 
    });
  } catch (error) {
    console.error('Error deleting all keys:', error);
    res.status(500).json({ error: 'Failed to delete all API keys' });
  }
});

// Bootstrap endpoint - creates first API key (only works when no keys exist)
app.post('/v1/keys/bootstrap', async (req, res) => {
  try {
    const existingKeys = await db.select().from(apiKeys);
    
    if (existingKeys.length > 0) {
      return res.status(403).json({ 
        error: 'Bootstrap denied: API keys already exist. Use an existing key to create new ones.' 
      });
    }
    
    const { name } = req.body;
    const plainKey = generateSecureApiKey();
    const hashedKey = hashApiKey(plainKey);
    
    const [insertedKey] = await db.insert(apiKeys).values({ 
      key: hashedKey,
      name: name || 'Bootstrap Admin Key',
      rateLimit: 1000,
      maxRequests: null,
      status: 'active'
    }).returning();
    
    console.log(`Bootstrap: Generated admin API key: ${plainKey.substring(0, 12)}... (ID: ${insertedKey.id})`);
    res.status(201).json({ 
      key: plainKey,
      id: insertedKey.id, 
      name: insertedKey.name,
      createdAt: insertedKey.createdAt,
      rateLimit: insertedKey.rateLimit,
      warning: 'SAVE THIS KEY SECURELY! It will not be shown again and has full admin access.'
    });
  } catch (error) {
    console.error('Error creating bootstrap key:', error);
    res.status(500).json({ error: 'Failed to generate bootstrap key' });
  }
});

// Endpoint to get all API keys (admin only)
app.get('/v1/keys', authenticateKey, async (req, res) => {
  try {
    const allKeys = await db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt));
    res.json({ keys: allKeys });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

// Endpoint to generate a new API key (admin only)
app.post('/v1/keys', authenticateKey, async (req, res) => {
  try {
    const { name, rateLimit, maxRequests } = req.body;
    const plainKey = generateSecureApiKey();
    const hashedKey = hashApiKey(plainKey);
    
    const [insertedKey] = await db.insert(apiKeys).values({ 
      key: hashedKey,
      name: name || null,
      rateLimit: rateLimit || 60,
      maxRequests: maxRequests || null,
      status: 'active'
    }).returning();
    
    console.log(`Generated new API key: ${plainKey.substring(0, 12)}... (ID: ${insertedKey.id})`);
    res.status(201).json({ 
      key: plainKey,
      id: insertedKey.id, 
      name: insertedKey.name,
      createdAt: insertedKey.createdAt,
      rateLimit: insertedKey.rateLimit,
      maxRequests: insertedKey.maxRequests,
      warning: 'Save this key securely! It will not be shown again.'
    });
  } catch (error) {
    console.error('Error creating API key:', error);
    res.status(500).json({ error: 'Failed to generate API key' });
  }
});

// Endpoint to delete an API key (admin only)
app.delete('/v1/keys/:id', authenticateKey, async (req, res) => {
  try {
    const { id } = req.params;
    
    const [existingKey] = await db.select().from(apiKeys).where(eq(apiKeys.id, parseInt(id)));
    
    if (!existingKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    await db.delete(apiKeys).where(eq(apiKeys.id, parseInt(id)));
    
    console.log(`Deleted API key ID: ${id}`);
    res.json({ success: true, message: 'API key deleted successfully' });
  } catch (error) {
    console.error('Error deleting API key:', error);
    res.status(500).json({ error: 'Failed to delete API key' });
  }
});

// Endpoint to get usage statistics for an API key (admin only)
app.get('/v1/keys/:id/stats', authenticateKey, async (req, res) => {
  try {
    const { id } = req.params;
    
    const [key] = await db.select().from(apiKeys).where(eq(apiKeys.id, parseInt(id)));
    
    if (!key) {
      return res.status(404).json({ error: 'API key not found' });
    }

    const logs = await db.select().from(requestLogs)
      .where(eq(requestLogs.apiKeyId, parseInt(id)))
      .orderBy(desc(requestLogs.timestamp))
      .limit(100);

    const stats = {
      totalRequests: key.totalRequests,
      maxRequests: key.maxRequests,
      rateLimit: key.rateLimit,
      status: key.status,
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
      recentRequests: logs.map(log => ({
        endpoint: log.endpoint,
        method: log.method,
        statusCode: log.statusCode,
        responseTime: log.responseTime,
        timestamp: log.timestamp
      })),
      endpointBreakdown: logs.reduce((acc, log) => {
        const endpoint = log.endpoint.split('?')[0];
        acc[endpoint] = (acc[endpoint] || 0) + 1;
        return acc;
      }, {})
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching key stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Endpoint to get available video formats
app.post('/v1/formats', authenticateKey, async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'Missing "url" in request body' });
  }

  try {
    console.log(`Fetching formats for URL: ${url}`);
    const args = cookiesExist ? ['--cookies', COOKIES_PATH, '-J', url] : ['-J', url];
    const output = await runCommand(YT_DLP_PATH, args);
    const videoInfo = JSON.parse(output);

    // Calculate merged audio stream size based on the actual encoding settings we use
    // Default is libfdk_aac at 30k bitrate
    const targetAudioBitrate = 30; // 30 kbps as per default in /v1/download
    let audioSize = 0;
    if (videoInfo.duration) {
      // Calculate audio size based on target bitrate: (bitrate_kbps * 1000 / 8) * duration
      audioSize = Math.round((targetAudioBitrate * 1000 / 8) * videoInfo.duration);
    }

    // Extract and format available video qualities (only MP4/H.264 compatible)
    const formats = videoInfo.formats
      .filter(f => {
        // Only video formats with height, and MP4 container with H.264 codec
        return f.vcodec !== 'none' && 
               f.height && 
               (f.ext === 'mp4' || f.vcodec?.includes('avc') || f.vcodec?.includes('h264'));
      })
      .map(f => {
        // Calculate video stream size - prefer exact values from yt-dlp
        let videoSize = f.filesize || f.filesize_approx || 0;
        
        // If no exact filesize available, estimate from bitrate and duration
        if (videoSize === 0 && videoInfo.duration) {
          // For progressive formats (video+audio), use tbr (total bitrate)
          // For adaptive formats (video-only), use vbr (video bitrate)
          const bitrate = (f.acodec === 'none') ? (f.vbr || f.tbr) : f.tbr;
          if (bitrate) {
            videoSize = Math.round((bitrate * 1000 / 8) * videoInfo.duration);
          }
        }
        
        // For video-only formats (adaptive), add audio stream size for merged estimate
        // For progressive formats (already includes audio), use as-is
        let totalSize = (f.acodec === 'none') ? videoSize + audioSize : videoSize;
        
        // Apply compression factor - FFmpeg merging with copy codec and re-encoding audio
        // at 30kbps results in ~40% smaller file due to container optimization
        // and significantly lower audio bitrate than source
        totalSize = Math.round(totalSize * 0.60);
        
        return {
          format_id: f.format_id,
          resolution: `${f.height}p`,
          height: f.height,
          fps: f.fps || 30,
          filesize: totalSize,
          ext: f.ext,
          vcodec: f.vcodec,
          acodec: f.acodec
        };
      })
      .sort((a, b) => a.height - b.height); // Sort by resolution

    // Group by resolution and keep the best MP4 format for each resolution
    const uniqueFormats = [];
    const seenHeights = new Set();
    
    for (const format of formats) {
      if (!seenHeights.has(format.height)) {
        seenHeights.add(format.height);
        uniqueFormats.push(format);
      }
    }

    res.json({
      title: videoInfo.title,
      duration: videoInfo.duration,
      thumbnail: videoInfo.thumbnail,
      formats: uniqueFormats
    });

  } catch (error) {
    console.error(`Error fetching formats:`, error.message);
    res.status(500).json({ error: 'Failed to fetch video formats' });
  }
});

// Endpoint to fetch details for a single YouTube video
app.post('/v1/video/details', authenticateKey, async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'Missing "url" in request body' });
  }

  try {
    console.log(`Fetching video details for: ${url}`);
    
    // Fetch video details using yt-dlp
    const args = cookiesExist 
      ? ['--cookies', COOKIES_PATH, '-J', url]
      : ['-J', url];
    
    const output = await runCommand(YT_DLP_PATH, args);
    const videoInfo = JSON.parse(output);

    // Find the highest quality thumbnail
    let bestThumbnail = '';
    if (videoInfo.thumbnails && videoInfo.thumbnails.length > 0) {
      const sortedThumbnails = videoInfo.thumbnails.sort((a, b) => {
        const aSize = (a.width || 0) * (a.height || 0);
        const bSize = (b.width || 0) * (b.height || 0);
        return bSize - aSize;
      });
      bestThumbnail = sortedThumbnails[0].url;
    }

    // Calculate time components
    const duration = videoInfo.duration || 0;
    const seconds = duration % 60;
    const minutes = Math.floor(duration / 60) % 60;
    const hours = Math.floor(duration / 3600) % 24;
    const days = Math.floor(duration / 86400);

    const videoDetails = {
      id: videoInfo.id,
      title: videoInfo.title,
      description: videoInfo.description || '',
      url: url,
      duration: {
        total_seconds: duration,
        seconds: seconds,
        minutes: minutes,
        hours: hours,
        days: days,
        formatted: `${days > 0 ? days + 'd ' : ''}${hours > 0 ? hours + 'h ' : ''}${minutes}m ${seconds}s`
      },
      upload_time: {
        date: videoInfo.upload_date,
        timestamp: videoInfo.timestamp,
        formatted: new Date(videoInfo.timestamp * 1000).toISOString()
      },
      thumbnail: bestThumbnail,
      view_count: videoInfo.view_count || 0,
      like_count: videoInfo.like_count || 0,
      channel: {
        name: videoInfo.uploader || videoInfo.channel,
        id: videoInfo.uploader_id || videoInfo.channel_id,
        url: videoInfo.uploader_url || videoInfo.channel_url
      }
    };

    console.log(`Successfully fetched details for video: ${videoInfo.title}`);

    res.json({
      success: true,
      video: videoDetails
    });

  } catch (error) {
    console.error(`Error fetching video details:`, error.message);
    res.status(500).json({ error: 'Failed to fetch video details', details: error.message });
  }
});

// Endpoint to fetch all videos from a YouTube channel
app.post('/v1/channel/videos', authenticateKey, async (req, res) => {
  const { channelUrl } = req.body;

  if (!channelUrl) {
    return res.status(400).json({ error: 'Missing "channelUrl" in request body' });
  }

  try {
    console.log(`Fetching ALL videos from channel: ${channelUrl}`);
    
    // Ensure the URL points to the /videos tab
    let videosUrl = channelUrl;
    if (!videosUrl.includes('/videos')) {
      videosUrl = videosUrl.replace(/\/$/, '') + '/videos';
    }
    
    // Fetch channel videos using yt-dlp with flat playlist extraction
    const args = cookiesExist 
      ? ['--cookies', COOKIES_PATH, '--flat-playlist', '--dump-json', videosUrl]
      : ['--flat-playlist', '--dump-json', videosUrl];
    
    const output = await runCommand(YT_DLP_PATH, args);
    
    // Parse each line as a separate JSON object (yt-dlp outputs one JSON per line)
    const lines = output.trim().split('\n').filter(line => line.trim());
    const allVideos = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch (e) {
        console.error('Failed to parse line:', line);
        return null;
      }
    }).filter(v => v !== null);

    console.log(`Found ${allVideos.length} total videos`);

    // Pre-filter by duration to reduce API calls
    const candidateVideos = allVideos.filter(v => v.duration && v.duration >= 3000);
    console.log(`${candidateVideos.length} videos match duration criteria (>= 50 min)`);
    console.log(`Processing ALL ${candidateVideos.length} videos...`);

    // Batch process ALL videos with concurrent requests (5 at a time to avoid rate limiting)
    const filteredVideos = [];
    const batchSize = 5;
    
    for (let i = 0; i < candidateVideos.length; i += batchSize) {
      const batch = candidateVideos.slice(i, i + batchSize);
      const batchPromises = batch.map(async (video) => {
        try {
          const detailArgs = cookiesExist 
            ? ['--cookies', COOKIES_PATH, '-J', `https://www.youtube.com/watch?v=${video.id}`]
            : ['-J', `https://www.youtube.com/watch?v=${video.id}`];
          
          const detailOutput = await runCommand(YT_DLP_PATH, detailArgs);
          const detailInfo = JSON.parse(detailOutput);

          // Find the highest quality thumbnail
          let bestThumbnail = '';
          if (detailInfo.thumbnails && detailInfo.thumbnails.length > 0) {
            const sortedThumbnails = detailInfo.thumbnails.sort((a, b) => {
              const aSize = (a.width || 0) * (a.height || 0);
              const bSize = (b.width || 0) * (b.height || 0);
              return bSize - aSize;
            });
            bestThumbnail = sortedThumbnails[0].url;
          }

          // Calculate time components
          const duration = detailInfo.duration;
          const seconds = duration % 60;
          const minutes = Math.floor(duration / 60) % 60;
          const hours = Math.floor(duration / 3600) % 24;
          const days = Math.floor(duration / 86400);

          return {
            id: video.id,
            title: detailInfo.title || video.title,
            description: detailInfo.description || '',
            url: `https://www.youtube.com/watch?v=${video.id}`,
            duration: {
              total_seconds: duration,
              seconds: seconds,
              minutes: minutes,
              hours: hours,
              days: days,
              formatted: `${days > 0 ? days + 'd ' : ''}${hours > 0 ? hours + 'h ' : ''}${minutes}m ${seconds}s`
            },
            upload_time: {
              date: detailInfo.upload_date,
              timestamp: detailInfo.timestamp,
              formatted: new Date(detailInfo.timestamp * 1000).toISOString()
            },
            thumbnail: bestThumbnail,
            view_count: detailInfo.view_count || 0,
            like_count: detailInfo.like_count || 0
          };
        } catch (error) {
          console.error(`Error fetching details for video ${video.id}:`, error.message);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      filteredVideos.push(...batchResults.filter(v => v !== null));
      
      // Log progress every batch
      console.log(`Processed ${Math.min(i + batchSize, candidateVideos.length)}/${candidateVideos.length} videos`);
    }

    console.log(`Successfully fetched ${filteredVideos.length} videos with full details`);

    res.json({
      channel_url: channelUrl,
      total_videos_found: allVideos.length,
      total_matching_criteria: candidateVideos.length,
      videos_returned: filteredVideos.length,
      videos: filteredVideos
    });

  } catch (error) {
    console.error(`Error fetching channel videos:`, error.message);
    res.status(500).json({ error: 'Failed to fetch channel videos', details: error.message });
  }
});

// Progress tracking endpoint - Get status of a download job
app.get('/v1/download/progress/:jobId', authenticateKey, (req, res) => {
  const { jobId } = req.params;
  const job = activeJobs.get(jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  res.json(job);
});

// Streaming download endpoint with real-time progress
app.post('/v1/download', authenticateKey, async (req, res) => {
  const { url, format_id } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'Missing "url" in request body' });
  }
  
  const jobId = uuidv4();
  const tempDir = path.join(__dirname, 'temp', jobId);
  
  // Initialize job tracking
  activeJobs.set(jobId, {
    jobId,
    status: 'initializing',
    progress: 0,
    stage: 'Starting download...',
    url,
    format_id
  });

  try {
    await fs.promises.mkdir(tempDir, { recursive: true });
    
    // Broadcast initial status
    broadcastProgress(jobId, activeJobs.get(jobId));
    
    console.log(`[${jobId}] Starting download for URL: ${url}`);
    
    // Format selection - avoid HLS/fragmented streams, prefer progressive downloads
    // Filter out manifest formats and prefer non-fragmented streams
    let formatSelector;
    if (format_id) {
      // Try selected format with audio, fallback to safer options
      formatSelector = `${format_id}+bestaudio/bestvideo[protocol!*=m3u8][protocol!=http_dash_segments]+bestaudio/best[protocol!*=m3u8][protocol!=http_dash_segments]`;
    } else {
      // Prefer non-fragmented formats with both video and audio
      formatSelector = 'bestvideo[protocol!*=m3u8][protocol!=http_dash_segments][ext=mp4]+bestaudio[ext=m4a]/best[protocol!*=m3u8][protocol!=http_dash_segments]';
    }
    const outputTemplate = path.join(tempDir, '%(title)s.%(ext)s');
    
    console.log(`[${jobId}] Downloading with format: ${formatSelector}`);
    
    // Download with real-time progress - add options to bypass YouTube restrictions
    const ytdlpArgs = cookiesExist 
      ? ['--cookies', COOKIES_PATH, '-f', formatSelector, '--merge-output-format', 'mp4', '--postprocessor-args', 'Merger+ffmpeg:-c:v copy -c:a aac -b:a 40k', '--extractor-args', 'youtube:player_client=ios,web', '--user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15', '--newline', '--progress', '-o', outputTemplate, url]
      : ['-f', formatSelector, '--merge-output-format', 'mp4', '--postprocessor-args', 'Merger+ffmpeg:-c:v copy -c:a aac -b:a 40k', '--extractor-args', 'youtube:player_client=ios,web', '--user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15', '--newline', '--progress', '-o', outputTemplate, url];
    const ytdlp = spawn(YT_DLP_PATH, ytdlpArgs);
    
    let downloadedFile = null;
    
    // Parse progress from yt-dlp output
    ytdlp.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[${jobId}] ${output.trim()}`);
      
      // Parse download progress
      const downloadMatch = output.match(/\[download\]\s+(\d+\.?\d*)%/);
      const sizeMatch = output.match(/\[download\]\s+[\d.]+%\s+of\s+~?\s*([\d.]+\w+)/);
      const etaMatch = output.match(/ETA\s+([\d:]+)/);
      const destMatch = output.match(/\[download\] Destination: (.+)/);
      const mergerMatch = output.match(/\[Merger\] Merging formats into "(.+)"/);
      
      if (destMatch) {
        downloadedFile = destMatch[1].trim();
      }
      
      // Update to merged filename if merge happens
      if (mergerMatch) {
        downloadedFile = mergerMatch[1].trim();
        console.log(`[${jobId}] Merged file will be: ${downloadedFile}`);
      }
      
      if (downloadMatch) {
        const progress = parseFloat(downloadMatch[1]);
        const jobUpdate = {
          ...activeJobs.get(jobId),
          status: 'downloading',
          progress: Math.min(progress, 99),
          stage: `Downloading: ${progress.toFixed(1)}%`
        };
        
        if (sizeMatch) {
          jobUpdate.totalSize = sizeMatch[1];
        }
        if (etaMatch) {
          jobUpdate.eta = etaMatch[1];
        }
        
        activeJobs.set(jobId, jobUpdate);
        broadcastProgress(jobId, jobUpdate);
      }
    });
    
    ytdlp.stderr.on('data', (data) => {
      console.log(`[${jobId}] ${data.toString().trim()}`);
    });
    
    ytdlp.on('close', async (code) => {
      if (code === 0 && downloadedFile) {
        try {
          console.log(`[${jobId}] Download completed, sending file: ${downloadedFile}`);
          
          activeJobs.set(jobId, {
            ...activeJobs.get(jobId),
            status: 'streaming',
            progress: 100,
            stage: 'Sending to browser...'
          });
          broadcastProgress(jobId, activeJobs.get(jobId));
          
          // Stream file to browser
          const fileStats = await fs.promises.stat(downloadedFile);
          const filename = path.basename(downloadedFile);
          
          res.setHeader('Content-Type', 'video/mp4');
          res.setHeader('Content-Length', fileStats.size);
          res.setHeader('X-Job-ID', jobId);
          
          const asciiSafeName = filename.replace(/[^\x20-\x7E]/g, '_');
          const encodedFilename = encodeURIComponent(filename).replace(/['()]/g, escape).replace(/\*/g, '%2A');
          res.setHeader('Content-Disposition', `attachment; filename="${asciiSafeName}"; filename*=UTF-8''${encodedFilename}`);
          
          const fileStream = fs.createReadStream(downloadedFile);
          fileStream.pipe(res);
          
          fileStream.on('end', () => {
            console.log(`[${jobId}] File sent successfully`);
            activeJobs.set(jobId, {
              ...activeJobs.get(jobId),
              status: 'completed',
              progress: 100,
              stage: 'Download complete!'
            });
            broadcastProgress(jobId, activeJobs.get(jobId));
            
            // Clean up
            fs.rm(tempDir, { recursive: true, force: true }, () => {});
            setTimeout(() => activeJobs.delete(jobId), 5 * 60 * 1000);
          });
          
          fileStream.on('error', (err) => {
            console.error(`[${jobId}] Stream error:`, err);
            fs.rm(tempDir, { recursive: true, force: true }, () => {});
          });
          
        } catch (error) {
          console.error(`[${jobId}] Error sending file:`, error);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to send downloaded file' });
          }
          fs.rm(tempDir, { recursive: true, force: true }, () => {});
        }
      } else {
        console.error(`[${jobId}] Download failed with code ${code}`);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Download failed' });
        }
        activeJobs.set(jobId, {
          ...activeJobs.get(jobId),
          status: 'failed',
          stage: 'Download failed',
          error: `yt-dlp exited with code ${code}`
        });
        broadcastProgress(jobId, activeJobs.get(jobId));
        fs.rm(tempDir, { recursive: true, force: true }, () => {});
      }
    });

  } catch (error) {
    console.error(`[${jobId}] An error occurred:`, error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'An internal server error occurred during video processing.' });
    }
    activeJobs.set(jobId, {
      ...activeJobs.get(jobId),
      status: 'failed',
      stage: 'Failed',
      error: error.message
    });
    broadcastProgress(jobId, activeJobs.get(jobId));
    fs.rm(tempDir, { recursive: true, force: true }, () => {});
  }
});

// Health check endpoint for monitoring
app.get('/health', async (req, res) => {
  try {
    const dbCheck = await db.select().from(apiKeys).limit(1);
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected',
      activeDownloads: activeJobs.size,
      queueStatus: downloadManager.getQueueStatus()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// System information endpoint (admin only)
app.get('/v1/system/info', authenticateKey, async (req, res) => {
  try {
    const systemInfo = await getSystemInfo();
    const queueStatus = downloadManager.getQueueStatus();
    
    res.json({
      ...systemInfo,
      downloads: queueStatus,
      env: {
        nodeEnv: process.env.NODE_ENV || 'development',
        maxConcurrentDownloads: downloadManager.maxConcurrentDownloads,
        maxDownloadSpeedMbps: downloadManager.maxDownloadSpeedMbps,
        configuredMaxConcurrent: process.env.MAX_CONCURRENT_DOWNLOADS || '5 (default)'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update yt-dlp endpoint (admin only)
app.post('/v1/system/update/ytdlp', authenticateKey, async (req, res) => {
  try {
    const result = await updateYtDlp();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update Node packages endpoint (admin only)
app.post('/v1/system/update/packages', authenticateKey, async (req, res) => {
  try {
    const result = await updateNodePackages();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get download queue status
app.get('/v1/downloads/queue', (req, res) => {
  res.json(downloadManager.getQueueStatus());
});

// Broadcast progress to WebSocket clients
const broadcastProgress = (jobId, progress) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client.jobId === jobId) {
      client.send(JSON.stringify(progress));
    }
  });
};

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'subscribe' && data.jobId) {
        ws.jobId = data.jobId;
        console.log(`Client subscribed to job: ${data.jobId}`);
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

// Catch-all route to serve React app for any non-API routes (must be last!)
app.get('*', (req, res) => {
  // Only serve index.html if the dist folder exists and it's not an API route
  if (!req.path.startsWith('/v1') && fs.existsSync(path.join(distPath, 'index.html'))) {
    res.sendFile(path.join(distPath, 'index.html'));
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT}`);
  console.log(`WebSocket server is running on ws://${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});