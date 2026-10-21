# RealtyHub — HostyCare cPanel Deployment Runbook

Deployment target: shared cPanel (LiteSpeed + Cloudflare, PostgreSQL, SSH/Git).
Layout used throughout:

```
/home/<cpaneluser>/realtyhub            # repo root
/home/<cpaneluser>/realtyhub/backend    # Flask (Setup Python App / Passenger WSGI)
/home/<cpaneluser>/realtyhub/frontend   # Next.js (Setup Node.js App / Passenger)
```

Replace `<cpaneluser>` with the cPanel account (example here: `sumatien`) and the
domain with the real one (example here: `plotandroof.com`).

---

## 0. Pre-flight

- Repo pushed to `origin/main` at the current head.
- Python 3.10+ and Node.js >20.9 available in cPanel (Setup Python App / Setup Node.js App).

## 1. Get the code onto the server

```bash
cd ~
git clone https://github.com/<owner>/realtyhub.git realtyhub
git -C ~/realtyhub log --oneline -1
```

If the repo is private, either make it public temporarily or use a GitHub Personal
Access Token as the password (username = GitHub username, password = token).

## 2. Create the PostgreSQL database

cPanel → **PostgreSQL Databases**:
1. Create database, e.g. `plotandroof` → becomes `sumatien_plotandroof`.
2. Create user, e.g. `realtyhub` → becomes `sumatien_realtyhub`.
3. Add user to database with **ALL PRIVILEGES**.

> HostyCare notes (learned the hard way):
> - Postgres is **not** on `localhost` (that resolves to `::1`, rejected by
>   `pg_hba.conf`). It listens on **`127.0.0.200:5432`** (see phpPgAdmin's server
>   banner). Use that host in `DATABASE_URL`.
> - `pg_trgm` (contrib) is **not installed**. The migrations detect this and
>   skip the trigram GIN indexes; set-based search still works via ILIKE.

## 3. Backend environment

```bash
cd ~/realtyhub/backend
cp .env.production.example .env
python -c "import secrets; print('SECRET_KEY=' + secrets.token_hex(32))"
python -c "import secrets; print('JWT_SECRET_KEY=' + secrets.token_hex(32))"
python -c "import secrets; print('CRON_KEY=' + secrets.token_urlsafe(32))"
nano .env   # fill DATABASE_URL, secrets, CORS_ORIGINS, FRONTEND_URL, CRON_KEY
```

URL-encode special characters in the DB password (`@` → `%40`, `#` → `%23`, etc.).
The `DATABASE_URL` host must be `127.0.0.200` on HostyCare, e.g.:

```
DATABASE_URL=postgresql+psycopg2://sumatien_realtyhub:PASS@127.0.0.200:5432/sumatien_plotandroof
```

## 4. Setup Python App (Flask API)

cPanel → **Setup Python App → Create Application**:
- Python version: 3.10+ (match the venv you create)
- Application root: `realtyhub/backend`
- Application URL: `api.plotandroof.com`
- Application startup file: `passenger_wsgi.py`
- Entry point: `application`

> cPanel **overwrites** `passenger_wsgi.py` with its own self-importing stub
> (`imp.load_source('wsgi', 'passenger_wsgi.py')`), which recurses for a Flask
> app. After creating the app, restore the repo version:
> ```bash
> cd ~/realtyhub/backend
> cat > passenger_wsgi.py <<'PY'
> """Passenger WSGI entrypoint (cPanel "Setup Python App")."""
> from app import create_app
>
> application = create_app()
> PY
> ```

Then install dependencies (use the venv path cPanel shows, or the "Enter to the
virtual environment" command):

```bash
source /home/sumatien/virtualenv/realtyhub/backend/3.11/bin/activate
pip install --upgrade pip
pip install -r /home/sumatien/realtyhub/backend/requirements.txt
```

Run migrations:

```bash
cd /home/sumatien/realtyhub/backend
source /home/sumatien/virtualenv/realtyhub/backend/3.11/bin/activate
alembic upgrade head
```

Restart the app from the Setup Python App page. Verify:

```bash
curl -s https://api.plotandroof.com/api/settings | head
```

## 5. Create the production admin

```bash
cd /home/sumatien/realtyhub/backend
source /home/sumatien/virtualenv/realtyhub/backend/3.11/bin/activate
python scripts/create_admin.py    # prompts for username/email/password
```

Do **not** run `scripts/seed_demo_users.py` in production.

## 6. Setup Node.js App (Next.js frontend)

cPanel → **Setup Node.js App → Create Application**:
- Node.js version: >20.9
- Application root: `realtyhub/frontend`
- Application URL: `plotandroof.com`
- Application startup file: `server.js`

Environment (from the app's env section or `frontend/.env.production`):
```
NEXT_PUBLIC_API_BASE_URL=https://api.plotandroof.com/api
NEXT_PUBLIC_BACKEND_URL=https://api.plotandroof.com
NEXT_PUBLIC_SITE_URL=https://plotandroof.com
```

Install + build:

```bash
source /home/sumatien/nodevenv/realtyhub/frontend/22/bin/activate
cd /home/sumatien/realtyhub/frontend
npm ci
npm run build
```

Restart the Node app. Next.js reads `.env.production` at build time, so rebuild
whenever those values change.

## 7. Cron jobs

All cron routes are `POST` and require the `X-Cron-Key` header
(`backend/routes/cron_routes.py`).

cPanel → **Cron Jobs**:

```bash
# every 15 min: lead first-response SLA reminders
*/15 * * * * curl -s -X POST -H "X-Cron-Key: <CRON_KEY>" https://api.plotandroof.com/api/cron/leads/reminders >/dev/null 2>&1
# hourly: expire past-due listings + drop expired featured boosts
0 * * * * curl -s -X POST -H "X-Cron-Key: <CRON_KEY>" https://api.plotandroof.com/api/cron/listings/expire >/dev/null 2>&1
# daily 08:00: listing expiry reminders
0 8 * * * curl -s -X POST -H "X-Cron-Key: <CRON_KEY>" https://api.plotandroof.com/api/cron/listings/reminders >/dev/null 2>&1
# daily 08:30: saved-search alert emails
30 8 * * * curl -s -X POST -H "X-Cron-Key: <CRON_KEY>" https://api.plotandroof.com/api/cron/search/alerts >/dev/null 2>&1
# weekly: retention cleanup (DPDP)
0 3 * * 0 curl -s -X POST -H "X-Cron-Key: <CRON_KEY>" https://api.plotandroof.com/api/cron/retention/cleanup >/dev/null 2>&1
```

Verify with `GET https://api.plotandroof.com/api/cron/health`.

## 8. SSL + routing

- cPanel → **SSL/TLS Status** → Run AutoSSL for `plotandroof.com` and `api.plotandroof.com`.
- Cloudflare: set SSL mode to Full (strict) once AutoSSL is issued.
- Ensure the `api` subdomain is routed to the Python app, the main domain to Node.

## 9. Post-deploy smoke test

- `https://api.plotandroof.com/api/settings` returns JSON.
- `https://plotandroof.com` loads, images render.
- Admin login, create a listing, owner checkout, lead submit.
- Restore repo visibility to private on GitHub if it was made public.
