#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-$HOME/laundry-backups}"
DB_NAME="${DB_NAME:-laundry_manager}"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_$(date +%F_%H%M%S).sql"

mysqldump --single-transaction --routines --triggers -u "${DB_USER:-root}" -p "$DB_NAME" > "$BACKUP_FILE"
chmod 600 "$BACKUP_FILE"
echo "Respaldo creado: $BACKUP_FILE"
echo "Copia este archivo a un destino seguro fuera de esta VM."
