"""Safe SQLite column migrations for V2 (no Alembic)."""
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def _columns(conn, table: str) -> set[str]:
    rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
    return {row[1] for row in rows}


def _add_column(conn, table: str, ddl: str) -> None:
    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {ddl}"))


def run_migrations(engine: Engine) -> None:
    with engine.begin() as conn:
        listing_cols = _columns(conn, "listings")
        listing_additions = [
            ("slug", "slug VARCHAR"),
            ("short_description", "short_description TEXT"),
            ("long_description", "long_description TEXT"),
            ("tags", "tags VARCHAR DEFAULT ''"),
            ("price_cents", "price_cents INTEGER DEFAULT 0"),
            ("original_filename", "original_filename VARCHAR"),
            ("file_size", "file_size INTEGER"),
            ("mime_type", "mime_type VARCHAR DEFAULT 'application/pdf'"),
            ("status", "status VARCHAR DEFAULT 'draft'"),
            ("updated_at", "updated_at DATETIME"),
            ("published_at", "published_at DATETIME"),
            ("download_count", "download_count INTEGER DEFAULT 0"),
            ("owner_confirmed", "owner_confirmed BOOLEAN DEFAULT 0"),
        ]
        for name, ddl in listing_additions:
            if name not in listing_cols:
                _add_column(conn, "listings", ddl)

        review_cols = _columns(conn, "reviews")
        if "verified" not in review_cols:
            _add_column(conn, "reviews", "verified BOOLEAN DEFAULT 0")
        if "updated_at" not in review_cols:
            _add_column(conn, "reviews", "updated_at DATETIME")

        # Backfill listings from legacy columns
        conn.execute(
            text(
                """
                UPDATE listings SET
                  short_description = COALESCE(short_description, description),
                  long_description = COALESCE(long_description, description),
                  price_cents = COALESCE(price_cents, CAST(ROUND(COALESCE(price, 0) * 100) AS INTEGER)),
                  status = CASE
                    WHEN status IS NOT NULL AND status != '' THEN status
                    WHEN file_path IS NOT NULL AND file_path != '' THEN 'published'
                    ELSE 'draft'
                  END,
                  updated_at = COALESCE(updated_at, created_at),
                  published_at = CASE
                    WHEN file_path IS NOT NULL AND file_path != '' THEN COALESCE(published_at, created_at)
                    ELSE published_at
                  END
                WHERE short_description IS NULL OR short_description = ''
                   OR status IS NULL OR status = ''
                """
            )
        )
        conn.execute(
            text(
                """
                UPDATE listings SET slug = 'pack-' || id
                WHERE slug IS NULL OR slug = ''
                """
            )
        )
        conn.execute(
            text(
                """
                UPDATE listings SET owner_confirmed = 1
                WHERE file_path IS NOT NULL AND file_path != ''
                  AND (owner_confirmed IS NULL OR owner_confirmed = 0)
                """
            )
        )

        # Create new tables if missing
        inspector = inspect(engine)
        existing = set(inspector.get_table_names())
        if "downloads" not in existing:
            conn.execute(
                text(
                    """
                    CREATE TABLE downloads (
                      id INTEGER PRIMARY KEY AUTOINCREMENT,
                      user_id INTEGER NOT NULL,
                      listing_id INTEGER NOT NULL,
                      downloaded_at DATETIME,
                      FOREIGN KEY(user_id) REFERENCES users(id),
                      FOREIGN KEY(listing_id) REFERENCES listings(id)
                    )
                    """
                )
            )
        if "purchases" not in existing:
            conn.execute(
                text(
                    """
                    CREATE TABLE purchases (
                      id INTEGER PRIMARY KEY AUTOINCREMENT,
                      user_id INTEGER NOT NULL,
                      listing_id INTEGER NOT NULL,
                      amount_cents INTEGER DEFAULT 0,
                      purchased_at DATETIME,
                      FOREIGN KEY(user_id) REFERENCES users(id),
                      FOREIGN KEY(listing_id) REFERENCES listings(id)
                    )
                    """
                )
            )
        if "reports" not in existing:
            conn.execute(
                text(
                    """
                    CREATE TABLE reports (
                      id INTEGER PRIMARY KEY AUTOINCREMENT,
                      listing_id INTEGER NOT NULL,
                      reporter_id INTEGER,
                      reason VARCHAR NOT NULL,
                      details TEXT,
                      status VARCHAR DEFAULT 'open',
                      admin_notes TEXT,
                      created_at DATETIME,
                      resolved_at DATETIME,
                      FOREIGN KEY(listing_id) REFERENCES listings(id),
                      FOREIGN KEY(reporter_id) REFERENCES users(id)
                    )
                    """
                )
            )
        if "activity_logs" not in existing:
            conn.execute(
                text(
                    """
                    CREATE TABLE activity_logs (
                      id INTEGER PRIMARY KEY AUTOINCREMENT,
                      user_id INTEGER,
                      action VARCHAR NOT NULL,
                      listing_id INTEGER,
                      meta TEXT,
                      created_at DATETIME,
                      FOREIGN KEY(user_id) REFERENCES users(id)
                    )
                    """
                )
            )
