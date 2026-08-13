# Nagpur Realty Hub — Production Deployment Guide

## 1. GitHub Repository

```bash
git init
git add -A
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/ashwinimeshram-debug/realtyhub.git
git push -u origin main
```

## 2. Supabase (PostgreSQL + Storage)

### Create Project
- Go to https://supabase.com → New project
- Name: `Realty Hub Project`
- Database password: set a strong password
- Region: `ap-southeast-2` (or your nearest)

### Create Storage Bucket
- **Storage → New bucket**
- Name: `realtyhub-images`
- Public bucket: **enabled**
- Once created, run these SQL policies in **SQL Editor**:

```sql
-- Public read access
CREATE POLICY "Public Read" ON storage.objects FOR SELECT USING (bucket_id = 'realtyhub-images');

-- Authenticated upload/update/delete
CREATE POLICY "Authenticated All" ON storage.objects
  FOR ALL USING (
    bucket_id = 'realtyhub-images'
    AND auth.role() = 'authenticated'
  );
```

### Enable Row-Level Security (REQUIRED — prevents public data exposure)

Tables created via `db.create_all()` are created **without** RLS, and Supabase
grants `anon`/`authenticated` full read/write on them. This triggers the
Security Advisor warnings `rls_disabled_in_public` and
`sensitive_columns_exposed` (anyone with the project URL can read/edit/delete
all data, including the `admins` password hashes).

Run `supabase/enable_rls.sql` in **SQL Editor** (idempotent, safe to re-run).
It enables RLS on every public table and revokes all table access from
`anon`/`authenticated`. This is safe because the app never uses the anon key —
the backend connects as the table owner (`postgres`) and uses `service_role`
for storage, both of which bypass RLS.

> Run this once per project. New tables created later by `db.create_all()`
> are already covered by the `ALTER DEFAULT PRIVILEGES` revokes in the script.

### Get Connection Info
- **Project Settings → Database → Connection string**
- Copy the pooler connection string (port 6543)
- Format: `postgresql://postgres:[PASSWORD]@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres`
- Note: use `aws-0-[REGION].pooler.supabase.com` format, NOT the `[PROJECT_REF].pooler.supabase.com` format

### Get Service Role Key
- **Project Settings → API → service_role key** (secret)

## 3. Render (Backend)

### Create Web Service
- Go to https://dashboard.render.com → New Web Service
- Connect GitHub repo `ashwinimeshram-debug/realtyhub`
- **Root Directory**: `backend/` (if needed)
- **Runtime**: Python 3
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `gunicorn wsgi:app --bind 0.0.0.0:$PORT --workers 2`

### Environment Variables (Render)

| Key | Value |
|-----|-------|
| `DATABASE_URL` | `postgresql://postgres:[PASSWORD]@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres` |
| `SUPABASE_URL` | `https://iydfrapthabyeecxifob.supabase.co` |
| `SUPABASE_SERVICE_KEY` | (service_role key from Supabase) |
| `SUPABASE_BUCKET` | `realtyhub-images` |
| `CORS_ORIGINS` | `https://realtyhub-six.vercel.app,http://localhost:3000` |
| `FRONTEND_URL` | `https://realtyhub-six.vercel.app` |
| `FLASK_ENV` | `production` |
| `SECRET_KEY` | (auto-generated, leave blank) |
| `JWT_SECRET_KEY` | (auto-generated, leave blank) |
| `ADMIN_USERNAME` | `admin` |
| `ADMIN_PASSWORD` | `admin123` (change after setup) |
| `ADMIN_EMAIL` | `admin@nagpurrealtyhub.com` |

### Important DB Connection Notes
- Use `aws-0-[REGION].pooler.supabase.com:6543` (NOT `[PROJECT_REF].pooler.supabase.com:6543`)
- The `[PROJECT_REF].pooler.supabase.com` hostname does not resolve in some regions
- The username format is `postgres.[PROJECT_REF]` (e.g., `postgres.iydfrapthabyeecxifob`)

### Deploy
- Click **Create Web Service**
- For subsequent updates: push to `main` → Render auto-deploys

## 4. Vercel (Frontend)

### Import Project
- Go to https://vercel.com/new
- Import GitHub repo `ashwinimeshram-debug/realtyhub`
- **Root Directory**: `frontend/`
- **Framework**: Next.js

### Environment Variables (Vercel)

| Key | Value | Environments |
|-----|-------|-------------|
| `NEXT_PUBLIC_BACKEND_URL` | `https://realtyhub-api.onrender.com` | Production, Preview |
| `NEXT_PUBLIC_API_BASE_URL` | `/api` | Production, Preview |

**Note**: `NEXT_PUBLIC_API_BASE_URL` must be `/api` (relative path), NOT the Render URL. This makes the browser use same-origin requests through Vercel's proxy to avoid CORS issues.

### Deploy
- Click **Deploy**
- For subsequent updates: push to `main` → Vercel auto-deploys

## 5. Post-Deployment Verification

```bash
# Backend health
curl https://realtyhub-api.onrender.com/
# Expected: "Nagpur Realty Hub API is Running"

# Backend API via Vercel proxy
curl https://realtyhub-six.vercel.app/api/health

# Admin login (test)
curl -X POST https://realtyhub-six.vercel.app/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
# Expected: {"admin_id":1,"message":"Login successful",...}
```

## 6. Important Code Details

