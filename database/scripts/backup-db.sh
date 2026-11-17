#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-$HOME/laundry-backups}"
DB_NAME="${DB_NAME:-laundry_manager}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
MYSQL_LOGIN_PATH="${MYSQL_LOGIN_PATH:-laundry_backup}"

if [[ ! "$DB_NAME" =~ ^[A-Za-z0-9_]+$ ]]; then
  echo "DB_NAME sólo puede contener letras, números y guion bajo." >&2
  exit 1
fi
if [[ ! "$RETENTION_DAYS" =~ ^[0-9]+$ ]] || (( RETENTION_DAYS < 1 )); then
  echo "RETENTION_DAYS debe ser un entero positivo." >&2
  exit 1
fi

mkdir -p -- "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_$(date +%F_%H%M%S)_$$.sql"
TEMP_FILE="$(mktemp "$BACKUP_DIR/.${DB_NAME}_XXXXXX")"

cleanup() {
  if [[ -n "$TEMP_FILE" && -f "$TEMP_FILE" ]]; then
    rm -f -- "$TEMP_FILE"
  fi
}
trap cleanup EXIT

mysqldump --login-path="$MYSQL_LOGIN_PATH" --single-transaction --routines --triggers "$DB_NAME" > "$TEMP_FILE"
if [[ ! -s "$TEMP_FILE" ]]; then
  echo "mysqldump no produjo un respaldo válido." >&2
  exit 1
fi
chmod 600 "$TEMP_FILE"
mv -- "$TEMP_FILE" "$BACKUP_FILE"
TEMP_FILE=""
chmod 600 "$BACKUP_FILE"
find "$BACKUP_DIR" -maxdepth 1 -type f -name "${DB_NAME}_*.sql" -mtime "+$RETENTION_DAYS" -delete
echo "Respaldo creado: $BACKUP_FILE"
echo "Copia este archivo a un destino seguro fuera de esta VM y prueba su restauración periódicamente."
