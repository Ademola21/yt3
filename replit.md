# Video Download API Dashboard - Production-Ready with Security & Monitoring

## Overview
This is a production-ready, full-stack video download and processing application with comprehensive security, monitoring, and admin capabilities. Features include API key management with rate limiting, request tracking, system monitoring, auto-updates, and VPS/AWS deployment support.

## Purpose
- **Secure API Management**: Generate and manage hashed API keys with rate limiting and request tracking
- **Admin Dashboard**: Monitor system health, API usage, and manage keys with real-time analytics
- **Video Processing**: Download and merge video content with high-quality audio (libfdk-aac codec)
- **Production-Ready**: Queue management, concurrent download limits, health checks, and auto-updates
- **VPS/AWS Compatible**: Full deployment guide with systemd, nginx, and SSL support

## Project Architecture

### Frontend (Port 5000)
- **Technology**: React + TypeScript + Vite
- **Features**:
  - API Key Management tab for generating new API keys
  - API Tester tab for testing video downloads
  - Documentation tab with integration examples
- **Host**: 0.0.0.0 (to support Replit's proxy system)
- **Proxy**: Vite dev server proxies `/v1/*` requests to backend at localhost:4000

### Backend (Port 4000)
- **Technology**: Node.js + Express
- **Host**: localhost
- **Endpoints**:
  - `GET /v1/keys` - Retrieve all API keys from database
  - `POST /v1/keys` - Generate new API keys (open for development)
  - `POST /v1/formats` - Get available video formats with file sizes (requires API key authentication)
  - `POST /v1/download` - Stream download with instant start (requires API key authentication)
  - `GET /v1/download/progress/:jobId` - Get download progress (polling method)
  - `WebSocket ws://host:port` - Real-time progress updates via WebSocket
- **Database**: SQLite for persistent storage (local.db file)
  - API keys stored in `api_keys` table with automatic timestamps
  - Uses Drizzle ORM for database operations
  - Database file travels with project for easy VPS portability
- **Dependencies**:
  - `yt-dlp` - Python package for downloading videos
  - `ffmpeg-for-homebridge` - Custom FFmpeg build with libfdk-aac support

### Custom FFmpeg
Uses a specialized FFmpeg build from `ffmpeg-for-homebridge` (v2.2.0) that includes:
- libfdk-aac encoder for high-quality HE-AAC audio
- Static build optimized for video processing
- Located at: `node_modules/ffmpeg-for-homebridge/ffmpeg`

## Production-Ready Features (Latest)

- **2025-10-28**: Implemented comprehensive security and monitoring system
  - **API Key Security**: SHA-256 hashing, keys shown once then hashed in database
  - **Rate Limiting**: Configurable per-key rate limits (default 60/min) with X-RateLimit headers
  - **Request Logging**: Tracks all API calls (endpoint, method, status, response time, IP, user agent)
  - **Authentication**: All admin endpoints now require valid API key authentication
  - **Bootstrap System**: Secure first-key creation with /v1/keys/bootstrap endpoint (works once)
  - **Request Tracking**: Dedicated request_logs table with foreign key cascade delete
  - **API Statistics**: Per-key usage stats with endpoint breakdown and recent request history
  - **Admin Dashboard**: Real-time system health, API key management, usage analytics
  - **Download Queue**: Production queue system with configurable concurrent download limits
  - **Self-Updating**: Auto-update endpoints for yt-dlp and npm packages
  - **Health Checks**: /health endpoint for monitoring and load balancer integration
  - **System Info**: /v1/system/info for version tracking and update availability
  - **VPS/AWS Deployment**: Complete deployment guide with systemd, nginx, SSL (see DEPLOYMENT.md)
  - **Environment Config**: .env.example with production settings

## Recent Changes

- **2025-10-27**: Added YouTube cookies integration and real-time progress tracking
  - **YouTube Cookies**: Integrated YouTube cookies for authenticated downloads
    - Supports age-restricted and members-only content
    - Bypasses "Sign in to confirm you're not a bot" restrictions
    - Cookies file stored in `youtube-cookies.txt` (excluded from git)
    - Works with HLS/m3u8 combined formats (SABR streaming)
  - **Instant Download Start**: Complete architecture redesign for instant browser downloads
    - Downloads now start within 2-5 seconds (previously 2+ minutes for large files)
    - yt-dlp streams directly to browser using stdout piping
    - No intermediate server storage during download
    - Uses chunked transfer encoding for immediate response
  - **Real-Time Progress Tracking**: Added WebSocket support for live progress updates
    - WebSocket server on same port as HTTP (port 4000)
    - Clients can subscribe to specific job IDs for progress updates
    - Progress includes: status, percentage, download stage, ETA, file size
    - Broadcasts real-time updates as yt-dlp downloads
  - **Progress Polling API**: Added REST endpoint for progress tracking
    - `GET /v1/download/progress/:jobId` for polling-based monitoring
    - Works with curl, shell scripts, and non-WebSocket clients
    - Job tracking stored in memory with automatic cleanup after 5 minutes
  - **Enhanced API Documentation**: Created comprehensive API_USAGE.md
    - JavaScript examples for WebSocket and fetch API
    - Bash/curl examples for CLI users
    - Browser integration examples
    - Complete API reference with all endpoints

## Recent Changes (Archive)
- **2025-10-24**: Initial setup in Replit environment
  - Configured Vite to use port 5000 with allowedHosts for proxy support
  - Set up backend to use localhost:4000
  - Installed Python 3.11 and yt-dlp for video downloads
  - Configured custom FFmpeg with libfdk-aac support via npm package
  - Updated API endpoints to use relative URLs with Vite proxy
  - Added comprehensive .gitignore for temp files and Python artifacts

- **2025-10-24**: Migrated API key storage to PostgreSQL database
  - Created PostgreSQL database with `api_keys` table
  - Installed Drizzle ORM and Neon serverless database client
  - Updated server.js to use database instead of in-memory storage
  - Added GET /v1/keys endpoint to retrieve all stored API keys
  - Updated ApiKeyManager component to fetch and display keys on mount
  - API keys now persist across server restarts and page navigations

- **2025-10-24**: Fixed workflow stop button issue
  - Created `start.sh` script with proper signal handling
  - Script now properly terminates both backend and frontend processes
  - Replit stop button now correctly stops all servers without leaving orphaned processes
  - No more manual `lsof` and `kill` commands needed

- **2025-10-24**: Migrated from PostgreSQL to SQLite for VPS portability
  - Replaced Neon PostgreSQL with SQLite local database file (`local.db`)
  - Database now travels with project when moving to VPS
  - Removed @neondatabase/serverless dependency, added better-sqlite3
  - Updated Drizzle schema to use SQLite-compatible types
  - All API keys persist in local file for easy portability

- **2025-10-24**: Fixed file size display for video formats
  - Added intelligent file size estimation for merged video+audio files
  - Correctly handles both adaptive formats (video-only) and progressive formats (video+audio)
  - For adaptive formats: Calculates video stream size + audio stream size for accurate merged total
  - For progressive formats: Uses total bitrate which already includes audio
  - When exact filesize unavailable, estimates from bitrate: (bitrate_kbps * 1000 / 8) * duration_seconds
  - File sizes now display accurate estimates instead of "Unknown"

- **2025-10-25**: Upgraded audio encoding to HE-AAC with dynamic filenames and streaming optimization
  - **HE-AAC Encoding**: Changed from AAC LC to HE-AAC (AAC LC SBR) with variable bitrate
    - FFmpeg now uses `-profile:a aac_he` for HE-AAC encoding (codec mp4a-40-5)
    - Enabled variable bitrate mode with `-vbr 2` for optimal quality at ~30kbps
    - Added English language metadata tag for audio stream
    - Audio format now matches: AAC LC SBR, VBR mode, ~30kbps, 44.1kHz
  - **Dynamic Filenames**: Downloads now use actual YouTube video title instead of generic names
    - Fetches video metadata at download start to retrieve title
    - Sanitizes filename to remove filesystem-invalid characters
    - Implements RFC 5987 encoding for Content-Disposition header
    - Supports Unicode characters, emoji, and non-Latin text in filenames
    - Provides ASCII fallback for legacy browser compatibility
  - **Streaming Optimization**: Improved download speed with file streaming
    - Changed from buffered `res.download()` to direct file streaming
    - Uses `fs.createReadStream()` piped to response for immediate transfer start
    - Sets proper HTTP headers (Content-Type, Content-Length, Content-Disposition)
    - Reduces download initiation delay from 20+ seconds to near-instant
    - Maintains proper cleanup on stream completion or error

## User Preferences
None specified yet.

## Dependencies

### Node.js Packages
- Frontend: react, react-dom, vite, @vitejs/plugin-react, typescript
- Backend: express, cors, dotenv, uuid
- Database: drizzle-orm, drizzle-kit, better-sqlite3
- Video Processing: ffmpeg-for-homebridge

### System Dependencies
- Python 3.11
- yt-dlp (Python package)
- ffmpeg (custom build from ffmpeg-for-homebridge)

### Development Workflow
- Frontend dev server runs on port 5000
- Backend API server runs on port 4000
- Both servers run concurrently via `start.sh` script
- Start script properly handles termination signals for clean shutdowns

## Important Notes
- API keys are stored in SQLite database (`local.db`) and persist across restarts
- Database file is intentionally tracked in git for portability to VPS
- When moving to VPS, simply copy entire project folder with `local.db` included
- Frontend loads existing API keys from database when component mounts
- Temporary video files are stored in `temp/` directory and cleaned up after processing
- The custom FFmpeg is essential for libfdk-aac audio codec support
- Frontend uses Vite proxy to avoid CORS issues during development
- Database schema managed with Drizzle ORM using `npm run db:push` command
- File sizes are calculated to include both video and audio streams for merged downloads
- Estimates account for adaptive (video-only) vs progressive (video+audio) format types
