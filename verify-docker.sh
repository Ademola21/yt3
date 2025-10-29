#!/bin/bash
# Quick script to verify Dockerfile setup locally (optional)

echo "🔍 Verifying Dockerfile configuration..."
echo ""

if [ ! -f "Dockerfile" ]; then
    echo "❌ Dockerfile not found!"
    exit 1
fi

echo "✅ Dockerfile exists"

# Check if key components are in Dockerfile
if grep -q "python3" Dockerfile && grep -q "pip3 install.*yt-dlp" Dockerfile; then
    echo "✅ Python and yt-dlp installation found in Dockerfile"
else
    echo "❌ Missing Python or yt-dlp installation in Dockerfile"
    exit 1
fi

if grep -q 'ENV PATH="/usr/local/bin' Dockerfile; then
    echo "✅ PATH configuration found in Dockerfile"
else
    echo "❌ PATH configuration missing in Dockerfile"
    exit 1
fi

echo ""
echo "✅ Dockerfile configuration looks good!"
echo ""
echo "📦 To test build locally (requires Docker installed):"
echo "   docker build -t video-api-test ."
echo ""
echo "🚀 To deploy to DigitalOcean:"
echo "   git add Dockerfile .dockerignore"
echo "   git commit -m 'Add Dockerfile with yt-dlp'"
echo "   git push"
