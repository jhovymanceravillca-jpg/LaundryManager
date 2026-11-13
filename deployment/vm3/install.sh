#!/usr/bin/env bash
set -euo pipefail

sudo apt-get update
sudo apt-get install -y mysql-server mysql-client
echo "Configura bind-address en /etc/mysql/mysql.conf.d/mysqld.cnf para la IP interna de esta VM."
echo "Después de confirmar la IP, reinicia: sudo systemctl restart mysql"
echo "Aplica el esquema desde la carpeta database: mysql -u root -p < schema.sql"
