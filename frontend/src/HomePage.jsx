import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchListings, fetchCategories } from "./api";
import { CATEGORY_OPTIONS } from "./constants";

const PACK_TYPES = [
  {
    title: "Quick guides",
    desc: "Short PDFs you can read in one sitting — procedures, workflows, and how-tos.",
  },
  {
    title: "Checklists",
    desc: "Printable or on-screen lists for repeatable tasks and quality checks.",
  },
  {
    title: "Playbooks",
    desc: "Step-by-step reference for teams and solo operators who need consistency.",
  },
  {
    title: "Reference sheets",
    desc: "Dense tables, formulas, and crib notes meant to stay open beside your work.",
  },
];

const QUICK_PATHS = [
  { label: "Browse the archive", to: "/browse", desc: "Search all published packs" },
  { label: "My Library", to: "/library", desc: "Re-download what you own", auth: true },
  { label: "Upload a pack", to: "/upload", desc: "Share original PDFs you have rights to", auth: true },
  { label: "Creator dashboard", to: "/dashboard", desc: "Stats, drafts, and activity", auth: true },
];

export default function HomePage({ currentUser }) {
  const navigate = useNavigate();
  const [featured, setFeatured] = useState([]);
  const [popular, setPopular] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchListings({ sort: "newest" })
      .then((data) => {
        const list = data || [];
        setFeatured(list.slice(0, 6));
      })
      .catch(() => setFeatured([]));

    fetchListings({ sort: "downloads" })
      .then((data) => setPopular((data || []).slice(0, 4)))
      .catch(() => setPopular([]));

    fetchCategories()
      .then((cats) => setCategories(cats?.length ? cats : CATEGORY_OPTIONS))
      .catch(() => setCategories(CATEGORY_OPTIONS));
  }, []);

  const onSearch = (e) => {
    e.preventDefault();
    const q = search.trim();
    navigate(q ? `/browse?q=${encodeURIComponent(q)}` : "/browse");
  };

  const displayCategories = categories.slice(0, 8);

  return (
    <div className="fade-in home-page">
      <section className="home-hero-band">
        <div className="hero-split">
          <div className="hero-copy">
            <p className="page-eyebrow">The Insider · Knowledge Library</p>
            <h1 className="page-title">
              Practical knowledge, organized like a private archive.
            </h1>
            <p className="page-lead">
              Browse compact guides, checklists, playbooks, and reference documents
              built for people who want useful information without noise.
            </p>
            <form className="hero-search" onSubmit={onSearch}>
              <input
                className="input"
                type="search"
                placeholder="Search the archive…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button type="submit" className="btn btn-primary">
                Search
              </button>
            </form>
            <div className="hero-actions">
              <Link to="/browse" className="btn btn-primary">
                Browse Library
              </Link>
              <Link to="/upload" className="btn btn-ghost">
                Upload a Knowledge Pack
              </Link>
            </div>
          </div>
          <div className="hero-archive-preview">
            <p className="preview-label">Archive index · recent</p>
            <p className="preview-intro">
              Curated PDF guides and reference packs from independent creators.
            </p>
            {featured.length === 0 ? (
              <div className="preview-row preview-row-empty">
                <span className="preview-row-title">No published packs yet</span>
                <span className="preview-row-meta">Be the first to upload</span>
              </div>
            ) : (
              featured.slice(0, 5).map((l) => (
                <div key={l.id} className="preview-row">
                  <Link to={`/pack/${l.id}`} className="preview-row-title">
                    {l.title}
                  </Link>
                  <span className="preview-row-meta">{l.category}</span>
                  {l.short_description && (
                    <span className="preview-row-desc">{l.short_description}</span>
                  )}
                </div>
              ))
            )}
            <Link to="/browse" className="preview-footer-link">
              View full archive →
            </Link>
          </div>
        </div>
      </section>

      <section className="home-strip">
        <div className="strip-cell">
          <span className="strip-label">Format</span>
          <span className="strip-value">PDF knowledge packs</span>
        </div>
        <div className="strip-cell">
          <span className="strip-label">Reviews</span>
          <span className="strip-value">Verified after download</span>
        </div>
        <div className="strip-cell">
          <span className="strip-label">Access</span>
          <span className="strip-value">Free & paid listings</span>
        </div>
        <div className="strip-cell">
          <span className="strip-label">Creators</span>
          <span className="strip-value">Original content only</span>
        </div>
      </section>

      <div className="home-grid">
        <section className="home-grid-full">
          <h2 className="section-heading">What you&apos;ll find</h2>
          <p className="section-lead">
            A focused catalog — not a feed. Each listing is a single, purposeful document.
          </p>
          <div className="info-grid">
            {PACK_TYPES.map((item) => (
              <article key={item.title} className="info-card">
                <h3 className="info-card-title">{item.title}</h3>
                <p className="info-card-desc">{item.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2 className="section-heading">Browse by category</h2>
          <div className="category-grid">
            {displayCategories.map((c) => (
              <Link
                key={c}
                to={`/browse?category=${encodeURIComponent(c)}`}
                className="category-card"
              >
                <span className="category-card-name">{c}</span>
                <span className="category-card-arrow">→</span>
              </Link>
            ))}
          </div>
          <Link to="/browse" className="text-link" style={{ marginTop: "0.85rem", display: "inline-block" }}>
            View all categories
          </Link>
        </section>

        {featured.length > 0 && (
          <section className="panel">
            <div className="section-header-row">
              <h2 className="section-heading">Recently added</h2>
              <Link to="/browse" className="text-link">
                See all →
              </Link>
            </div>
            <div className="listing-mini-grid">
              {featured.map((l) => (
                <Link key={l.id} to={`/pack/${l.id}`} className="listing-mini-card">
                  <span className="listing-mini-category">{l.category}</span>
                  <span className="listing-mini-title">{l.title}</span>
                  <p className="listing-mini-desc">
                    {l.short_description || l.description}
                  </p>
                  <span className="listing-mini-meta">
                    {l.is_free ? "Free" : `$${(l.price_cents / 100).toFixed(2)}`}
                    {l.average_rating != null && ` · ${l.average_rating} ★`}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {popular.length > 0 && (
          <section className="panel">
            <div className="section-header-row">
              <h2 className="section-heading">Most downloaded</h2>
              <Link to="/browse?sort=downloads" className="text-link">
                Browse by downloads →
              </Link>
            </div>
            <ul className="ranked-list">
              {popular.map((l, i) => (
                <li key={l.id}>
                  <span className="ranked-num">{i + 1}</span>
                  <div className="ranked-body">
                    <Link to={`/pack/${l.id}`} className="ranked-title">
                      {l.title}
                    </Link>
                    <span className="ranked-meta">
                      {l.category} · {l.download_count || 0} downloads
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="panel">
          <h2 className="section-heading">Quick paths</h2>
          <div className="quick-path-grid">
            {QUICK_PATHS.filter((p) => !p.auth || currentUser).map((p) => (
              <Link key={p.to} to={p.to} className="quick-path-card">
                <span className="quick-path-label">{p.label}</span>
                <span className="quick-path-desc">{p.desc}</span>
              </Link>
            ))}
            {!currentUser && (
              <Link to="/account" className="quick-path-card quick-path-card-accent">
                <span className="quick-path-label">Create account</span>
                <span className="quick-path-desc">Sign in to download, library, and upload</span>
              </Link>
            )}
          </div>
        </section>

        <div className="home-two-col">
          <section className="panel">
            <h2 className="section-heading">How it works</h2>
            <ol className="steps-list">
              <li>
                <span className="step-num">1</span>
                <div>
                  <strong>Browse focused knowledge packs</strong>
                  <p className="form-help">Filter by category, price, and rating.</p>
                </div>
              </li>
              <li>
                <span className="step-num">2</span>
                <div>
                  <strong>Download or purchase</strong>
                  <p className="form-help">Free packs download when you&apos;re signed in.</p>
                </div>
              </li>
              <li>
                <span className="step-num">3</span>
                <div>
                  <strong>Keep them in your library</strong>
                  <p className="form-help">Re-download anytime from My Library.</p>
                </div>
              </li>
              <li>
                <span className="step-num">4</span>
                <div>
                  <strong>Review only after access</strong>
                  <p className="form-help">Verified reviews protect the community.</p>
                </div>
              </li>
            </ol>
          </section>

          <section className="panel">
            <h2 className="section-heading">For creators</h2>
            <p className="section-lead">
              Upload original knowledge packs — guides, checklists, and reference
              documents you have rights to share.
            </p>
            <ul className="bullet-list">
              <li>Save drafts before attaching a PDF</li>
              <li>Set price or publish free</li>
              <li>Track downloads and verified reviews</li>
              <li>Publish, unpublish, or archive anytime</li>
            </ul>
            <Link to="/upload" className="btn btn-primary" style={{ marginTop: "1rem" }}>
              Submit to the archive
            </Link>
          </section>
        </div>

        <section className="panel panel-slim home-trust-row">
          <div>
            <h2 className="section-heading">Trust & safety</h2>
            <p className="form-help">
              Original content only. Report abuse on any listing. No stolen, illegal,
              or harmful material.
            </p>
          </div>
          <div className="trust-links">
            <Link to="/content-policy">Content Policy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/privacy">Privacy</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
