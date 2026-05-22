import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getMe, createListing, uploadListingFile, publishListing } from "./api";
import { CATEGORY_OPTIONS, LEGAL_CONFIRMATION } from "./constants";

const MAX_MB = 25;

export default function UploadPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [longDescription, setLongDescription] = useState("");
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0]);
  const [tags, setTags] = useState("");
  const [price, setPrice] = useState("0");
  const [file, setFile] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setUserLoading(false));
  }, []);

  const payload = (status) => ({
    title: title.trim(),
    short_description: shortDescription.trim(),
    long_description: (longDescription || shortDescription).trim(),
    description: shortDescription.trim(),
    category,
    tags,
    price: parseFloat(price) || 0,
    price_cents: Math.round((parseFloat(price) || 0) * 100),
    owner_confirmed: confirmed,
    status,
  });

  const validate = (needsFile) => {
    if (!title.trim() || !shortDescription.trim()) {
      setError("Title and short description are required.");
      return false;
    }
    if (!confirmed) {
      setError("You must confirm ownership and content rights.");
      return false;
    }
    if (needsFile && !file) {
      setError("Attach a PDF to publish.");
      return false;
    }
    if (file && file.size > MAX_MB * 1024 * 1024) {
      setError(`PDF must be under ${MAX_MB} MB.`);
      return false;
    }
    if (file && file.type && file.type !== "application/pdf") {
      setError("Only PDF files are allowed.");
      return false;
    }
    return true;
  };

  const saveDraft = async () => {
    if (!validate(false)) return;
    setBusy(true);
    setError("");
    try {
      const draft = await createListing(payload("draft"));
      if (file) await uploadListingFile(draft.id, file);
      setSuccess(`Draft saved (#${draft.id}). Publish from My Listings when ready.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const publish = async (e) => {
    e.preventDefault();
    if (!validate(true)) return;
    setBusy(true);
    setError("");
    try {
      const listing = await createListing(payload("draft"));
      await uploadListingFile(listing.id, file);
      await publishListing(listing.id);
      setSuccess(`Published "${title}".`);
      setTitle("");
      setShortDescription("");
      setLongDescription("");
      setTags("");
      setFile(null);
      setConfirmed(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (userLoading) return <p className="loading-line">Checking account…</p>;

  if (!user) {
    return (
      <div className="panel">
        <h1 className="page-title">Sign in to upload</h1>
        <p className="page-lead">An account is required to submit knowledge packs.</p>
        <Link to="/account" className="btn btn-primary">
          Account
        </Link>
      </div>
    );
  }

  return (
    <div className="page fade-in upload-layout">
      <section className="panel">
        <p className="page-eyebrow">Submit to archive</p>
        <h1 className="page-title">Upload a knowledge pack</h1>
        <p className="page-lead">
          Add metadata first, attach your PDF, then publish. Drafts can be saved without a file.
        </p>
        <ul className="form-help" style={{ paddingLeft: "1.1rem" }}>
          <li>PDF only, max {MAX_MB} MB</li>
          <li>Original content you own or have rights to distribute</li>
          <li>Reports are reviewed by administrators</li>
        </ul>
        <p className="form-help">
          <Link to="/content-policy">Content Policy</Link>
        </p>
      </section>

      <section className="panel">
        {error && <div className="error-banner">{error}</div>}
        {success && <div className="success-banner">{success}</div>}

        <form onSubmit={publish}>
          <div className="form-grid">
            <div className="form-field" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">Title</label>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="form-field">
              <label className="form-label">Category</label>
              <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label className="form-label">Tags (comma-separated)</label>
              <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="checklist, icu, finance" />
            </div>
            <div className="form-field" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">Short summary</label>
              <textarea className="textarea" rows={2} value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} required />
            </div>
            <div className="form-field" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">Full description</label>
              <textarea className="textarea" rows={4} value={longDescription} onChange={(e) => setLongDescription(e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">Price (USD, 0 = free)</label>
              <input className="input" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="form-field" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">PDF document</label>
              <input
                className="input"
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="form-field" style={{ gridColumn: "1 / -1" }}>
              <label className="checkbox-row">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                <span>{LEGAL_CONFIRMATION}</span>
              </label>
            </div>
            <div className="form-field" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={saveDraft}>
                Save draft
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? "Submitting…" : "Publish to archive"}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
