// frontend/src/DashboardPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getMe,
  fetchMyListings,
  updateListing,
  deleteListing,
  uploadListingFile,
  createListing,
  getMyActivity,
  downloadListingFile, // ✅ NEW (secure/auth download)
} from "./api";

const CATEGORY_OPTIONS = [
  "Medicine",
  "Finance",
  "Education",
  "Technology",
  "Business",
  "Science",
  "Personal Development",
  "Other",
];

function fmtDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/**
 * ✅ IMPORTANT: This component is OUTSIDE DashboardPage so it does NOT remount
 * on every keystroke (which was causing the “1 character then blur” bug).
 */
const DashboardTile = React.memo(function DashboardTile({
  tileKey,
  className,
  title,
  pill,
  isExpanded,
  expandedTile,
  activeSection,
  openTile,
  closeExpanded,
  children,
}) {
  if (isExpanded && expandedTile !== tileKey) return null;

  const expandedStyle = isExpanded
    ? {
        gridColumn: "1 / -1",
        gridRow: "1 / -1",
        minHeight: "520px",
        cursor: "default",
      }
    : {};

  const onTileClick = (e) => {
    if (isExpanded) return;
    if (e?.target?.closest?.("button,a,input,select,textarea,label")) return;
    openTile(tileKey);
  };

  return (
    <section
      className={
        "dashboard-card " +
        className +
        (activeSection === tileKey ? " card-active" : "")
      }
      onClick={onTileClick}
      style={expandedStyle}
    >
      <div style={{ width: "100%" }}>
        {isExpanded && expandedTile === tileKey && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={closeExpanded}
            style={{ marginBottom: "0.8rem" }}
          >
            ← Back to dashboard
          </button>
        )}

        <div className="card-header">
          <h2>{title}</h2>
          <span className={"pill" + (pill === "soft" ? " pill-soft" : "")}>
            {pill === "soft" ? "Focus" : pill || ""}
          </span>
        </div>

        {children}
      </div>
    </section>
  );
});

