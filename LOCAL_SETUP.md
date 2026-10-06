# Nagpur Realty Hub — Local Development Guide

The app runs fully offline on localhost. There is no cloud hosting:
database is local PostgreSQL, image storage is `backend/uploads/`, and
the only remote is the private GitHub repository.

## Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+ running on `localhost:5432`

## 1. Database

Create the database once:

```bash
psql -U postgres -c "CREATE DATABASE realtyhub;"
```

Restore from a backup if needed:

```bash
psql -U postgres -d realtyhub -f backups/local_before_migration.sql
```

Schema is auto-created and seeded on backend startup (`db.create_all()`
plus default property types, lead statuses, admin user, and page content).

## 2. Backend (Flask, port 5000)

```bash
cd backend
python -m pip install -r requirements.txt
python app.py
```

Configuration lives in `backend/.env` (gitignored):

| Key | Purpose |
|-----|---------|
| `DATABASE_URL` | local PostgreSQL connection string |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | leave empty — storage uses `backend/uploads/` |
| `SECRET_KEY` / `JWT_SECRET_KEY` | session signing (auto-generated if missing) |

Files upload to `backend/uploads/` and are served at
`http://localhost:5000/uploads/<path>`.

> Run the backend from the `backend/` directory — the upload folder is
> resolved relative to the working directory.

## 3. Frontend (Next.js, port 3000)

```bash
cd frontend
npm install
npm run dev
```

`frontend/.env.local` (gitignored) points at the local backend:

```
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api
```

Open http://localhost:3000 — the admin panel is at `/admin`.

## 4. Validation

After backend changes:

```bash
cd backend && python -m py_compile app.py config.py routes/*.py utils/*.py
```

After frontend changes:

```bash
cd frontend && npx tsc --noEmit && npm run lint
```

## 5. Backups

`backups/` (gitignored) holds database dumps and one-off migration
scripts. To snapshot the current database:

```bash
pg_dump -U postgres -d realtyhub --no-owner --no-privileges -f backups/realtyhub_$(date +%Y%m%d).sql
```

Image files live in `backend/uploads/` — copy that folder for a full
media backup.

## 6. GitHub

The repo is private: `github.com/ashwinimeshram-debug/realtyhub.git`.
Push to `main` after validating changes. Never commit `.env` files or
`backend/uploads/`.
