# Deploying to a DigitalOcean Droplet

Everything runs via Docker Compose: Postgres, the backend API, the admin
dashboard, and the customer storefront each in their own container, on one
command. This avoids the usual manual-setup mistakes (wrong Node version,
forgetting to build, misconfigured process manager) since the exact
versions and steps are baked into the Dockerfiles.

Everything is served on one domain over HTTPS (via an nginx + Let's
Encrypt container, see step 6) — nothing is reachable by the droplet's
bare IP or by port, only through nginx:

- Storefront: `https://yunshang.com.sg`
- Admin dashboard: `https://yunshang.com.sg/admin`
- Backend API: `https://yunshang.com.sg/api`

## 1. One-time droplet setup

SSH into your droplet, then:

```bash
# Install Docker + Compose plugin (Ubuntu)
curl -fsSL https://get.docker.com | sh

# Allow the required ports through the firewall — just SSH and the two
# nginx-facing ports now; the backend and admin dashboard aren't published
# to the host at all, so they need no firewall rule of their own.
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

## 2. Get the code onto the droplet

Pick whichever is easier for you:

**Option A — rsync from your Mac (no GitHub needed):**
```bash
# Run this from your Mac, not the droplet
rsync -avz --exclude node_modules --exclude .next --exclude dist \
  /Users/ryanchia/Documents/development/yunshang/ root@<droplet-ip>:/opt/yunshang/
```

**Option B — git (recommended once you have a repo):**
```bash
# On the droplet
git clone <your-repo-url> /opt/yunshang
```
If you go this route, `./deploy.sh` will `git pull` automatically on future
deploys. With rsync, just re-run the rsync command above before `./deploy.sh`.

## 3. Configure environment variables

On the droplet:

```bash
cd /opt/yunshang
cp .env.example .env
nano .env
```

At minimum, set `DOMAIN` to your domain (e.g. `yunshang.com.sg`),
`CERTBOT_EMAIL` to an address you actually check (Let's Encrypt sends
renewal-failure notices there), `DB_PASSWORD` to a strong password, and
`SENDGRID_API_KEY` if you want emails to send (leave blank to skip emails
entirely — nothing breaks, they just won't send). The JWT secret and admin
password are already pre-filled with generated values.

Before continuing, point `DOMAIN`'s A record (and `www.DOMAIN`'s) at your
droplet's public IP with your DNS provider — DNS can take a few minutes to
propagate, so it's worth doing this now and letting it catch up while you
do the rest of this page. The IP itself isn't stored anywhere in `.env` —
it's only needed at your DNS provider.

## 4. Bring everything up

```bash
docker compose up -d --build
```

First run takes a few minutes (building all images). Migrations run
automatically on backend startup — no manual migration step needed.

`nginx` will fail to start and keep restarting right after this — that's
expected, not a bug. Its config references a certificate for `DOMAIN` that
doesn't exist until step 6 below issues one. Since nginx is the only public
entry point to all three apps now, nothing is reachable from outside the
droplet until then — that's fine, it's a short bootstrapping gap; the other
containers are still up and can be checked directly with `docker compose
exec` if needed (e.g. `docker compose exec backend wget -qO- http://localhost:8090/`).

## 5. Seed initial data (first deploy only)

```bash
docker compose run --rm backend npx sequelize-cli db:seed:all
```

This creates the admin login, default categories, delivery slots, and a
couple of sample products. Re-running this later will error on duplicate
unique fields (admin username, category names) — that's expected and
harmless, just skip it on subsequent deploys.

## 6. Get the HTTPS certificate (first deploy only)

Make sure `DOMAIN`'s DNS has propagated to your droplet's IP first (`dig
+short $DOMAIN` should return it), then:

```bash
./init-letsencrypt.sh
```

It starts `nginx` with a throwaway certificate just so it can come up,
requests the real one from Let's Encrypt, then reloads `nginx` with it.
Takes under a minute. If DNS hasn't propagated yet, this will fail with a
Let's Encrypt validation error — wait a bit and re-run it.

