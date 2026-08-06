# Deploying to a DigitalOcean Droplet

Everything runs via Docker Compose: Postgres, the backend API, the admin
dashboard, and the customer storefront each in their own container, on one
command. This avoids the usual manual-setup mistakes (wrong Node version,
forgetting to build, misconfigured process manager) since the exact
versions and steps are baked into the Dockerfiles.

Access is by IP only for now (no domain/SSL) — ports are exposed directly:

- Storefront: `http://<droplet-ip>`
- Admin dashboard: `http://<droplet-ip>:3001`
- Backend API: `http://<droplet-ip>:8090`

## 1. One-time droplet setup

SSH into your droplet, then:

```bash
# Install Docker + Compose plugin (Ubuntu)
curl -fsSL https://get.docker.com | sh

# Allow the required ports through the firewall
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 3001/tcp
ufw allow 8090/tcp
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

At minimum, set `DROPLET_IP` to your droplet's actual public IP, `DB_PASSWORD`
to a strong password, and `SENDGRID_API_KEY` if you want emails to send (leave
blank to skip emails entirely — nothing breaks, they just won't send). The
JWT secret and admin password are already pre-filled with generated values.

## 4. Bring everything up

```bash
docker compose up -d --build
```

First run takes a few minutes (building all three images). Migrations run
automatically on backend startup — no manual migration step needed.

## 5. Seed initial data (first deploy only)

```bash
docker compose run --rm backend npx sequelize-cli db:seed:all
```

This creates the admin login, default categories, delivery slots, and a
couple of sample products. Re-running this later will error on duplicate
unique fields (admin username, category names) — that's expected and
harmless, just skip it on subsequent deploys.

## 6. Verify

```bash
curl http://localhost:8090/                 # {"message":"Alive!"}
curl -o /dev/null -w "%{http_code}\n" http://localhost/          # 200
curl -o /dev/null -w "%{http_code}\n" http://localhost:3001/login # 200
```

Then from your own machine, open `http://<droplet-ip>` and
`http://<droplet-ip>:3001` in a browser.

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
`http://<droplet-ip>:8090/static/images/<filename>`. Product videos
(uploaded individually via the product form, max 10MB each) live the same
way in `backend_videos`, mounted at `/app/public/videos`, served at
`http://<droplet-ip>:8090/static/videos/<filename>`. Both volumes persist
across `docker compose up --build`, but back them up too if you care about
the media (not covered by the Postgres backup script above):

```bash
docker run --rm -v yunshang_backend_images:/data -v $(pwd)/backups:/backup \
  alpine tar czf /backup/images-$(date +%Y%m%d).tar.gz -C /data .
docker run --rm -v yunshang_backend_videos:/data -v $(pwd)/backups:/backup \
  alpine tar czf /backup/videos-$(date +%Y%m%d).tar.gz -C /data .
```

## Adding a domain + HTTPS later

When you have a domain, point its A record at the droplet IP, then add an
Nginx reverse-proxy container (or install Nginx directly on the droplet)
in front of ports 80/3001/8090, and run `certbot` for free Let's Encrypt
certificates. Happy to set this up when you're ready — it's a relatively
small addition on top of what's here.
