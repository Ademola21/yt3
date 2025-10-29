# Use official Node.js 20 image (matching Replit's Node version)
FROM node:20-bullseye

# Install Python 3, pip, and ffmpeg (matching Replit's environment)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp via pip globally (same as Replit)
RUN pip3 install --no-cache-dir --upgrade pip && \
    pip3 install --no-cache-dir yt-dlp && \
    chmod +x /usr/local/bin/yt-dlp && \
    ln -sf /usr/local/bin/yt-dlp /usr/bin/yt-dlp

# Add pip bin to PATH and verify installations
ENV PATH="/usr/local/bin:${PATH}"
RUN node --version && \
    python3 --version && \
    echo "=== Checking pip installation ===" && \
    python3 -m pip show yt-dlp && \
    echo "=== Checking which yt-dlp ===" && \
    which yt-dlp && \
    echo "=== Checking yt-dlp version ===" && \
    yt-dlp --version && \
    echo "=== Checking file permissions ===" && \
    ls -la /usr/local/bin/ | grep yt-dlp && \
    echo "=== Checking symlink ===" && \
    ls -la /usr/bin/ | grep yt-dlp && \
    echo "=== Testing yt-dlp execution ===" && \
    /usr/local/bin/yt-dlp --version && \
    echo "=== Checking ffmpeg ===" && \
    ffmpeg -version && \
    echo "yt-dlp installation verified successfully"

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Build the frontend
RUN npm run build

# Expose port (DigitalOcean uses 8080 by default)
EXPOSE 8080

# Set environment to production
ENV NODE_ENV=production
ENV PORT=8080

# Start the application
CMD ["node", "server.js"]