export default function DashboardPage() {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [myListings, setMyListings] = useState([]);
  const [loadingListings, setLoadingListings] = useState(true);

  const [activity, setActivity] = useState({
    recent_listings: [],
    recent_reviews: [],
    recent_purchases: [],
  });
  const [loadingActivity, setLoadingActivity] = useState(true);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSection, setActiveSection] = useState("overview");

  // Single-tile expansion
  const [expandedTile, setExpandedTile] = useState(null);

  // ---- edit state ----
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    category: CATEGORY_OPTIONS[0],
    price: "0",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // ---- draft publish state ----
  const [uploadFiles, setUploadFiles] = useState({});
  const [uploadingId, setUploadingId] = useState(null);

  // ---- quick action: create draft (expanded panel) ----
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftForm, setDraftForm] = useState({
    title: "",
    description: "",
    category: CATEGORY_OPTIONS[0],
    price: "0",
  });
  const [creatingDraft, setCreatingDraft] = useState(false);

  // Optional: focus first input when opening draft
  const draftTitleRef = useRef(null);

  const totals = useMemo(() => {
    const total = myListings.length;
    const withFiles = myListings.filter((l) => !!l.file_path).length;
    const drafts = total - withFiles;
    return { total, withFiles, drafts };
  }, [myListings]);

  async function loadUser() {
    setLoadingUser(true);
    try {
      const me = await getMe();
      setCurrentUser(me);
    } catch {
      setCurrentUser(null);
    } finally {
      setLoadingUser(false);
    }
  }

  async function loadListings() {
    setLoadingListings(true);
    try {
      const data = await fetchMyListings();
      setMyListings(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setMyListings([]);
      setError(e?.message || "Failed to load your listings.");
    } finally {
      setLoadingListings(false);
    }
  }

  async function loadActivity() {
    setLoadingActivity(true);
    try {
      const data = await getMyActivity();
      setActivity({
        recent_listings: data?.recent_listings || [],
        recent_reviews: data?.recent_reviews || [],
        recent_purchases: data?.recent_purchases || [],
      });
    } catch (e) {
      console.error(e);
      setActivity({
        recent_listings: [],
        recent_reviews: [],
        recent_purchases: [],
      });
    } finally {
      setLoadingActivity(false);
    }
  }

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (!loadingUser && !currentUser) {
      navigate("/account");
      return;
    }
    if (!loadingUser && currentUser) {
      loadListings();
      loadActivity();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingUser, currentUser]);

  useEffect(() => {
    if (draftOpen) {
      window.setTimeout(() => draftTitleRef.current?.focus?.(), 0);
    }
  }, [draftOpen]);

  function clearBannersSoon() {
    window.clearTimeout(clearBannersSoon._t);
    clearBannersSoon._t = window.setTimeout(() => {
      setError("");
      setSuccess("");
    }, 3500);
  }

  function startEdit(listing) {
    setError("");
    setSuccess("");
    setEditingId(listing.id);
    setEditForm({
      title: listing.title || "",
      description: listing.description || "",
      category: listing.category || CATEGORY_OPTIONS[0],
      price: String(listing.price ?? 0),
    });

    setActiveSection("uploads");
    setExpandedTile("uploads");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({
      title: "",
      description: "",
      category: CATEGORY_OPTIONS[0],
      price: "0",
    });
  }

  async function saveEdit(listingId) {
    setError("");
    setSuccess("");
    try {
      setSavingEdit(true);
      await updateListing(listingId, {
        title: editForm.title,
        description: editForm.description,
        category: editForm.category,
        price: parseFloat(editForm.price) || 0,
      });
      setSuccess("Listing updated.");
      cancelEdit();
      await loadListings();
      await loadActivity();
      clearBannersSoon();
    } catch (e) {
      console.error(e);
      setError(e?.message || "Failed to update listing.");
      clearBannersSoon();
    } finally {
      setSavingEdit(false);
    }
  }

  async function removeListing(listingId) {
    const ok = window.confirm(
      "Delete this listing permanently? This cannot be undone."
    );
    if (!ok) return;

    setError("");
    setSuccess("");
    try {
      await deleteListing(listingId);
      setSuccess("Listing deleted.");
      await loadListings();
      await loadActivity();
      clearBannersSoon();
    } catch (e) {
      console.error(e);
      setError(e?.message || "Failed to delete listing.");
      clearBannersSoon();
    }
  }

  async function publishDraft(listingId) {
    const file = uploadFiles[listingId];
    if (!file) {
      setError("Pick a PDF file for this draft first.");
      clearBannersSoon();
      return;
    }

    setError("");
    setSuccess("");
    try {
      setUploadingId(listingId);
      await uploadListingFile(listingId, file);
      setUploadFiles((prev) => {
        const next = { ...prev };
        delete next[listingId];
        return next;
      });
      setSuccess("PDF uploaded — draft is now published.");
      await loadListings();
      await loadActivity();
      clearBannersSoon();
    } catch (e) {
      console.error(e);
      setError(e?.message || "Failed to upload PDF.");
      clearBannersSoon();
    } finally {
      setUploadingId(null);
    }
  }

  async function createDraft() {
    if (!draftForm.title.trim() || !draftForm.description.trim()) {
      setError("Draft needs a title and description.");
      clearBannersSoon();
      return;
    }

    setError("");
    setSuccess("");
    try {
      setCreatingDraft(true);
      await createListing({
        title: draftForm.title.trim(),
        description: draftForm.description.trim(),
        category: draftForm.category,
        price: parseFloat(draftForm.price) || 0,
      });

      setSuccess("Draft created.");
      setDraftForm({
        title: "",
        description: "",
        category: CATEGORY_OPTIONS[0],
        price: "0",
      });
      setDraftOpen(false);

      await loadListings();
      await loadActivity();

      setActiveSection("uploads");
      setExpandedTile("uploads");

      clearBannersSoon();
    } catch (e) {
      console.error(e);
      setError(e?.message || "Failed to create draft.");
      clearBannersSoon();
    } finally {
      setCreatingDraft(false);
    }
  }

  function openTile(tileKey) {
    setActiveSection(tileKey);
    setExpandedTile(tileKey);
    if (tileKey !== "quick") setDraftOpen(false);
  }

  function closeExpanded() {
    setExpandedTile(null);
  }

  function openQuickThenDraft() {
    setActiveSection("quick");
    setExpandedTile("quick");
    setDraftOpen(true);
  }

  if (loadingUser) {
    return (
      <section className="card">
        <h2 className="section-title">Loading your dashboard…</h2>
        <p className="section-caption">Checking your session and loading your data.</p>
      </section>
    );
  }

  if (!currentUser) return null;

  const isExpanded = !!expandedTile;

  return (
    <div className="dashboard-page">
      <div
        className={
          "dashboard-shell " + (sidebarOpen ? "sidebar-open" : "sidebar-closed")
        }
      >
        <main className="dashboard-main">
          {error && <div className="error-banner">{error}</div>}
          {success && <div className="success-banner">{success}</div>}

          <div
            className="dashboard-grid"
            style={isExpanded ? { gridTemplateColumns: "1fr" } : undefined}
          >
            <DashboardTile
              tileKey="overview"
              className="card-overview"
              title="Overview"
              pill="soft"
              isExpanded={isExpanded}
              expandedTile={expandedTile}
              activeSection={activeSection}
              openTile={openTile}
              closeExpanded={closeExpanded}
            >
              <div className="metric-row">
                <div className="metric-main">
                  <div className="metric-label">Total listings</div>
                  <div className="metric-value">{totals.total}</div>
                </div>
                <div className="metric-secondary">
                  <div className="metric-label">Published</div>
                  <div className="metric-subvalue">{totals.withFiles}</div>
                </div>
                <div className="metric-secondary">
                  <div className="metric-label">Drafts</div>
                  <div className="metric-subvalue">{totals.drafts}</div>
                </div>
              </div>
              <p className="card-text">
                Manage your info packs: create drafts, upload PDFs, edit details,
                and keep your library tidy.
              </p>

              {!isExpanded && (
                <div style={{ marginTop: "0.7rem" }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => openTile("uploads")}
                  >
                    Manage uploads
                  </button>
                </div>
              )}
            </DashboardTile>

            <DashboardTile
              tileKey="activity"
              className="card-activity"
              title="Recent activity"
              pill="Live"
              isExpanded={isExpanded}
              expandedTile={expandedTile}
              activeSection={activeSection}
              openTile={openTile}
              closeExpanded={closeExpanded}
            >
              {loadingActivity ? (
                <p className="card-text">Loading activity…</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
                  <div>
                    <div className="metric-label">Listings</div>
                    {activity.recent_listings.length === 0 ? (
                      <p className="card-text">No recent listings yet.</p>
                    ) : (
                      <ul className="card-list">
                        {activity.recent_listings
                          .slice(0, isExpanded ? 10 : 4)
                          .map((l) => (
                            <li key={l.id}>
                              <span className="dot" />
                              <span className="card-list-title">{l.title}</span>
                              <span className="card-list-meta">
                                {fmtDate(l.created_at)}
                              </span>
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <div className="metric-label">Reviews on your packs</div>
                    {activity.recent_reviews.length === 0 ? (
                      <p className="card-text">No reviews yet.</p>
                    ) : (
                      <ul className="card-list">
                        {activity.recent_reviews
                          .slice(0, isExpanded ? 10 : 3)
                          .map((r) => (
                            <li key={r.id}>
                              <span className="dot" />
                              <span className="card-list-title">
                                ⭐ {r.rating}/5
                              </span>
                              <span className="card-list-meta">
                                {fmtDate(r.created_at)}
                              </span>
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </DashboardTile>

            <DashboardTile
              tileKey="uploads"
              className="card-uploads"
              title="Your uploads"
              pill="soft"
              isExpanded={isExpanded}
              expandedTile={expandedTile}
              activeSection={activeSection}
              openTile={openTile}
              closeExpanded={closeExpanded}
            >
              {loadingListings ? (
                <p className="card-text">Loading your listings…</p>
              ) : myListings.length === 0 ? (
                <p className="card-text">
                  No listings yet. Create a draft or upload a new pack.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                  {myListings
                    .slice(0, isExpanded ? myListings.length : 6)
                    .map((l) => (
                      <div
                        key={l.id}
                        style={{ borderTop: "1px dashed #22354b", paddingTop: "0.7rem" }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "0.6rem",
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: 600,
                                color: "#f7fbff",
                                fontSize: "0.95rem",
                              }}
                            >
                              {l.title}{" "}
                              <span style={{ color: "#9ca3af", fontWeight: 500 }}>
                                #{l.id}
                              </span>
                            </div>
                            <div
                              style={{
                                color: "#9ca3af",
                                fontSize: "0.78rem",
                                marginTop: "0.15rem",
                              }}
                            >
                              {l.category} · {l.file_path ? "Published" : "Draft"} ·{" "}
                              {fmtDate(l.created_at)}
                            </div>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              gap: "0.45rem",
                              flexWrap: "wrap",
                              alignItems: "center",
                            }}
                          >
                            {l.file_path && (
                              <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadListingFile(l.id).catch((err) => {
                                    setError(err?.message || "Download failed.");
                                    clearBannersSoon();
                                  });
                                }}
                              >
                                Download
                              </button>
                            )}

                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEdit(l);
                              }}
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeListing(l.id);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        {!l.file_path && (
                          <div
                            style={{
                              marginTop: "0.6rem",
                              display: "flex",
                              gap: "0.5rem",
                              flexWrap: "wrap",
                              alignItems: "center",
                            }}
                          >
                            <input
                              className="input"
                              type="file"
                              accept="application/pdf"
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                const f =
                                  e.target.files && e.target.files[0]
                                    ? e.target.files[0]
                                    : null;
                                setUploadFiles((prev) => ({ ...prev, [l.id]: f }));
                              }}
                              style={{ maxWidth: 360 }}
                            />
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                publishDraft(l.id);
                              }}
                              disabled={uploadingId === l.id}
                            >
                              {uploadingId === l.id ? "Uploading…" : "Upload PDF"}
                            </button>
                          </div>
                        )}

                        {editingId === l.id && (
                          <div style={{ marginTop: "0.75rem" }}>
                            <div className="form-grid">
                              <div className="form-field">
                                <label className="form-label">Title</label>
                                <input
                                  className="input"
                                  value={editForm.title}
                                  onChange={(e) =>
                                    setEditForm((p) => ({
                                      ...p,
                                      title: e.target.value,
                                    }))
                                  }
                                />
                              </div>

                              <div className="form-field">
                                <label className="form-label">Category</label>
                                <select
                                  className="select"
                                  value={editForm.category}
                                  onChange={(e) =>
                                    setEditForm((p) => ({
                                      ...p,
                                      category: e.target.value,
                                    }))
                                  }
                                >
                                  {CATEGORY_OPTIONS.map((c) => (
                                    <option key={c} value={c}>
                                      {c}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                                <label className="form-label">Description</label>
                                <textarea
                                  className="textarea"
                                  rows={3}
                                  value={editForm.description}
                                  onChange={(e) =>
                                    setEditForm((p) => ({
                                      ...p,
                                      description: e.target.value,
                                    }))
                                  }
                                />
                              </div>

                              <div className="form-field">
                                <label className="form-label">Price</label>
                                <input
                                  className="input"
                                  type="number"
                                  step="0.01"
                                  value={editForm.price}
                                  onChange={(e) =>
                                    setEditForm((p) => ({
                                      ...p,
                                      price: e.target.value,
                                    }))
                                  }
                                />
                              </div>

                              <div className="form-field" style={{ alignSelf: "flex-end" }}>
                                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                                  <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => saveEdit(l.id)}
                                    disabled={savingEdit}
                                  >
                                    {savingEdit ? "Saving…" : "Save"}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-ghost"
                                    onClick={cancelEdit}
                                    disabled={savingEdit}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </DashboardTile>

            <DashboardTile
              tileKey="quick"
              className="card-quick"
              title="Quick actions"
              pill="Go"
              isExpanded={isExpanded}
              expandedTile={expandedTile}
              activeSection={activeSection}
              openTile={openTile}
              closeExpanded={closeExpanded}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    openQuickThenDraft();
                  }}
                >
                  Create a draft
                </button>

                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate("/upload");
                  }}
                >
                  ⬆️ Upload a new pack
                </button>

                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate("/listings");
                  }}
                >
                  📚 Browse marketplace
                </button>

                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate("/account");
                  }}
                >
                  👤 Account
                </button>
              </div>

              {draftOpen && (
                <div
                  style={{
                    marginTop: "0.9rem",
                    padding: "0.85rem",
                    borderRadius: "12px",
                    border: "1px solid #22354b",
                    background:
                      "radial-gradient(circle at top left, #142335 0%, #070f1c 70%)",
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="metric-label" style={{ marginBottom: "0.35rem" }}>
                    New draft
                  </div>

                  <div className="form-grid">
                    <div className="form-field">
                      <label className="form-label">Title</label>
                      <input
                        ref={draftTitleRef}
                        className="input"
                        value={draftForm.title}
                        onChange={(e) =>
                          setDraftForm((p) => ({ ...p, title: e.target.value }))
                        }
                        placeholder="e.g. ICU Quick Reference"
                      />
                    </div>

                    <div className="form-field">
                      <label className="form-label">Category</label>
                      <select
                        className="select"
                        value={draftForm.category}
                        onChange={(e) =>
                          setDraftForm((p) => ({ ...p, category: e.target.value }))
                        }
                      >
                        {CATEGORY_OPTIONS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                      <label className="form-label">Description</label>
                      <textarea
                        className="textarea"
                        rows={3}
                        value={draftForm.description}
                        onChange={(e) =>
                          setDraftForm((p) => ({
                            ...p,
                            description: e.target.value,
                          }))
                        }
                        placeholder="What will someone get from this pack?"
                      />
                    </div>

                    <div className="form-field">
                      <label className="form-label">Price</label>
                      <input
                        className="input"
                        type="number"
                        step="0.01"
                        value={draftForm.price}
                        onChange={(e) =>
                          setDraftForm((p) => ({ ...p, price: e.target.value }))
                        }
                      />
                    </div>

                    <div className="form-field" style={{ alignSelf: "flex-end" }}>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={createDraft}
                          disabled={creatingDraft}
                        >
                          {creatingDraft ? "Creating…" : "Save draft"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => setDraftOpen(false)}
                          disabled={creatingDraft}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </DashboardTile>

            <DashboardTile
              tileKey="analytics"
              className="card-stats"
              title="Analytics"
              pill="Soon"
              isExpanded={isExpanded}
              expandedTile={expandedTile}
              activeSection={activeSection}
              openTile={openTile}
              closeExpanded={closeExpanded}
            >
              <p className="card-text">
                Next: downloads, views, conversion, and rating trends per pack.
              </p>
              <ul className="card-list">
                <li>Top performing topics</li>
                <li>Recent spikes in interest</li>
                <li>Average rating over time</li>
              </ul>
            </DashboardTile>

            <DashboardTile
              tileKey="recent"
              className="card-recent"
              title="Suggestions"
              pill="soft"
              isExpanded={isExpanded}
              expandedTile={expandedTile}
              activeSection={activeSection}
              openTile={openTile}
              closeExpanded={closeExpanded}
            >
              <p className="card-text">High-value packs that usually do well:</p>
              <ul className="card-list">
                <li>Step-by-step procedure guides</li>
                <li>Compact finance playbooks</li>
                <li>Checklists and one-page references</li>
              </ul>
            </DashboardTile>
          </div>
        </main>

        <aside className="dashboard-sidebar">
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setSidebarOpen((o) => !o)}
          >
            {sidebarOpen ? "›" : "‹"}
          </button>

          <div className="sidebar-inner">
            <div className="sidebar-section">
              <div className="sidebar-section-label">Overview</div>
              <button
                className={
                  "sidebar-item" +
                  (activeSection === "overview" ? " sidebar-item-active" : "")
                }
                onClick={() => openTile("overview")}
              >
                <span className="sidebar-icon">🏠</span>
                {sidebarOpen && <span>Dashboard</span>}
              </button>
              <button
                className={
                  "sidebar-item" +
                  (activeSection === "analytics" ? " sidebar-item-active" : "")
                }
                onClick={() => openTile("analytics")}
              >
                <span className="sidebar-icon">📊</span>
                {sidebarOpen && <span>Analytics</span>}
              </button>
            </div>

            <div className="sidebar-section">
              <div className="sidebar-section-label">Content</div>
              <button
                className={
                  "sidebar-item" +
                  (activeSection === "uploads" ? " sidebar-item-active" : "")
                }
                onClick={() => openTile("uploads")}
              >
                <span className="sidebar-icon">📁</span>
                {sidebarOpen && <span>Your uploads</span>}
              </button>
              <button
                className={
                  "sidebar-item" +
                  (activeSection === "activity" ? " sidebar-item-active" : "")
                }
                onClick={() => openTile("activity")}
              >
                <span className="sidebar-icon">🕒</span>
                {sidebarOpen && <span>Activity</span>}
              </button>
            </div>

            <div className="sidebar-section">
              <div className="sidebar-section-label">Tools</div>
              <button
                className={
                  "sidebar-item" +
                  (activeSection === "quick" ? " sidebar-item-active" : "")
                }
                onClick={() => openTile("quick")}
              >
                <span className="sidebar-icon">⚡</span>
                {sidebarOpen && <span>Quick actions</span>}
              </button>
              <button
                className={
                  "sidebar-item" +
                  (activeSection === "recent" ? " sidebar-item-active" : "")
                }
                onClick={() => openTile("recent")}
              >
                <span className="sidebar-icon">💡</span>
                {sidebarOpen && <span>Suggestions</span>}
              </button>
            </div>

            {!!expandedTile && (
              <div style={{ marginTop: "0.75rem" }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={closeExpanded}
                >
                  ← Back to dashboard
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
