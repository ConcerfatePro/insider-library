import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  fetchListing,
  fetchReviews,
  createReview,
  updateMyReview,
  downloadListingFile,
  purchaseListing,
  reportListing,
  getMe,
} from "./api";
import { REPORT_REASONS } from "./constants";
import { LoadingLine } from "./components/ArchiveRow";

export default function ListingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [rating, setRating] = useState("5");
  const [reviewText, setReviewText] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("copyright");
  const [reportDetails, setReportDetails] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [l, r] = await Promise.all([
        fetchListing(id),
        fetchReviews(id),
      ]);
      setListing(l);
      setReviews(r || []);
      const existing = (r || []).find((rev) => rev.author_id === user?.id);
      if (existing) {
        setRating(String(existing.rating));
        setReviewText(existing.text || "");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getMe().then(setUser).catch(() => setUser(null));
  }, []);

  useEffect(() => {
    if (id) load();
  }, [id, user?.id]);

  const handleAccess = async () => {
    if (!user) {
      navigate("/account");
      return;
    }
    try {
      if (listing.is_free || listing.has_access) {
        await downloadListingFile(listing.id);
      } else {
        await purchaseListing(listing.id);
        await downloadListingFile(listing.id);
        await load();
      }
    } catch (e) {
      setError(e.message);
    }
  };

  const submitReview = async (e) => {
    e.preventDefault();
    if (!user) return navigate("/account");
    try {
      const payload = { rating: parseInt(rating, 10), text: reviewText };
      if (listing.user_review_id) {
        await updateMyReview(listing.id, payload);
        setSuccess("Review updated.");
      } else {
        await createReview(listing.id, payload);
        setSuccess("Review submitted.");
      }
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const submitReport = async (e) => {
    e.preventDefault();
    try {
      await reportListing(listing.id, {
        reason: reportReason,
        details: reportDetails,
      });
      setReportOpen(false);
      setSuccess("Report submitted. Thank you.");
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading) return <LoadingLine />;
  if (!listing) {
    return (
      <div className="empty-state">
        <h3>Record not found</h3>
        <Link to="/browse">Back to archive</Link>
      </div>
    );
  }

  const tags = (listing.tags || "").split(",").map((t) => t.trim()).filter(Boolean);
  const canReview =
    user &&
    user.id !== listing.owner_id &&
    listing.has_access &&
    listing.status === "published";

  return (
    <div className="page fade-in detail-layout">
      <div>
        <nav className="breadcrumb">
          <Link to="/">Home</Link> / <Link to="/browse">Archive</Link> / {listing.title}
        </nav>

        {error && <div className="error-banner">{error}</div>}
        {success && <div className="success-banner">{success}</div>}

        <h1 className="page-title">{listing.title}</h1>
        <div className="detail-meta">
          <span>{listing.category}</span>
          {tags.map((t) => (
            <span key={t}>{t}</span>
          ))}
          {listing.owner_name && <span>By {listing.owner_name}</span>}
          {listing.average_rating != null && (
            <span>
              {listing.average_rating} ★ · {listing.review_count} reviews
            </span>
          )}
          <span>{listing.download_count} downloads</span>
        </div>

        <div className="panel">
          <h2 className="section-heading">Description</h2>
          <p style={{ whiteSpace: "pre-wrap", color: "var(--text-muted)" }}>
            {listing.long_description || listing.short_description}
          </p>
        </div>

        <div className="review-block">
          <h2 className="section-heading">Verified reviews</h2>
          {reviews.length === 0 ? (
            <p className="form-help">No reviews yet.</p>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="review-item">
                <strong>{r.rating}/5</strong>
                {r.verified && <span className="review-badge">Verified</span>}
                {r.author_name && (
                  <span style={{ color: "var(--text-muted)", marginLeft: "0.5rem" }}>
                    — {r.author_name}
                  </span>
                )}
                <p>{r.text}</p>
              </div>
            ))
          )}

          {canReview && (
            <form onSubmit={submitReview} style={{ marginTop: "1rem" }}>
              <div className="form-grid">
                <div className="form-field">
                  <label className="form-label">Rating</label>
                  <select className="select" value={rating} onChange={(e) => setRating(e.target.value)}>
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                  <label className="form-label">Your review</label>
                  <textarea
                    className="textarea"
                    rows={3}
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn-primary">
                  {listing.user_review_id ? "Update review" : "Submit verified review"}
                </button>
              </div>
            </form>
          )}
          {user && !listing.has_access && user.id !== listing.owner_id && (
            <p className="form-help">Download or purchase this pack to leave a verified review.</p>
          )}
        </div>

        <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: "1rem" }} onClick={() => setReportOpen(!reportOpen)}>
          Report listing
        </button>
        {reportOpen && (
          <form className="panel panel-slim" onSubmit={submitReport} style={{ marginTop: "0.75rem" }}>
            <div className="form-field">
              <label className="form-label">Reason</label>
              <select className="select" value={reportReason} onChange={(e) => setReportReason(e.target.value)}>
                {REPORT_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label className="form-label">Details (optional)</label>
              <textarea className="textarea" rows={2} value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-danger btn-sm">
              Submit report
            </button>
          </form>
        )}
      </div>

      <aside className="action-panel">
        <p className="page-eyebrow">Access</p>
        <p style={{ fontFamily: "var(--font-serif)", fontSize: "1.25rem", margin: "0 0 0.5rem" }}>
          {listing.is_free ? "Free" : `$${(listing.price_cents / 100).toFixed(2)}`}
        </p>
        {listing.file_path ? (
          <button type="button" className="btn btn-primary" style={{ width: "100%" }} onClick={handleAccess}>
            {listing.has_access || listing.is_free ? "Download PDF" : "Purchase & download"}
          </button>
        ) : (
          <p className="form-help">File not yet attached.</p>
        )}
        <dl className="file-meta">
          <dt>Format</dt>
          <dd>{listing.mime_type || "PDF"}</dd>
          {listing.file_size && (
            <>
              <dt>Size</dt>
              <dd>{(listing.file_size / 1024).toFixed(0)} KB</dd>
            </>
          )}
          {listing.original_filename && (
            <>
              <dt>Filename</dt>
              <dd>{listing.original_filename}</dd>
            </>
          )}
          <dt>Record ID</dt>
          <dd style={{ fontFamily: "monospace" }}>#{listing.id}</dd>
        </dl>
        <p className="policy-note" style={{ marginTop: "1rem" }}>
          For personal use only. Report suspected violations via the button below.
        </p>
      </aside>
    </div>
  );
}
