# Phase 8 — Production Deployment Runbook (EC2 + nginx + Certbot)

This is a step-by-step runbook for deploying Eventify to a single EC2 instance,
fronted by nginx and HTTPS via Let's Encrypt/Certbot, serving `eventify.social`.

Everything in this phase that touches AWS, DNS, or the live instance is done
**by you**, manually. This session only edited files in the repo:

- `api/Dockerfile` — `npm ci --omit=dev` instead of `npm install` in the
  production stage (lockfile-exact install).
- `docker-compose.prod.yml` — same three services as the dev compose file,
  minus the dev-only host port mappings on `db`/`api`/`web`, plus `nginx` and
  `certbot` services.
- `nginx/conf.d/eventify.conf` and `nginx/conf.d/eventify.conf.bootstrap` —
  reverse proxy + TLS termination config.

No AWS CLI commands were run, nothing was provisioned, and nothing was SSH'd
into.

---

## 1. Launch the EC2 instance

- **AMI**: Amazon Linux 2023 (free-tier eligible, has `dnf`, good Docker
  support).
- **Instance type**: `t3.small` (2 GiB RAM). `t3.micro` (1 GiB) can work but
  MySQL + api + web + nginx together are tight on 1 GiB — go `t3.small`
  unless cost is the deciding factor.
- **Storage**: 20 GiB gp3 is plenty to start.
- **Key pair**: create or reuse one you'll use for SSH.
- **Security group** — inbound rules:
  | Port | Source | Purpose |
  |------|--------|---------|
  | 22 | your IP only (not 0.0.0.0/0) | SSH |
  | 80 | 0.0.0.0/0 | HTTP (redirects to HTTPS, also serves ACME challenge) |
  | 443 | 0.0.0.0/0 | HTTPS |

  Do **not** open 3306 (db), 4000 (api), or 3000 (web) to the internet —
  `docker-compose.prod.yml` doesn't publish those ports at all, so nginx is
  the only path in.

## 2. Allocate and associate an Elastic IP

- EC2 → Elastic IPs → Allocate Elastic IP address.
- Associate it with the instance you just launched.
- Note the IP — you'll point DNS at it in step 7.

## 3. Install Docker on the instance

SSH in, then:

```bash
sudo dnf update -y
sudo dnf install -y docker
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
# log out and back in so the group change takes effect
```

Install the Compose plugin:

```bash
sudo mkdir -p /usr/libexec/docker/cli-plugins
sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/libexec/docker/cli-plugins/docker-compose
sudo chmod +x /usr/libexec/docker/cli-plugins/docker-compose
docker compose version
```

## 4. Get the code and the `.env` file onto the instance

```bash
git clone <your repo url> ~/eventify
cd ~/eventify
```

Copy your real `.env` to the instance — **do not commit it**. From your local
machine:

```bash
scp -i <your-key.pem> .env ec2-user@<elastic-ip>:~/eventify/.env
```

Fill in real production values for anything still `change_me`/`*_test_*` in
`.env`: `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD`, `JWT_SECRET`, live
`STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` /
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (switch from `sk_test_`/`pk_test_` to
live keys once you're ready to take real payments), and drop
`SEED_ADMIN_PASSWORD`/`SEED_TEST_USER_PASSWORD` to something you actually
control if those seed files still run in prod.

## 5. First boot: HTTP only, so Certbot can issue the certificate

nginx's checked-in config (`nginx/conf.d/eventify.conf`) expects a cert that
doesn't exist yet — booting with it as-is will crash-loop nginx. Swap in the
bootstrap (HTTP-only) config first:

```bash
cd ~/eventify
mv nginx/conf.d/eventify.conf nginx/conf.d/eventify.conf.live
cp nginx/conf.d/eventify.conf.bootstrap nginx/conf.d/eventify.conf

docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d db api web nginx
```

Confirm `http://eventify.social` (once DNS, step 7, is pointed) or
`http://<elastic-ip>` serves the site over plain HTTP.

## 6. Point DNS at the Elastic IP

At your DNS provider for `eventify.social`:

- `A` record: `eventify.social` → `<elastic-ip>`
- `A` record: `www.eventify.social` → `<elastic-ip>`

Wait for propagation (`dig eventify.social` should return the Elastic IP)
before running Certbot — it validates ownership over HTTP on port 80.

## 7. Run Certbot to issue the certificate

```bash
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d eventify.social -d www.eventify.social \
  --email <your-email> --agree-tos --no-eff-email
```

This writes certs to the `certbot_conf` volume at
`/etc/letsencrypt/live/eventify.social/`.

## 8. Switch nginx to the HTTPS config and reload

```bash
mv nginx/conf.d/eventify.conf nginx/conf.d/eventify.conf.bootstrap
mv nginx/conf.d/eventify.conf.live nginx/conf.d/eventify.conf
docker compose -f docker-compose.prod.yml restart nginx
```

Confirm `https://eventify.social` works and `http://eventify.social`
redirects to it.

## 9. Set up renewal

Certbot certs expire every 90 days. Add a host crontab entry (`crontab -e`)
to renew and reload nginx twice a month:

```
0 3 1,15 * * cd ~/eventify && docker compose -f docker-compose.prod.yml run --rm certbot renew --webroot -w /var/www/certbot && docker compose -f docker-compose.prod.yml restart nginx
```

## 10. Point the Stripe webhook at production

In the Stripe dashboard (live mode, once you're off test keys), add a webhook
endpoint at `https://eventify.social/webhooks/stripe` and copy its signing
secret into `.env` as `STRIPE_WEBHOOK_SECRET` on the instance, then
`docker compose -f docker-compose.prod.yml up -d api` to pick it up.

## Redeploying after a code change

```bash
cd ~/eventify
git pull
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

---

## Known gaps / what I didn't check

- I did not verify these configs against a live EC2 instance — I can't, this
  session doesn't touch AWS. Test the bootstrap → certbot → switch sequence
  exactly once on a throwaway instance/domain if you want to de-risk it
  before doing it against the real `eventify.social`.
- No automated backups for the `db_data` volume. Add a cron'd
  `mysqldump` + off-box copy before you trust this with real orders.
- No log rotation/shipping for the containers beyond Docker's defaults.
- `t3.small` sizing is a guess based on the four containers involved — watch
  memory under real load and resize if needed.
