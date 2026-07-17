#!/bin/bash
# Run this on the droplet whenever you've pushed new code, to rebuild and
# restart everything with zero manual steps. Migrations run automatically
# via docker-entrypoint.sh on backend startup.
set -e

cd "$(dirname "$0")"

if [ -d .git ]; then
  echo "Pulling latest code..."
  git pull
else
  echo "No git repo here — assuming code was already copied over (e.g. via rsync)."
fi

echo "Rebuilding and restarting containers..."
docker compose up -d --build

echo "Done. Recent backend logs:"
docker compose logs --tail=30 backend
