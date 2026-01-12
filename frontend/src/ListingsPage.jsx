// frontend/src/ListingsPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";


import {
  fetchListings,
  fetchReviews,
  createReview,
  getMe,
  downloadListingFile,
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

function ListingsPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [reviewsMap, setReviewsMap] = useState({});
  const [reviewTextMap, setReviewTextMap] = useState({});
  const [reviewRatingMap, setReviewRatingMap] = useState({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("all");
  const [sortOption, setSortOption] = useState("newest");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        // Try to load current user; if not logged in, just ignore error
        try {
          const me = await getMe();
          setCurrentUser(me);
        } catch {
          setCurrentUser(null);
        }

        const data = await fetchListings();
        setListings(Array.isArray(data) ? data : []);

        // Load reviews for each listing
        const reviewsEntries = await Promise.all(
          (Array.isArray(data) ? data : []).map(async (listing) => {
            try {
              const reviews = await fetchReviews(listing.id);
              return [listing.id, Array.isArray(reviews) ? reviews : []];
            } catch (e) {
              console.error("Failed to load reviews for listing", listing.id, e);
              return [listing.id, []];
            }
          })
        );

        const map = {};
        for (const [id, reviews] of reviewsEntries) map[id] = reviews;
        setReviewsMap(map);
      } catch (e) {
        console.error(e);
        setError("Failed to load listings");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const handleAddReview = async (listingId) => {
    if (!currentUser) {
      alert("You must be logged in to leave a review.");
      return;
    }

    const text = reviewTextMap[listingId] || "";
    const ratingValue = parseInt(reviewRatingMap[listingId] || "0", 10);

    if (!text.trim()) {
      alert("Please enter a review.");
      return;
    }
    if (!ratingValue || ratingValue < 1 || ratingValue > 5) {
      alert("Please choose a rating between 1 and 5.");
      return;
    }

    try {
      setError("");
      const newReview = await createReview(listingId, {
        rating: ratingValue,
        text,
      });

      setReviewsMap((prev) => ({
        ...prev,
        [listingId]: [newReview, ...(prev[listingId] || [])],
      }));

      setReviewTextMap((prev) => ({ ...prev, [listingId]: "" }));
      setReviewRatingMap((prev) => ({ ...prev, [listingId]: "5" }));
    } catch (e) {
      console.error(e);
      setError(e?.message || "Failed to add review");
    }
  };

  const normalizedSearch = searchTerm.toLowerCase().trim();

  const categoriesForFilter = CATEGORY_OPTIONS.filter((cat) =>
    listings.some((l) => l.category === cat)
  );

  const filteredListings = listings.filter((listing) => {
    const matchesCategory =
      selectedCategoryFilter === "all" ||
      listing.category === selectedCategoryFilter;

    const matchesSearch =
      !normalizedSearch ||
      (listing.title || "").toLowerCase().includes(normalizedSearch) ||
      (listing.description || "").toLowerCase().includes(normalizedSearch);

    return matchesCategory && matchesSearch;
  });

  const sortedListings = [...filteredListings].sort((a, b) => {
    if (sortOption === "newest") {
      return new Date(b.created_at) - new Date(a.created_at);
    }
    if (sortOption === "oldest") {
      return new Date(a.created_at) - new Date(b.created_at);
    }

    const reviewsA = reviewsMap[a.id] || [];
    const reviewsB = reviewsMap[b.id] || [];

    const avgA =
      reviewsA.length > 0
        ? reviewsA.reduce((sum, r) => sum + r.rating, 0) / reviewsA.length
        : 0;
    const avgB =
      reviewsB.length > 0
        ? reviewsB.reduce((sum, r) => sum + r.rating, 0) / reviewsB.length
        : 0;

    if (sortOption === "rating_desc") return avgB - avgA;
    if (sortOption === "rating_asc") return avgA - avgB;
    return 0;
  });

  const handleDownload = async (listingId) => {
    if (!currentUser) {
      alert("Create an account or log in to download.");
      return;
    }
    try {
      setError("");
      await downloadListingFile(listingId);
    } catch (e) {
      console.error(e);
      setError(e?.message || "Download failed");
    }
  };

  const handleBuy = (listing) => {
    // Placeholder until you add purchases.
    const priceNum = Number(listing.price || 0);
    alert(`Buying coming next. Price: $${priceNum.toFixed(2)}`);
  };

  return (
    <div className="page-root">
      <div className="page-main">
        {error && (
          <div className="error-banner" style={{ marginBottom: "0.75rem" }}>
            {error}
          </div>
        )}

        {/* Top header + filters */}
        <section className="card">
          <div className="home-section-label">Marketplace</div>
          <h2 className="section-title">Browse Insider Library listings</h2>
          <p className="home-hero-subtitle">
            Search across user-created info packs. Filter by category, sort by
            recency or rating, and read what others think before you download or
            buy.
          </p>

          {listings.length > 0 && (
            <div className="listings-filter-bar">
              <div className="listings-filter-row">
                <input
                  className="input"
                  type="text"
                  placeholder="Search by title or description…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />

                <select
                  className="select"
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                >
                  <option value="all">All categories</option>
                  {categoriesForFilter.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>

                <select
                  className="select"
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value)}
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="rating_desc">Highest rated</option>
                  <option value="rating_asc">Lowest rated</option>
                </select>
              </div>
            </div>
          )}
        </section>

        {/* Listings grid */}
        <section className="card listings-wrapper">
          <h3 className="section-title">Results</h3>
          {loading ? (
            <p>Loading listings…</p>
          ) : listings.length === 0 ? (
            <p>No listings in the marketplace yet.</p>
          ) : sortedListings.length === 0 ? (
            <p>No listings match your search or filters.</p>
          ) : (
            <ul className="listings-list listings-grid">
              {sortedListings.map((listing) => {
                const reviews = reviewsMap[listing.id] || [];
                const reviewCount = reviews.length;
                const avgRating =
                  reviewCount > 0
                    ? (
                        reviews.reduce((sum, r) => sum + r.rating, 0) /
                        reviewCount
                      ).toFixed(1)
                    : null;

                const priceNum = Number(listing.price || 0);
                const isFree = priceNum === 0;
                const isOwnerOrAdmin =
                  !!currentUser &&
                  (currentUser.is_admin || currentUser.id === listing.owner_id);

                // NEW RULES:
                // - must be logged in to download anything
                // - free: any logged-in user can download
                // - paid: only owner/admin can download for now (buyers later)
                const showDownload =
                  listing.file_path && currentUser && (isFree || isOwnerOrAdmin);

                const showBuy =
                  listing.file_path && currentUser && !isFree && !isOwnerOrAdmin;

                return (
                  <li key={listing.id} className="listing-card">
                    <div className="listing-header">
                      <div>
                        <div className="listing-title">
                          {listing.title}{" "}
                          <span className="listing-meta">#{listing.id}</span>
                        </div>

                        {avgRating && (
                          <div className="listing-meta">
                            ⭐ {avgRating} · {reviewCount} review
                            {reviewCount !== 1 ? "s" : ""}
                          </div>
                        )}

                        <div className="listing-meta">
                          Category: {listing.category} · Price:{" "}
                          {isFree ? "Free" : `$${priceNum.toFixed(2)}`}
                        </div>
                      </div>
                      <span className="badge">
                        <span className="badge-dot" />
                        info pack
                      </span>
                    </div>

                    <div className="listing-body">{listing.description}</div>

                    <div className="listing-footer">
                      <div>
                        <div className="file-status">
                          <span
                            className={
                              listing.file_path
                                ? "file-status-ok"
                                : "file-status-missing"
                            }
                          >
                            {listing.file_path ? "PDF attached" : "No file yet"}
                          </span>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: "0.5rem",
                          flexWrap: "wrap",
                        }}
                      >
                        {!listing.file_path ? null : !currentUser ? (
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => navigate("/account")}
                            title="Create an account or log in to download."
                          >
                            Log in to download
                          </button>
                        ) : showDownload ? (
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => handleDownload(listing.id)}
                          >
                            {isFree ? "Download (Free)" : "Download"}
                          </button>
                        ) : showBuy ? (
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => handleBuy(listing)}
                          >
                            Buy (${priceNum.toFixed(2)})
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-ghost"
                            disabled
                            title="Paid pack — only buyers (or the owner/admin) can download. Purchases coming next."
                          >
                            Locked
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Reviews */}
                    <div className="reviews">
                      <div className="reviews-title">Reviews</div>

                      {reviews.length > 0 ? (
                        <ul className="review-list">
                          {reviews.map((rev) => (
                            <li key={rev.id} className="review-item">
                              <span className="review-rating">
                                {rev.rating}/5
                              </span>{" "}
                              – {rev.text}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="review-empty">No reviews yet.</p>
                      )}

                      <div className="review-form">
                        <div className="review-form-row">
                          <span>Rating:</span>
                          <select
                            className="select"
                            style={{ maxWidth: "80px" }}
                            value={reviewRatingMap[listing.id] ?? "5"}
                            onChange={(e) =>
                              setReviewRatingMap((prev) => ({
                                ...prev,
                                [listing.id]: e.target.value,
                              }))
                            }
                          >
                            <option value="5">5</option>
                            <option value="4">4</option>
                            <option value="3">3</option>
                            <option value="2">2</option>
                            <option value="1">1</option>
                          </select>
                        </div>

                        <div>
                          <textarea
                            className="textarea review-textarea"
                            rows={2}
                            placeholder={
                              currentUser
                                ? "Write your thoughts about this listing…"
                                : "Log in to leave a review."
                            }
                            value={reviewTextMap[listing.id] ?? ""}
                            onChange={(e) =>
                              setReviewTextMap((prev) => ({
                                ...prev,
                                [listing.id]: e.target.value,
                              }))
                            }
                            disabled={!currentUser}
                          />
                        </div>

                        <div>
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => handleAddReview(listing.id)}
                            disabled={!currentUser}
                          >
                            {currentUser ? "Submit review" : "Log in required"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export default ListingsPage;
