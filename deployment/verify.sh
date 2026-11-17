#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://192.168.56.20:3000}"
DB_HOST="${DB_HOST:-192.168.56.30}"

echo "Comprobando API..."
curl --fail --silent --show-error "$API_URL/api/health"
echo
echo "Comprobando puerto MySQL desde esta máquina (solo VM2 debe tener acceso)..."
if timeout 3 bash -c "</dev/tcp/$DB_HOST/3306"; then
  echo "MySQL accesible desde este origen."
else
  echo "MySQL no accesible desde este origen; revisa servicio y firewall." >&2
  exit 1
fi
