#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$HOME/LaundryManager/frontend}"
sudo apt-get update
sudo apt-get install -y nginx nodejs npm
cd "$PROJECT_DIR"
npm ci
npm run build
sudo mkdir -p /var/www/laundry-manager
sudo cp -r dist /var/www/laundry-manager/
sudo cp ../deployment/vm1/nginx.conf /etc/nginx/sites-available/laundry-manager
sudo ln -sfn /etc/nginx/sites-available/laundry-manager /etc/nginx/sites-enabled/laundry-manager
sudo nginx -t
sudo systemctl reload nginx
