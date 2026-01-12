// frontend/src/AdminPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getMe,
  getAdminUsers,
  getAdminListings,
  blacklistUser,
  unblacklistUser,
  adminDeleteListing,
  adminDeleteUser,
  downloadListingFile, // ✅ add
} from "./api";

const AdminPage = () => {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 🔐 Auth + admin guard
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const me = await getMe();

        // ❌ not admin → kick to home
        if (!me.is_admin) {
          navigate("/", { replace: true });
          return;
        }

        setCurrentUser(me);
      } catch {
        // ❌ not logged in → kick to home
        navigate("/", { replace: true });
      }
    };

    checkAdmin();
  }, [navigate]);

  const loadAdminData = async () => {
    try {
      setLoading(true);
      setError("");
      const [u, ls] = await Promise.all([getAdminUsers(), getAdminListings()]);
      setUsers(u);
      setListings(ls);
    } catch (e) {
      console.error(e);
      setError("Failed to load admin data");
    } finally {
      setLoading(false);
    }
  };

  // Only load admin data once admin is confirmed
  useEffect(() => {
    if (currentUser?.is_admin) {
      loadAdminData();
    }
  }, [currentUser]);

  const handleBlacklistUser = async (userId) => {
    try {
      setError("");
      await blacklistUser(userId);
      await loadAdminData();
    } catch {
      setError("Failed to blacklist user");
    }
  };

  const handleUnblacklistUser = async (userId) => {
    try {
      setError("");
      await unblacklistUser(userId);
      await loadAdminData();
    } catch {
      setError("Failed to unblacklist user");
    }
  };

  const handleDeleteUser = async (userId) => {
    const confirmed = window.confirm(
      "Are you sure you want to permanently delete this user? This cannot be undone."
    );
    if (!confirmed) return;

    try {
      setError("");
      await adminDeleteUser(userId);
      await loadAdminData();
    } catch {
      setError("Failed to delete user");
    }
  };

  const handleDeleteListing = async (listingId) => {
    const confirmed = window.confirm(
      "Delete this listing permanently? This cannot be undone."
    );
    if (!confirmed) return;

    try {
      setError("");
      await adminDeleteListing(listingId);
      await loadAdminData();
    } catch {
      setError("Failed to delete listing");
    }
  };

  const handleDownload = async (listingId) => {
    try {
      setError("");
      await downloadListingFile(listingId);
    } catch (e) {
      console.error(e);
      setError(e?.message || "Failed to download file");
    }
  };

  // While checking auth, render nothing (prevents flicker)
  if (!currentUser) {
    return null;
  }

  return (
    <div className="page-root">
      <div className="page-inner">
        <div className="page-header">
          <div>
            <div className="page-tag">Internal · Admin</div>
            <h1 className="page-title">Admin control panel</h1>
            <p className="page-subtitle">
              Manage users, blacklist / unblacklist accounts, and clean up listings.
            </p>
          </div>
        </div>

        {error && <div className="error-banner">{error}</div>}

        {loading ? (
          <p style={{ color: "#e5e7eb" }}>Loading…</p>
        ) : (
          <div className="home-grid">
            {/* USERS */}
            <section className="home-card" style={{ gridArea: "hero" }}>
              <h2 className="home-card-title">Users</h2>
              <ul className="listings-list">
                {users.map((u) => (
                  <li key={u.id} className="listing-card">
                    <div className="listing-title">
                      {u.name} <span className="listing-meta">#{u.id}</span>
                    </div>
                    <div className="listing-meta">
                      {u.email} · {u.is_admin ? "Admin" : "User"}
                      {u.is_blacklisted && " · Blacklisted"}
                    </div>

                    {!u.is_admin && (
                      <div
                        style={{
                          marginTop: "0.4rem",
                          display: "flex",
                          gap: "0.4rem",
                          flexWrap: "wrap",
                        }}
                      >
                        {!u.is_blacklisted ? (
                          <button
                            className="btn btn-ghost"
                            onClick={() => handleBlacklistUser(u.id)}
                          >
                            Blacklist
                          </button>
                        ) : (
                          <button
                            className="btn btn-ghost"
                            onClick={() => handleUnblacklistUser(u.id)}
                          >
                            Unblacklist
                          </button>
                        )}
                        <button
                          className="btn btn-primary"
                          onClick={() => handleDeleteUser(u.id)}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            {/* LISTINGS */}
            <section className="home-card" style={{ gridArea: "stats" }}>
              <h2 className="home-card-title">Listings</h2>
              <ul className="listings-list">
                {listings.map((l) => (
                  <li key={l.id} className="listing-card">
                    <div className="listing-title">
                      {l.title} <span className="listing-meta">#{l.id}</span>
                    </div>
                    <div className="listing-meta">
                      {l.category} · {l.file_path ? "PDF" : "No file"}
                    </div>

                    <div
                      style={{
                        marginTop: "0.4rem",
                        display: "flex",
                        gap: "0.4rem",
                        flexWrap: "wrap",
                      }}
                    >
                      {l.file_path && (
                        <button
                          className="btn btn-ghost"
                          onClick={() => handleDownload(l.id)}
                        >
                          Download PDF
                        </button>
                      )}

                      <button
                        className="btn btn-primary"
                        onClick={() => handleDeleteListing(l.id)}
                      >
                        Delete listing
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPage;
