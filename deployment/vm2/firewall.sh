#!/usr/bin/env bash
set -euo pipefail

ADMIN_CIDR="${ADMIN_CIDR:?Define ADMIN_CIDR con la red administrativa antes de continuar}"
WEB_IP="${WEB_IP:-192.168.56.10}"

sudo ufw allow from "$ADMIN_CIDR" to any port 22 proto tcp
sudo ufw allow from "$WEB_IP" to any port 3000 proto tcp
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw --force enable
sudo ufw status verbose
