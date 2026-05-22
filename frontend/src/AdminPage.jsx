import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getMe,
  getAdminStats,
  getAdminUsers,
  getAdminListings,
  getAdminReports,
  resolveReport,
  blacklistUser,
  unblacklistUser,
  adminDeleteListing,
  adminDeleteUser,
  adminRejectListing,
} from "./api";

export default function AdminPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [listings, setListings] = useState([]);
  const [reports, setReports] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then((me) => {
        if (!me.is_admin) {
          navigate("/", { replace: true });
          return;
        }
        setUser(me);
        return Promise.all([getAdminStats(), getAdminUsers(), getAdminListings(), getAdminReports("open")]);
      })
      .then((data) => {
        if (data) {
          setStats(data[0]);
          setUsers(data[1]);
          setListings(data[2]);
          setReports(data[3]);
        }
      })
      .catch(() => navigate("/", { replace: true }))
      .finally(() => setLoading(false));
  }, [navigate]);

  const reloadReports = () =>
    getAdminReports("open").then(setReports).catch((e) => setError(e.message));

  const handleResolve = async (id, status, archive) => {
    try {
      await resolveReport(id, { status, admin_notes: "", archive_listing: archive });
      await reloadReports();
      const ls = await getAdminListings();
      setListings(ls);
    } catch (e) {
      setError(e.message);
    }
  };

  if (!user) return null;
  if (loading) return <p className="loading-line">Loading admin panel…</p>;

  return (
    <div className="page fade-in">
      <p className="page-eyebrow">Internal · Admin</p>
      <h1 className="page-title">Control panel</h1>
      {error && <div className="error-banner">{error}</div>}

      {stats && (
        <div className="admin-stat-bar">
          <span>
            Users: <strong>{stats.users}</strong>
          </span>
          <span>
            Listings: <strong>{stats.listings}</strong> ({stats.published_listings} published)
          </span>
          <span>
            Open reports: <strong>{stats.open_reports}</strong>
          </span>
          <span>
            Downloads: <strong>{stats.downloads}</strong>
          </span>
        </div>
      )}

      <div className="admin-grid">
        <section className="panel">
          <h2 className="section-heading">Open reports</h2>
          {reports.length === 0 ? (
            <p className="form-help">No open reports.</p>
          ) : (
            reports.map((r) => (
              <div key={r.id} className="archive-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
                <div>
                  <strong>{r.reason}</strong> —{" "}
                  <Link to={`/pack/${r.listing_id}`}>{r.listing_title || `#${r.listing_id}`}</Link>
                </div>
                <p className="form-help">{r.details || "No details"}</p>
                <p className="form-help">From: {r.reporter_email || "anonymous"}</p>
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleResolve(r.id, "dismissed", false)}>
                    Dismiss
                  </button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => handleResolve(r.id, "resolved", true)}>
                    Resolve & reject listing
                  </button>
                </div>
              </div>
            ))
          )}
        </section>

        <section className="panel">
          <h2 className="section-heading">Users</h2>
          <table className="data-table">
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.name} <span className="form-help">#{u.id}</span>
                  </td>
                  <td>{u.email}</td>
                  <td>
                    {!u.is_admin && (
                      <>
                        {!u.is_blacklisted ? (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => blacklistUser(u.id).then(() => getAdminUsers().then(setUsers))}>
                            Blacklist
                          </button>
                        ) : (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => unblacklistUser(u.id).then(() => getAdminUsers().then(setUsers))}>
                            Unblacklist
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => {
                            if (window.confirm("Delete user?")) adminDeleteUser(u.id).then(() => getAdminUsers().then(setUsers));
                          }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="panel" style={{ gridColumn: "1 / -1" }}>
          <h2 className="section-heading">All listings</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.id}>
                  <td>
                    <Link to={`/pack/${l.id}`}>{l.title}</Link>
                  </td>
                  <td>{l.status}</td>
                  <td>#{l.owner_id}</td>
                  <td>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => adminRejectListing(l.id).then(() => getAdminListings().then(setListings))}>
                      Reject
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => {
                        if (window.confirm("Delete listing?")) adminDeleteListing(l.id).then(() => getAdminListings().then(setListings));
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
