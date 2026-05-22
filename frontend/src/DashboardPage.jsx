import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getMe, getMyActivity } from "./api";
import { LoadingLine } from "./components/ArchiveRow";

export default function DashboardPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then((u) => {
        setUser(u);
        return getMyActivity();
      })
      .then(setActivity)
      .catch(() => navigate("/account"))
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading) return <LoadingLine />;
  if (!user) return null;

  const stats = activity?.stats || {};

  return (
    <div className="page fade-in">
      <p className="page-eyebrow">Creator dashboard</p>
      <h1 className="page-title">Welcome, {user.name.split(" ")[0]}</h1>
      <p className="page-lead">Your archive activity and quick paths.</p>

      <div className="quick-links">
        <Link to="/upload" className="btn btn-primary">
          Upload a new PDF
        </Link>
        <Link to="/library" className="btn btn-ghost">
          My Library
        </Link>
        <Link to="/my-listings" className="btn btn-ghost">
          Manage my listings
        </Link>
        <Link to="/browse" className="btn btn-ghost">
          Browse marketplace
        </Link>
      </div>

      <div className="stats-row">
        <div className="stat-cell">
          <div className="stat-label">Total listings</div>
          <div className="stat-value">{stats.total_listings ?? 0}</div>
        </div>
        <div className="stat-cell">
          <div className="stat-label">Published</div>
          <div className="stat-value">{stats.published_listings ?? 0}</div>
        </div>
        <div className="stat-cell">
          <div className="stat-label">Drafts</div>
          <div className="stat-value">{stats.draft_listings ?? 0}</div>
        </div>
        <div className="stat-cell">
          <div className="stat-label">Total downloads</div>
          <div className="stat-value">{stats.total_downloads ?? 0}</div>
        </div>
        <div className="stat-cell">
          <div className="stat-label">Avg rating</div>
          <div className="stat-value">{stats.average_rating ?? "—"}</div>
        </div>
      </div>

      <div className="panel">
        <h2 className="section-heading">Recent uploads</h2>
        {(activity?.recent_listings || []).length === 0 ? (
          <p className="form-help">No listings yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Downloads</th>
              </tr>
            </thead>
            <tbody>
              {activity.recent_listings.map((l) => (
                <tr key={l.id}>
                  <td>
                    <Link to={`/pack/${l.id}`}>{l.title}</Link>
                  </td>
                  <td>{l.status}</td>
                  <td>{l.download_count || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel">
        <h2 className="section-heading">Reviews on your packs</h2>
        {(activity?.recent_reviews || []).length === 0 ? (
          <p className="form-help">No reviews yet.</p>
        ) : (
          <ul className="steps-list">
            {activity.recent_reviews.map((r) => (
              <li key={r.id}>
                <span className="step-num">★</span>
                <div>
                  <strong>{r.rating}/5</strong> — {r.text || "(no text)"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel">
        <h2 className="section-heading">Your recent downloads</h2>
        {(activity?.recent_downloads || []).length === 0 ? (
          <p className="form-help">No downloads yet. Browse the archive to add packs.</p>
        ) : (
          <table className="data-table">
            <tbody>
              {activity.recent_downloads.map((d) => (
                <tr key={d.listing_id}>
                  <td>
                    <Link to={`/pack/${d.listing_id}`}>{d.title}</Link>
                  </td>
                  <td>{d.downloaded_at ? new Date(d.downloaded_at).toLocaleString() : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
