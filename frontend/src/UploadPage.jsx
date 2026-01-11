import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getMe, createListing, uploadListingFile } from "./api";

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

export default function UploadPage() {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0]);
  const [price, setPrice] = useState("0");
  const [file, setFile] = useState(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const loadUser = async () => {
      setUserLoading(true);
      setError("");
      try {
        const me = await getMe();
        setCurrentUser(me);
      } catch (e) {
        console.error(e);
        setCurrentUser(null);
      } finally {
        setUserLoading(false);
      }
    };

    loadUser();
  }, []);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setCategory(CATEGORY_OPTIONS[0]);
    setPrice("0");
    setFile(null);
  };

  const createDraft = async () => {
    setError("");
    setSuccess("");

    if (!currentUser) {
      setError("You must be logged in to create a draft.");
      return;
    }

    if (!title.trim() || !description.trim()) {
      setError("Please add a title and description before saving a draft.");
      return;
    }

    try {
      setBusy(true);
      const draft = await createListing({
        title,
        description,
        category,
        price: parseFloat(price) || 0,
      });
      resetForm();
      setSuccess(`Draft created (Listing #${draft.id}). You can attach a PDF later from your dashboard.`);
      // optional: jump to dashboard
      // navigate("/dashboard");
    } catch (e) {
      console.error(e);
      setError(e?.message || "Failed to create draft.");
    } finally {
      setBusy(false);
    }
  };

  const publishListing = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!currentUser) {
      setError("You must be logged in to publish a listing.");
      return;
    }

    if (!file) {
      setError("Please attach a PDF file before publishing. (Or use Save draft.)");
      return;
    }

    try {
      setBusy(true);

      // 1) Create listing metadata
      const newListing = await createListing({
        title,
        description,
        category,
        price: parseFloat(price) || 0,
      });

      // 2) Upload the PDF to that listing
      const listingWithFile = await uploadListingFile(newListing.id, file);

      resetForm();
      setSuccess(`Published "${listingWithFile.title}" with a PDF attached.`);

      // optional: go to dashboard after publish
      // navigate("/dashboard");
    } catch (e) {
      console.error(e);
      setError(e?.message || "Failed to publish listing.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-root">
      <div className="page-main">
        {error && (
          <div className="error-banner" style={{ marginBottom: "0.75rem" }}>
            {error}
          </div>
        )}
        {success && (
          <div className="success-banner" style={{ marginBottom: "0.75rem" }}>
            {success}
          </div>
        )}

        {userLoading ? (
          <section className="card">
            <div className="home-section-label">Upload</div>
            <h2 className="section-title">Checking your account…</h2>
            <p className="home-hero-subtitle">
              Making sure you&apos;re signed in before creating a listing.
            </p>
          </section>
        ) : !currentUser ? (
          <section className="card">
            <div className="home-section-label">Upload</div>
            <h2 className="section-title">Sign in to create a listing</h2>
            <p className="home-hero-subtitle">
              You need an Insider Library account to publish new info packs and
              upload PDFs.
            </p>
            <div className="home-hero-actions" style={{ marginTop: "1rem" }}>
              <Link to="/account" className="btn btn-primary">
                Go to account
              </Link>
              <Link to="/listings" className="btn btn-ghost">
                Browse listings
              </Link>
            </div>
          </section>
        ) : (
          <div className="upload-layout">
            {/* Left: context / tips */}
            <section className="card">
              <div className="home-section-label">For creators</div>
              <h2 className="section-title">Publish a new info pack</h2>
              <p className="home-hero-subtitle">
                Create a listing first, then attach a PDF. If you don&apos;t have
                the final PDF yet, you can save a draft and come back later.
              </p>

              <ul className="upload-guidelines">
                <li>Use a descriptive title (e.g. &quot;ICU Quick Reference&quot;).</li>
                <li>Describe what someone will get in 2–4 sentences.</li>
                <li>Choose the category that fits best.</li>
                <li>
                  <strong>Drafts</strong> are listings without a PDF.
                </li>
                <li>
                  <strong>Published</strong> listings have a PDF attached.
                </li>
              </ul>

              <p className="home-hero-subtitle" style={{ marginTop: "0.7rem" }}>
                Tip: after you save a draft, go to your Dashboard to attach the
                PDF when you&apos;re ready.
              </p>

              <div className="home-hero-actions" style={{ marginTop: "1rem" }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => navigate("/dashboard")}
                >
                  Go to dashboard
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => navigate("/listings")}
                >
                  Browse listings
                </button>
              </div>
            </section>

            {/* Right: form */}
            <section className="card">
              <div className="home-section-label">Upload</div>
              <h3 className="section-title">Listing details</h3>

              <form onSubmit={publishListing}>
                <div className="form-grid">
                  <div className="form-field">
                    <label className="form-label">Title</label>
                    <input
                      className="input"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      placeholder="e.g. Emergency Medicine Cheat Sheet"
                    />
                  </div>

                  <div className="form-field">
                    <label className="form-label">Category</label>
                    <select
                      className="select"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      required
                    >
                      {CATEGORY_OPTIONS.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                    <label className="form-label">Description</label>
                    <textarea
                      className="textarea"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      required
                      rows={3}
                      placeholder="What will someone learn or get from this file?"
                    />
                  </div>

                  <div className="form-field">
                    <label className="form-label">Price (not used yet)</label>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                    <label className="form-label">PDF file (optional for draft)</label>
                    <input
                      className="input"
                      type="file"
                      accept="application/pdf"
                      onChange={(e) =>
                        setFile(
                          e.target.files && e.target.files[0]
                            ? e.target.files[0]
                            : null
                        )
                      }
                    />
                    <p className="form-help-text">
                      To publish, attach a PDF. To create a draft, leave this empty and click
                      &quot;Save draft&quot;.
                    </p>
                  </div>

                  <div
                    className="form-field"
                    style={{
                      alignSelf: "flex-end",
                      display: "flex",
                      gap: "0.6rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={createDraft}
                      disabled={busy}
                    >
                      {busy ? "Working…" : "Save draft"}
                    </button>

                    <button type="submit" className="btn btn-primary" disabled={busy}>
                      {busy ? "Publishing…" : "Publish listing"}
                    </button>
                  </div>
                </div>
              </form>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
