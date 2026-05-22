import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchMyLibrary, downloadListingFile, getMe } from "./api";
import { ArchiveRow, EmptyState, LoadingLine } from "./components/ArchiveRow";

export default function MyLibraryPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getMe()
      .then(() => load(""))
      .catch(() => navigate("/account"));
  }, []);

  const load = (term) => {
    setLoading(true);
    fetchMyLibrary(term)
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = setTimeout(() => load(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="page fade-in">
      <p className="page-eyebrow">Your collection</p>
      <h1 className="page-title">My Library</h1>
      <p className="page-lead">Knowledge packs you have downloaded or purchased.</p>

      {error && <div className="error-banner">{error}</div>}

      <div className="hero-search" style={{ maxWidth: 400, marginBottom: "1.25rem" }}>
        <input
          className="input"
          placeholder="Filter your library…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {loading ? (
        <LoadingLine />
      ) : items.length === 0 ? (
        <EmptyState
          title="Library empty"
          message="Browse the archive and download packs to build your library."
          action={
            <Link to="/browse" className="btn btn-primary">
              Browse Library
            </Link>
          }
        />
      ) : (
        <div className="archive-list">
          {items.map(({ listing, downloaded_at, purchased_at, has_reviewed }) => (
            <article key={listing.id} className="archive-row">
              <div className="archive-row-main">
                <Link to={`/pack/${listing.id}`} className="archive-row-title">
                  {listing.title}
                </Link>
                <p className="archive-row-summary">{listing.short_description}</p>
                <div className="archive-row-meta">
                  <span>{listing.owner_name || "Unknown creator"}</span>
                  {downloaded_at && <span>Downloaded {new Date(downloaded_at).toLocaleDateString()}</span>}
                  {purchased_at && <span>Purchased {new Date(purchased_at).toLocaleDateString()}</span>}
                </div>
              </div>
              <div className="archive-row-action" style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => downloadListingFile(listing.id).catch((e) => setError(e.message))}
                >
                  Download again
                </button>
                {!has_reviewed && (
                  <Link to={`/pack/${listing.id}`} className="btn btn-ghost btn-sm">
                    Leave review
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