Set `STAGING=1 ./init-letsencrypt.sh` instead if you just want to dry-run
the flow without using up Let's Encrypt's real rate limits — it issues a
certificate browsers won't trust, so re-run without `STAGING=1` once you've
confirmed the flow works.

## 7. Verify

```bash
curl -o /dev/null -w "%{http_code}\n" https://$DOMAIN/            # 200 — storefront
curl -o /dev/null -w "%{http_code}\n" https://$DOMAIN/admin/login # 200 — admin dashboard
curl -o /dev/null -w "%{http_code}\n" https://$DOMAIN/api/category # 200 — backend, via /api
```

Then from your own machine, open `https://yunshang.com.sg` and
`https://yunshang.com.sg/admin` in a browser.

## Redeploying after code changes

```bash
./deploy.sh
```

This pulls the latest code (if using git), rebuilds only what changed, and
restarts the containers.

## Backups

Since Postgres data lives in a Docker volume on this one droplet, set up a
daily backup:

```bash
crontab -e
# add this line:
0 3 * * * /opt/yunshang/backup.sh >> /opt/yunshang/backup.log 2>&1
```

Dumps land in `/opt/yunshang/backups/`, gzipped, with anything older than 14
days cleaned up automatically. Consider periodically copying these off the
droplet (e.g. `scp` to your Mac, or DigitalOcean Spaces) — a backup that
only lives on the same disk as the database doesn't protect against a
droplet failure.

## Product images and videos

Photos uploaded via the admin panel (individually, via bulk-upload ZIP, or
referenced by SKU) live in the `backend_images` Docker volume, mounted at
`/app/public/images` inside the backend container, served at
`https://yunshang.com.sg/api/static/images/<filename>`. Product videos
(uploaded individually via the product form, max 10MB each; bulk-upload
files can be up to 500MB — see nginx's `client_max_body_size` on the `/api/`
location) live the same way in `backend_videos`, mounted at
`/app/public/videos`, served at
`https://yunshang.com.sg/api/static/videos/<filename>`. Both volumes
persist across `docker compose up --build`, but back them up too if you
care about the media (not covered by the Postgres backup script above):

```bash
docker run --rm -v yunshang_backend_images:/data -v $(pwd)/backups:/backup \
  alpine tar czf /backup/images-$(date +%Y%m%d).tar.gz -C /data .
docker run --rm -v yunshang_backend_videos:/data -v $(pwd)/backups:/backup \
  alpine tar czf /backup/videos-$(date +%Y%m%d).tar.gz -C /data .
```

## Certificate renewal

Let's Encrypt certificates expire after 90 days. Set up a daily renewal
check (certbot only actually renews within ~30 days of expiry, so a daily
no-op run the rest of the time is normal and safe):

```bash
crontab -e
# add this line:
0 4 * * * /opt/yunshang/renew-cert.sh >> /opt/yunshang/renew-cert.log 2>&1
```

## How the domain routing works

`nginx` (see `nginx/templates/default.conf.template`) is the only container
reachable from outside the droplet — the storefront, admin dashboard, and
backend have no `ports:` mapping in `docker-compose.yml` at all, they're
reached from nginx purely over Docker's internal network:

- `/` → `cust-fe` (unchanged, full path passed through)
- `/admin` → `admin-fe`, full path passed through — the admin dashboard is
  built with Next's `basePath` set to `/admin` (see
  `admin-FE/next.config.ts`, baked in via the `NEXT_PUBLIC_BASE_PATH` build
  arg), so it expects to keep seeing `/admin` in the request path itself
- `/api/` → `backend`, with the `/api/` prefix stripped before forwarding
  (the backend's own routes are a mix of `/api/...`-prefixed and bare
  `/user`, `/admin`, `/static/...` mounts — stripping just the outer `/api/`
  the location matched, rather than rewriting to a fixed path, is what
  makes both kinds resolve correctly on the other side)

If you ever need to change this (e.g. move to subdomains instead of
paths), it's all in that one template file.

Note: the template is bind-mounted, not baked into the nginx image, so
editing it takes effect only after nginx actually restarts and re-runs its
startup templating step — `docker compose restart nginx` (a plain
`./deploy.sh` won't restart it on its own unless something else about the
service also changed).
