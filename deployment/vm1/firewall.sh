#!/usr/bin/env bash
set -euo pipefail

ADMIN_CIDR="${ADMIN_CIDR:?Define ADMIN_CIDR con la red administrativa antes de continuar}"
USER_CIDR="${USER_CIDR:?Define USER_CIDR con la red autorizada para acceder al sitio}"

sudo ufw allow from "$ADMIN_CIDR" to any port 22 proto tcp
sudo ufw allow from "$USER_CIDR" to any port 80 proto tcp
if [[ "${ENABLE_HTTPS:-false}" == "true" ]]; then
  sudo ufw allow from "$USER_CIDR" to any port 443 proto tcp
fi
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw --force enable
sudo ufw status verbose
