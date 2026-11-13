#!/usr/bin/env bash
set -euo pipefail

ADMIN_CIDR="${ADMIN_CIDR:?Define ADMIN_CIDR con la red administrativa antes de continuar}"
API_IP="${API_IP:-10.77.0.20}"

sudo ufw allow from "$ADMIN_CIDR" to any port 22 proto tcp
sudo ufw allow from "$API_IP" to any port 3306 proto tcp
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw --force enable
sudo ufw status verbose