### Next.js Config (`frontend/next.config.js`)
```js
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
// Rewrites /api/* to the backend
```

### API Client (`frontend/lib/api.ts`)
```ts
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api";
// Browser-side axios client with withCredentials: true
```

### Schema sync (`backend/app.py`)
The app uses PostgreSQL only. On startup `db.create_all()` creates missing tables and `_bootstrap_schema()` adds any new columns (e.g. `price_text`) to existing tables:
```python
# Startup order in create_app():
db.create_all()
_bootstrap_schema()
_seed_defaults()
```

## 7. Security Notes

- Change the default admin password (`admin123`) after first login
- Change the Supabase database password (`OrangeCity@300726`) since it was exposed in chat
- The `service_role key` has full access — keep it secret
- Set `JWT_COOKIE_SECURE = True` in production (done via `FLASK_ENV=production`)

## 8. File Structure

```
/
├── backend/
│   ├── app.py              # Flask app factory
│   ├── wsgi.py             # Gunicorn entry point
│   ├── Procfile            # Render start command
│   ├── runtime.txt         # Python version
│   ├── requirements.txt    # Python dependencies
│   ├── config.py           # Configuration
│   ├── extensions.py       # Flask extensions
│   ├── models/             # SQLAlchemy models
│   ├── routes/             # API routes
│   ├── utils/              # Helpers (Supabase storage, etc.)
├── frontend/
│   ├── next.config.js      # Next.js config + proxy rewrites
│   ├── app/                # Next.js App Router pages
│   ├── lib/                # Client libraries (API, admin)
│   └── middleware.ts       # Auth middleware
└── DEPLOYMENT_GUIDE.md     # This file
```

## 9. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `could not translate host name` for pooler | Use `aws-0-[REGION].pooler.supabase.com` format |
| New column missing on existing DB | `db.create_all()` doesn't alter existing tables; add the `ALTER TABLE` to `_bootstrap_schema()` in `app.py` and redeploy |
| CORS errors in browser | Set `CORS_ORIGINS` on Render and use `/api` for `NEXT_PUBLIC_API_BASE_URL` on Vercel |
| Login "Invalid credentials" | Check admin seed ran (first deploy), or reset admin password in DB |
| Cookies not set | Use same-origin proxy (`/api` base URL) instead of direct cross-origin |

## 10. Local vs Live — Working with Both Setups

### How the two environments connect

```
LOCAL DEV:
  Local frontend (localhost:3000)  →  Local backend (localhost:5000)  →  [DB + Storage]

LIVE PRODUCTION:
  Vercel frontend (realtyhub-six.vercel.app)  →  Render backend (realtyhub-api.onrender.com)  →  [DB + Storage]

DB + Storage = Supabase PostgreSQL + realtyhub-images bucket
```

### Key point: data sync

When the local backend is in **MODE 1 (LIVE)**, both local and live backends point to the **same** Supabase database and storage bucket. So:
- Properties, leads, settings added locally → appear on the live Vercel site, and vice versa
- Images uploaded locally → go to the same `realtyhub-images` bucket → appear live
- Local `.env` is gitignored — your local config never affects production

### Switching the backend between LIVE and LOCAL

File: `backend/.env` — two clearly marked modes:

```
# ============ MODE 1: LIVE (Supabase PostgreSQL, syncs with production) ============
DATABASE_URL=postgresql+psycopg2://postgres.iydfrapthabyeecxifob:OrangeCity%40300726@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?sslmode=require

# ============ MODE 2: LOCAL (local PostgreSQL server, isolated) ============
# DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/realtyhub
```

To switch to LOCAL:
1. Comment out the MODE 1 `DATABASE_URL` line
2. Uncomment the MODE 2 `DATABASE_URL` line
3. Comment out the 3 `SUPABASE_*` lines (URL, SERVICE_KEY, BUCKET) so uploads go to `backend/uploads/`
4. (Requires PostgreSQL installed locally + database `realtyhub` created)
To switch back to LIVE: reverse the steps.

### Frontend — automatic, no switching needed

| Where it runs | Env source | Values |
|---|---|---|
| Local (`npm run dev`) | `frontend/.env.local` (gitignored) | `http://localhost:5000` |
| Live (Vercel) | Vercel dashboard env vars | `NEXT_PUBLIC_BACKEND_URL=https://realtyhub-api.onrender.com`, `NEXT_PUBLIC_API_BASE_URL=/api` |

The code reads env vars with local fallbacks:
- `frontend/next.config.js`: `process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"`
- `frontend/lib/api.ts`: `process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api"`

No manual switching needed — it always picks the right backend based on where it runs.

### Database schema handling (PostgreSQL only)

The project uses PostgreSQL exclusively (no MySQL). On startup:
- `db.create_all()` → creates missing tables
- `_bootstrap_schema()` → adds new columns (e.g. `price_text`) to existing tables via idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`

**Caveat:** `create_all()` does NOT alter existing tables. If you add a column to an existing table in production, add it to `_bootstrap_schema()` in `app.py` so it's applied automatically.

### Admin credentials

- Default: username `admin` / password `admin123` (seeded on first startup)
- Overridable via Render env vars: `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_EMAIL`

### Security reminders

- Rotate the admin password after setup
- Rotate the Supabase database password and the `service_role` key — both were shared in chat
- `.env` files are gitignored — never force-push them
