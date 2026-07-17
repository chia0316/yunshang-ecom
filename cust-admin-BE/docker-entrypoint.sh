#!/bin/sh
set -e

echo "Waiting for database at ${DB_HOST:-db}:${DB_PORT:-5432}..."
attempt=0
until node -e "require('net').connect({host: process.env.DB_HOST || 'db', port: process.env.DB_PORT || 5432}).on('connect', () => process.exit(0)).on('error', () => process.exit(1))"; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    echo "Database did not become reachable in time." >&2
    exit 1
  fi
  sleep 2
done
echo "Database is reachable."

echo "Running migrations..."
npx sequelize-cli db:migrate

exec "$@"
