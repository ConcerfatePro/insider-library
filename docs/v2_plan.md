# Insider Library V2 Plan & Change Log

## Pre-V2 audit summary

| Area | Before V2 |
|------|-----------|
| Structure | FastAPI backend + React/Vite frontend (31 files) |
| Models | User, Listing, Review — minimal fields |
| Auth | JWT, signup verification, password reset, rate limits |
| Listings | CRUD, PDF upload, login-required download |
| Reviews | Unverified — any logged-in user could review |
| Admin | Users blacklist/delete, listing delete |
| Gaps | `/listings/activity/me` called but missing; no reports, library, slugs, status workflow |
| UI | Blue SaaS-style cards; emoji nav; placeholder “Buy” alert |
| Bugs | `python-jose` used but not in requirements; fake analytics tiles |

## V2 goals implemented

### Backend
- Extended `Listing` model: slug, descriptions, tags, price_cents, file metadata, status, download_count, owner_confirmed
- New tables: `downloads`, `purchases`, `reports`, `activity_logs`
- Safe migration in `migrate.py` on startup
- Search/filter/sort on public listings (`published` only)
- Activity endpoint `/listings/activity/me` with real stats
- `/library/me` for My Library
- Verified reviews (download/purchase required; owners blocked; one per user, updatable)
- Report create + admin resolve/dismiss
- Mock purchase endpoint for paid packs (no Stripe yet)
- Secure PDF upload (%PDF magic bytes, UUID filenames, path traversal prevention)
- Optional auth on public read routes
- Admin stats + reject listing
- Production-safe 500 handler (no stack traces)

### Frontend
- Archive visual system (warm dark palette, serif headings, row layouts)
- Pages: Home, Browse, Listing detail, Dashboard, My Library, My Listings, Upload, Admin, Policies
- Centralized `api.js` with env-based base URL + Vite dev proxy
- Legal checkbox on upload; report UI on detail page
- Removed placeholder buy alert; real purchase + download flow
- Removed fake analytics/suggestion tiles

### Docs & config
- Root `README.md`, `.env.example` files, this plan

## Not in this pass
- Stripe/payment webhooks
- Alembic migrations (SQLite auto-migrate only)
- Full account profile editing
- Related listings recommendations

## Files changed (high level)

**Backend:** `models.py`, `schemas.py`, `main.py`, `auth.py`, `migrate.py`, `utils.py`, `serializers.py`, `routes/listings.py`, `routes/reviews.py`, `routes/admin.py`, new `routes/library.py`, `routes/reports.py`, `requirements.txt`, `tests/test_v2.py`

**Frontend:** `index.css`, `App.jsx`, `api.js`, `constants.js`, `vite.config.js`, pages (Home, Browse, Detail, Dashboard, Library, MyListings, Upload, Admin, Policy), `components/ArchiveRow.jsx`
