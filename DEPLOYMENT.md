# Deployment Guide for VPS/AWS

This guide will help you deploy the Video Download API to a VPS or AWS EC2 instance.

## Prerequisites

- Ubuntu/Debian-based Linux server
- Node.js 18+ installed
- Python 3.8+ installed
- At least 2GB RAM
- 10GB+ storage space

## Quick Deployment Steps

### 1. System Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Python and pip
sudo apt install -y python3 python3-pip

# Install yt-dlp
python3 -m pip install yt-dlp

# Install ffmpeg
sudo apt install -y ffmpeg
```

### 2. Clone and Setup Project

```bash
# Clone your repository
git clone <your-repo-url>
cd <project-directory>

# Install Node dependencies
npm install

# Copy and configure environment variables
cp .env.example .env
nano .env  # Edit as needed
```

### 3. Configure Environment Variables

Edit `.env` file:

```bash
PORT=4000
NODE_ENV=production
MAX_CONCURRENT_DOWNLOADS=10
MAX_DOWNLOAD_SPEED_MBPS=50
```

### 4. Database Setup

The application uses SQLite with a local database file (`local.db`). No additional setup required.

```bash
# Push database schema
npm run db:push
```

### 5. Run as a Service (systemd)

Create a systemd service file:

```bash
sudo nano /etc/systemd/system/video-api.service
```

Add the following content:

```ini
[Unit]
Description=Video Download API Server
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/video-api
Environment="NODE_ENV=production"
Environment="PORT=4000"
ExecStart=/usr/bin/node /home/ubuntu/video-api/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable video-api
sudo systemctl start video-api
sudo systemctl status video-api
```

### 6. Nginx Reverse Proxy (Optional but Recommended)

Install Nginx:

```bash
sudo apt install -y nginx
```

Create Nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/video-api
```

Add configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /v1 {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /health {
        proxy_pass http://localhost:4000/health;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/video-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 7. SSL Certificate (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## AWS-Specific Configuration

### Security Group Rules

Open the following ports in your AWS EC2 Security Group:

- Port 80 (HTTP)
- Port 443 (HTTPS)
- Port 22 (SSH)
- Port 4000 (API - only if not using Nginx)
- Port 5000 (Frontend - only if not using Nginx)

### Elastic IP (Optional)

Allocate and associate an Elastic IP to your EC2 instance for a static IP address.

## Monitoring and Maintenance

### View Logs

```bash
# Application logs
sudo journalctl -u video-api -f

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Health Check

```bash
curl http://localhost:4000/health
```

### Update yt-dlp

```bash
# Via API
curl -X POST http://localhost:4000/v1/system/update/ytdlp

# Or manually
python3 -m pip install --upgrade yt-dlp
```

### Backup Database

```bash
# Backup SQLite database
cp local.db local.db.backup.$(date +%Y%m%d)
```

## Performance Tuning

### Increase File Descriptors

```bash
sudo nano /etc/security/limits.conf
```

Add:

```
* soft nofile 65536
* hard nofile 65536
```

### PM2 Alternative (Process Manager)

Instead of systemd, you can use PM2:

```bash
npm install -g pm2

# Start both servers
pm2 start server.js --name video-api-backend
pm2 start "npm run dev" --name video-api-frontend

# Save configuration
pm2 save
pm2 startup
```

## Troubleshooting

### Port Already in Use

```bash
sudo lsof -i :4000
sudo kill -9 <PID>
```

### Database Locked

```bash
# Stop the service
sudo systemctl stop video-api

# Check for locks
lsof | grep local.db

# Restart
sudo systemctl start video-api
```

### Out of Memory

Increase swap space:

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## Security Best Practices

1. **Firewall**: Use UFW to restrict access
   ```bash
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

2. **API Key Management**: Regularly rotate API keys

3. **Rate Limiting**: Configure appropriate rate limits in `.env`

4. **Updates**: Keep system and packages updated
   ```bash
   sudo apt update && sudo apt upgrade -y
   npm update
   ```

5. **Monitoring**: Set up monitoring with tools like:
   - CloudWatch (AWS)
   - Uptime Robot
   - New Relic

## Scaling

For high-traffic deployments:

1. **Load Balancer**: Use AWS ELB or Nginx load balancing
2. **Multiple Instances**: Run multiple API instances
3. **Caching**: Implement Redis for caching
4. **CDN**: Use CloudFront or Cloudflare for static assets

## Support

For issues or questions, check:
- Application logs: `sudo journalctl -u video-api`
- Health endpoint: `curl http://localhost:4000/health`
- System info: `curl http://localhost:4000/v1/system/info`
