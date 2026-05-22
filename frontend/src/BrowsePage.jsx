import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  fetchListings,
  fetchCategories,
  downloadListingFile,
  purchaseListing,
  getMe,
} from "./api";
import { ArchiveRow, EmptyState, LoadingLine } from "./components/ArchiveRow";
import { CATEGORY_OPTIONS } from "./constants";

export default function BrowsePage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  const [listings, setListings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  const q = params.get("q") || "";
  const category = params.get("category") || "";
  const priceFilter = params.get("price") || "all";
  const sort = params.get("sort") || "newest";

  const [searchInput, setSearchInput] = useState(q);

  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  useEffect(() => {
    getMe().then(setCurrentUser).catch(() => setCurrentUser(null));
    fetchCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError("");
    const apiParams = { sort };
    if (q) apiParams.q = q;
    if (category) apiParams.category = category;
    if (priceFilter === "free") apiParams.free_only = true;
    if (priceFilter === "paid") apiParams.paid_only = true;

    fetchListings(apiParams)
      .then(setListings)
      .catch((e) => {
        setError(e.message);
        setListings([]);
      })
      .finally(() => setLoading(false));
  }, [q, category, priceFilter, sort]);

  const updateParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    setParams(next);
  };

  const onSearchSubmit = (e) => {
    e.preventDefault();
    updateParam("q", searchInput.trim());
  };

  const handleDownload = async (id) => {
    if (!currentUser) {
      navigate("/account");
      return;
    }
    try {
      await downloadListingFile(id);
    } catch (e) {
      setError(e.message);
    }
  };

  const handlePurchase = async (listing) => {
    if (!currentUser) {
      navigate("/account");
      return;
    }
    try {
      await purchaseListing(listing.id);
      await downloadListingFile(listing.id);
    } catch (e) {
      setError(e.message);
    }
  };

  const actionFor = (listing) => {
    if (!listing.file_path) return null;
    if (!currentUser) {
      return (
        <Link to="/account" className="btn btn-ghost btn-sm">
          Log in
        </Link>
      );
    }
    if (listing.is_free || listing.has_access || currentUser?.is_admin || currentUser?.id === listing.owner_id) {
      return (
        <button type="button" className="btn btn-primary btn-sm" onClick={() => handleDownload(listing.id)}>
          Download
        </button>
      );
    }
    return (
      <button type="button" className="btn btn-primary btn-sm" onClick={() => handlePurchase(listing)}>
        Get access
      </button>
    );
  };

  const filterCats = categories.length ? categories : CATEGORY_OPTIONS;

  return (
    <div className="page fade-in">
      <p className="page-eyebrow">Archive index</p>
      <h1 className="page-title">Browse knowledge packs</h1>
      <p className="page-lead">Search and filter the public catalog.</p>

      {error && <div className="error-banner">{error}</div>}

      <div className="browse-layout">
        <aside className="filter-sidebar">
          <form onSubmit={onSearchSubmit} className="filter-group">
            <label>Search</label>
            <input
              className="input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Title, description, tags…"
            />
          </form>
          <div className="filter-group">
            <label>Category</label>
            <select
              className="select"
              value={category}
              onChange={(e) => updateParam("category", e.target.value)}
            >
              <option value="">All</option>
              {filterCats.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Price</label>
            <select
              className="select"
              value={priceFilter}
              onChange={(e) => updateParam("price", e.target.value)}
            >
              <option value="all">All</option>
              <option value="free">Free only</option>
              <option value="paid">Paid only</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Sort</label>
            <select className="select" value={sort} onChange={(e) => updateParam("sort", e.target.value)}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="downloads">Most downloaded</option>
              <option value="rating">Highest rated</option>
            </select>
          </div>
        </aside>

        <div>
          {loading ? (
            <LoadingLine />
          ) : listings.length === 0 ? (
            <EmptyState
              title="No records found"
              message="Try different filters or search terms."
              action={
                <Link to="/browse" className="btn btn-ghost" onClick={() => setParams(new URLSearchParams())}>
                  Clear filters
                </Link>
              }
            />
          ) : (
            <div className="archive-list">
              {listings.map((l) => (
                <ArchiveRow key={l.id} listing={l} action={actionFor(l)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
