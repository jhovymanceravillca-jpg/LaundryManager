#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$HOME/LaundryManager/backend}"
sudo apt-get update
sudo apt-get install -y nodejs npm
sudo npm install -g pm2
cd "$PROJECT_DIR"
npm ci
npm run build
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup
