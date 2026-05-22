import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  fetchMyListings,
  publishListing,
  unpublishListing,
  archiveListing,
  deleteListing,
  getMe,
} from "./api";
import { EmptyState, LoadingLine } from "./components/ArchiveRow";

export default function MyListingsPage() {
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    fetchMyListings()
      .then(setListings)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    getMe()
      .then(load)
      .catch(() => navigate("/account"));
  }, []);

  const act = async (fn, id) => {
    try {
      setError("");
      await fn(id);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="page fade-in">
      <p className="page-eyebrow">Creator</p>
      <h1 className="page-title">Published Listings</h1>
      <p className="page-lead">Manage drafts, published packs, and archive records.</p>

      <div className="quick-links">
        <Link to="/upload" className="btn btn-primary">
          Upload new pack
        </Link>
        <Link to="/dashboard" className="btn btn-ghost">
          Dashboard
        </Link>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <LoadingLine />
      ) : listings.length === 0 ? (
        <EmptyState
          title="No listings yet"
          message="Create a draft or publish your first knowledge pack."
          action={
            <Link to="/upload" className="btn btn-primary">
              Start upload
            </Link>
          }
        />
      ) : (
        <div className="panel" style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Downloads</th>
                <th>Rating</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.id}>
                  <td>
                    <Link to={`/pack/${l.id}`}>{l.title}</Link>
                  </td>
                  <td>
                    <span className={`status-pill ${l.status === "published" ? "published" : ""}`}>
                      {l.status}
                    </span>
                  </td>
                  <td>{l.download_count || 0}</td>
                  <td>{l.average_rating != null ? `${l.average_rating} ★` : "—"}</td>
                  <td>{l.updated_at ? new Date(l.updated_at).toLocaleDateString() : "—"}</td>
                  <td>
                    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                      <Link to={`/upload?edit=${l.id}`} className="btn btn-ghost btn-sm">
                        Edit
                      </Link>
                      {l.status === "draft" && l.file_path && (
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => act(publishListing, l.id)}>
                          Publish
                        </button>
                      )}
                      {l.status === "published" && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => act(unpublishListing, l.id)}>
                          Unpublish
                        </button>
                      )}
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => act(archiveListing, l.id)}>
                        Archive
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => {
                          if (window.confirm("Delete permanently?")) act(deleteListing, l.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
