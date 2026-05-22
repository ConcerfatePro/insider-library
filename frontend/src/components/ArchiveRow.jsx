import { Link } from "react-router-dom";

export function ArchiveRow({ listing, action }) {
  const tags = (listing.tags || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <article className="archive-row">
      <div className="archive-row-main">
        <Link to={`/pack/${listing.id}`} className="archive-row-title">
          {listing.title}
        </Link>
        <p className="archive-row-summary">
          {listing.short_description || listing.description}
        </p>
        <div className="archive-row-meta">
          <span>{listing.category}</span>
          {tags.length > 0 && <span>{tags.join(" · ")}</span>}
          {listing.average_rating != null && (
            <span>
              {listing.average_rating} ★ · {listing.review_count} review
              {listing.review_count !== 1 ? "s" : ""}
            </span>
          )}
          <span>{listing.download_count || 0} downloads</span>
          <span>{listing.is_free ? "Free" : `$${(listing.price_cents / 100).toFixed(2)}`}</span>
        </div>
      </div>
      {action && <div className="archive-row-action">{action}</div>}
    </article>
  );
}

export function EmptyState({ title, message, action }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{message}</p>
      {action}
    </div>
  );
}

export function LoadingLine() {
  return <p className="loading-line">Loading…</p>;
}
