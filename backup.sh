#!/bin/bash
# Dumps the Postgres database to ./backups/ with a dated filename, and
# deletes dumps older than 14 days. Set up as a daily cron job (see
# DEPLOY.md) since the database is only stored in a Docker volume.
set -e

cd "$(dirname "$0")"
source ./load-env.sh

mkdir -p backups
timestamp=$(date +%Y%m%d-%H%M%S)
filename="backups/yunshang-${timestamp}.sql.gz"

docker compose exec -T db pg_dump -U "$DB_USERNAME" "$DB_NAME" | gzip > "$filename"
echo "Backup written to $filename"

find backups -name "yunshang-*.sql.gz" -mtime +14 -delete
