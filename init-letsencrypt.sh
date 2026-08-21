#!/bin/bash
# One-time bootstrap for the yunshang.com.sg Let's Encrypt certificate.
# Run this ONCE on the droplet — after DNS for $DOMAIN already points at
# this droplet's IP, and after `docker compose up -d` has been run at least
# once (so the cust-fe/nginx/certbot images are built).
#
# Renewal afterward is handled by renew-cert.sh via cron (see DEPLOY.md) —
# this script is only for getting the very first certificate, working
# around the chicken-and-egg problem of nginx needing a cert to start its
# HTTPS server block before certbot (which needs nginx running on port 80
# to serve the ACME challenge) can issue one: it starts nginx with a
# throwaway dummy cert first, then swaps in the real one.
set -e

cd "$(dirname "$0")"

source ./load-env.sh

if [ -z "$DOMAIN" ]; then
  echo "DOMAIN is not set in .env" >&2
  exit 1
fi
if [ -z "$CERTBOT_EMAIL" ]; then
  echo "CERTBOT_EMAIL is not set in .env" >&2
  exit 1
fi

echo "### Creating a dummy certificate for $DOMAIN so nginx can start ..."
docker compose run --rm --entrypoint sh certbot -c "
  mkdir -p /etc/letsencrypt/live/$DOMAIN &&
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout /etc/letsencrypt/live/$DOMAIN/privkey.pem \
    -out /etc/letsencrypt/live/$DOMAIN/fullchain.pem \
    -subj '/CN=localhost'
"

echo "### Starting nginx ..."
docker compose up -d nginx

echo "### Deleting dummy certificate for $DOMAIN ..."
docker compose run --rm --entrypoint sh certbot -c "
  rm -rf /etc/letsencrypt/live/$DOMAIN &&
  rm -rf /etc/letsencrypt/archive/$DOMAIN &&
  rm -rf /etc/letsencrypt/renewal/$DOMAIN.conf
"

echo "### Requesting the real Let's Encrypt certificate for $DOMAIN ..."
STAGING_ARG=""
if [ "${STAGING:-0}" != "0" ]; then
  echo "(using Let's Encrypt STAGING — cert won't be trusted by browsers, for dry-running this script only)"
  STAGING_ARG="--staging"
fi

docker compose run --rm certbot certonly \
  --webroot --webroot-path /var/www/certbot \
  $STAGING_ARG \
  --email "$CERTBOT_EMAIL" \
  -d "$DOMAIN" -d "www.$DOMAIN" \
  --rsa-key-size 2048 \
  --agree-tos \
  --no-eff-email \
  --force-renewal

echo "### Reloading nginx ..."
docker compose exec nginx nginx -s reload

echo "Done. https://$DOMAIN should now be serving a real certificate."
