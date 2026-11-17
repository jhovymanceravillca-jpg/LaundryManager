#!/usr/bin/env bash
set -euo pipefail

BACKUP_FILE="${1:?Uso: verify-backup.sh RUTA_DEL_RESPALDO}"
MYSQL_LOGIN_PATH="${MYSQL_LOGIN_PATH:-laundry_backup}"

if [[ ! -f "$BACKUP_FILE" || ! -s "$BACKUP_FILE" ]]; then
  echo "El archivo de respaldo no existe o está vacío." >&2
  exit 1
fi

TEST_DB="laundry_restore_test_$(date +%Y%m%d_%H%M%S)_$$"
database_created=false

cleanup() {
  if [[ "$database_created" == "true" ]] &&
      ! mysql --login-path="$MYSQL_LOGIN_PATH" -e "DROP DATABASE IF EXISTS \`$TEST_DB\`"; then
    echo "No se pudo eliminar la base temporal $TEST_DB; elimínala manualmente tras revisarla." >&2
  fi
}
trap cleanup EXIT

mysql --login-path="$MYSQL_LOGIN_PATH" \
  -e "CREATE DATABASE \`$TEST_DB\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci"
database_created=true
mysql --login-path="$MYSQL_LOGIN_PATH" "$TEST_DB" < "$BACKUP_FILE"

table_count="$(mysql --login-path="$MYSQL_LOGIN_PATH" --batch --skip-column-names \
  -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$TEST_DB' AND table_name IN ('users', 'customers', 'orders', 'payments')")"
if [[ ! "$table_count" =~ ^[0-9]+$ ]] || (( table_count != 4 )); then
  echo "La restauración no contiene todas las tablas principales (users, customers, orders, payments)." >&2
  exit 1
fi

mysql --login-path="$MYSQL_LOGIN_PATH" --table "$TEST_DB" \
  -e "SELECT 'users' AS tabla, COUNT(*) AS registros FROM users UNION ALL SELECT 'customers', COUNT(*) FROM customers UNION ALL SELECT 'orders', COUNT(*) FROM orders UNION ALL SELECT 'payments', COUNT(*) FROM payments"
echo "Restauración verificada en $TEST_DB; la base temporal se eliminará al terminar."
