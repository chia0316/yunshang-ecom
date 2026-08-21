#!/bin/bash
# Renews the Let's Encrypt certificate if it's due (certbot no-ops
# otherwise — safe to run daily) and reloads nginx so it picks up the
# renewed cert. Set up as a daily cron job — see DEPLOY.md.
set -e

cd "$(dirname "$0")"

docker compose run --rm certbot renew --quiet
docker compose exec nginx nginx -s reload
