#!/usr/bin/env bash
set -e

echo "🚀 Installing LeadWeave WhatsApp API Gateway..."

# 1. Install prerequisites if missing (Debian/Ubuntu)
if command -v apt-get >/dev/null 2>&1; then
  echo "📦 Updating system packages & dependencies..."
  sudo apt-get update -qq
  sudo apt-get install -y -qq curl git ffmpeg build-essential chromium fonts-liberation libnss3 libatk-bridge2.0-0 libgtk-3-0 libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libasound2 >/dev/null 2>&1 || true
  
  if ! command -v node >/dev/null 2>&1; then
    echo "🟢 Installing Node.js 22..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - >/dev/null 2>&1
    sudo apt-get install -y -qq nodejs >/dev/null 2>&1
  fi
fi

# 2. Check/Clone repository
if [ ! -f "package.json" ]; then
  echo "📥 Cloning LeadWeave..."
  git clone https://github.com/arun-sanu/LeadWeave.git leadweave
  cd leadweave
fi

# 3. Install & Build
echo "⚡ Installing app dependencies & building..."
npm install
npm run build:all

# 4. Optional / Automated HTTPS & Caddy Setup for leadweave.local
if command -v apt-get >/dev/null 2>&1; then
  if ! command -v caddy >/dev/null 2>&1; then
    echo "🔒 Installing Caddy for local HTTPS..."
    sudo apt-get update -qq >/dev/null 2>&1 || true
    sudo apt-get install -y -qq caddy libnss3-tools >/dev/null 2>&1 || true
  fi
fi

TARGET_URL="http://localhost:2785"
if command -v caddy >/dev/null 2>&1; then
  echo "🔒 Configuring local HTTPS (https://leadweave.local)..."
  if ! grep -q "leadweave.local" /etc/hosts 2>/dev/null; then
    echo "127.0.0.1 leadweave.local" | sudo tee -a /etc/hosts >/dev/null || true
  fi
  if [ -f "Caddyfile" ]; then
    sudo cp Caddyfile /etc/caddy/Caddyfile 2>/dev/null || true
    sudo systemctl reload caddy 2>/dev/null || true
  fi
  sudo caddy trust 2>/dev/null || true
  TARGET_URL="https://leadweave.local"
fi

# 5. Create Desktop Shortcut
echo "🖥️ Creating Desktop icon..."
node scripts/create-shortcut.js "$TARGET_URL" || true

echo "🎉 LeadWeave setup complete! Starting server..."
echo "🌐 Dashboard will be available at: $TARGET_URL"
npm start
