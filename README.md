# Insider Library (The Insider) — V2

A focused knowledge marketplace for compact, practical PDF guides, checklists, playbooks, and reference documents. The experience is designed like a **quiet premium digital archive** — not a social feed or generic SaaS template.

## Features

- **Browse & search** — keyword, category, free/paid, sort by newest, downloads, or rating
- **Listing detail** — metadata, download/purchase panel, verified reviews, report listing
- **Auth** — signup with email verification, login, password reset (JWT)
- **Upload** — drafts, PDF validation, legal confirmation, publish/unpublish/archive
- **My Library** — re-download packs you accessed; leave reviews after download/purchase
- **My Listings** — manage your uploads with real stats
- **Dashboard** — activity and stats from the API (no mock data)
- **Admin** — users, listings, open reports, moderation actions
- **Safety** — content policy pages, reporting workflow

## Stack

- **Backend:** FastAPI, SQLAlchemy, SQLite (default) or PostgreSQL via `DATABASE_URL`
- **Frontend:** React 18 + Vite 5

## Requirements

- **Python 3.11+** with the `venv` module (see Ubuntu note below)
- **Node.js 18+** (Ubuntu 22.04’s default `nodejs` package is fine)

## Local setup

### Ubuntu / Debian (one-time system packages)

If `python3 -m venv venv` fails with *ensurepip is not available*:

```bash
sudo apt update
sudo apt install python3-venv python3-pip nodejs npm
```

Use `python3`, not `python` (Ubuntu often has no `python` command unless you install `python-is-python3`).

If a previous venv was created broken (no `venv/bin/activate`), delete it and recreate:

```bash
cd backend
rm -rf venv
python3 -m venv venv
source venv/bin/activate
```

**Without `activate`**, you can still use the venv directly:

```bash
./venv/bin/pip install -r requirements.txt
./venv/bin/uvicorn app.main:app --reload --port 8000
```

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env       # edit secrets
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env       # optional: VITE_API_BASE for production
npm run dev
```

Open the URL Vite prints (usually `http://127.0.0.1:5173`). The dev server proxies API calls to the backend on port 8000.

### Optional: newer Node via nvm

If you prefer Node 20+, install [nvm](https://github.com/nvm-sh/nvm) and run `nvm install 20`. The project is pinned to **Vite 5** so Node 18 works without upgrading.

With no `VITE_API_BASE`, the Vite dev server proxies API routes to `VITE_DEV_API_PROXY` (default `http://127.0.0.1:8000`). **Do not hardcode localhost in app code.**

## Environment variables

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | Required in production |
| `DATABASE_URL` | Default `sqlite:///./insider_library.db` |
| `UPLOAD_DIR` | PDF storage directory (default `uploads/`) |
| `MAX_UPLOAD_MB` | Max PDF size (default 25) |
| `CORS_ORIGINS` | Comma-separated frontend origins |
| `FRONTEND_BASE_URL` | For password-reset links in email |
| `ENV` | `development` or `production` |
| `VITE_API_BASE` | Frontend API root in production builds |
| `VITE_DEV_API_PROXY` | Vite dev proxy target only |

Email (optional): `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM`

## Database & migrations

V2 adds columns and tables via a **startup SQLite migration** in `backend/app/migrate.py` (no Alembic). Existing listings are backfilled with slugs, status, and descriptions. **Do not delete `insider_library.db` unless you intend to reset data.**

## Upload storage

PDFs are stored under `UPLOAD_DIR` with random filenames (`uuid.pdf`). Original names are kept as metadata only. Path traversal is blocked on download.

## Admin access

### Admin panel

1. Grant admin in the database (SQLite example):

```bash
cd backend
sqlite3 insider_library.db "UPDATE users SET is_admin = 1 WHERE email = 'your@email.com';"
```

2. Log out and log back in (or refresh after the DB change).

3. Open the admin panel:
   - **URL:** `/internal-admin-8d14c11`
   - **Nav:** an **Admin** link appears in the top bar when your account is admin
   - **Account page:** an **Open admin panel** button appears when logged in as admin

The route is intentionally non-obvious; only accounts with `is_admin = 1` can use it.

## Safety & content

Uploaders must confirm rights to distribute content. Users can report listings; admins can dismiss or resolve reports and reject listings. See `/content-policy` and `/terms` in the app.

## Tests

```bash
cd backend && source venv/bin/activate && pytest tests/ -q
```

## V2 documentation

See [docs/v2_plan.md](docs/v2_plan.md) for the audit summary and change log.

**Ubuntu troubleshooting:** [docs/ubuntu-setup.md](docs/ubuntu-setup.md)

## Remaining TODOs

- Payment processor integration (Stripe, etc.) — purchases are recorded on-platform only
- Email production configuration for verification and reset
- Redis-backed rate limiting for multi-instance deploys
