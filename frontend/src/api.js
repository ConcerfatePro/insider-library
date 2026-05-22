// Central API client — base URL from Vite env only (no hardcoded production hosts).
export const API_BASE = import.meta.env.VITE_API_BASE || "";

function authHeaders(extra = {}) {
  const token = localStorage.getItem("token");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function readErrorDetail(res) {
  try {
    const data = await res.json();
    if (data?.detail) {
      if (Array.isArray(data.detail)) {
        return data.detail.map((d) => d.msg || d.detail || String(d)).join(", ");
      }
      return String(data.detail);
    }
    return data?.message ? String(data.message) : null;
  } catch {
    return null;
  }
}

async function handleJsonResponse(res, defaultErrorMessage = "Request failed") {
  if (!res.ok) {
    const msg = (await readErrorDetail(res)) || defaultErrorMessage;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

function apiUrl(path) {
  if (!API_BASE) return path;
  return `${API_BASE.replace(/\/$/, "")}${path}`;
}

// ---------- listings ----------

export async function fetchListings(params = {}) {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.category) qs.set("category", params.category);
  if (params.free_only) qs.set("free_only", "true");
  if (params.paid_only) qs.set("paid_only", "true");
  if (params.sort) qs.set("sort", params.sort);
  const query = qs.toString();
  const res = await fetch(apiUrl(`/listings/${query ? `?${query}` : ""}`), {
    headers: authHeaders(),
  });
  return handleJsonResponse(res, "Failed to load listings");
}

export async function fetchCategories() {
  const res = await fetch(apiUrl("/listings/categories"), { headers: authHeaders() });
  return handleJsonResponse(res, "Failed to load categories");
}

export async function fetchListing(id) {
  const res = await fetch(apiUrl(`/listings/${id}`), { headers: authHeaders() });
  return handleJsonResponse(res, "Failed to load listing");
}

export async function fetchListingBySlug(slug) {
  const res = await fetch(apiUrl(`/listings/by-slug/${slug}`), { headers: authHeaders() });
  return handleJsonResponse(res, "Failed to load listing");
}

export async function fetchMyListings() {
  const res = await fetch(apiUrl("/listings/mine"), { headers: authHeaders() });
  return handleJsonResponse(res, "Failed to load your listings");
}

export async function createListing(payload) {
  const res = await fetch(apiUrl("/listings/"), {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(res, "Failed to create listing");
}

export async function updateListing(listingId, payload) {
  const res = await fetch(apiUrl(`/listings/${listingId}`), {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(res, "Failed to update listing");
}

export async function publishListing(listingId) {
  const res = await fetch(apiUrl(`/listings/${listingId}/publish`), {
    method: "POST",
    headers: authHeaders(),
  });
  return handleJsonResponse(res, "Failed to publish");
}

export async function unpublishListing(listingId) {
  const res = await fetch(apiUrl(`/listings/${listingId}/unpublish`), {
    method: "POST",
    headers: authHeaders(),
  });
  return handleJsonResponse(res, "Failed to unpublish");
}

export async function archiveListing(listingId) {
  const res = await fetch(apiUrl(`/listings/${listingId}/archive`), {
    method: "POST",
    headers: authHeaders(),
  });
  return handleJsonResponse(res, "Failed to archive");
}

export async function deleteListing(listingId) {
  const res = await fetch(apiUrl(`/listings/${listingId}`), {
    method: "DELETE",
    headers: authHeaders(),
  });
  await handleJsonResponse(res, "Failed to delete listing");
  return true;
}

export async function uploadListingFile(listingId, file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(apiUrl(`/listings/${listingId}/upload`), {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  });
  return handleJsonResponse(res, "Failed to upload file");
}

export async function purchaseListing(listingId) {
  const res = await fetch(apiUrl(`/listings/${listingId}/purchase`), {
    method: "POST",
    headers: authHeaders(),
  });
  return handleJsonResponse(res, "Failed to record purchase");
}

export async function getMyActivity() {
  const res = await fetch(apiUrl("/listings/activity/me"), { headers: authHeaders() });
  return handleJsonResponse(res, "Failed to load activity");
}

export async function downloadListingFile(listingId) {
  const res = await fetch(apiUrl(`/listings/${listingId}/download`), {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const msg = (await readErrorDetail(res)) || "Failed to download file";
    throw new Error(msg);
  }
  let filename = `listing_${listingId}.pdf`;
  const cd = res.headers.get("content-disposition") || "";
  const match = cd.match(/filename\*?=(?:UTF-8''|")?([^\";]+)"?/i);
  if (match?.[1]) {
    try {
      filename = decodeURIComponent(match[1]);
    } catch {
      filename = match[1];
    }
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

// ---------- library ----------

export async function fetchMyLibrary(q = "") {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  const res = await fetch(apiUrl(`/library/me${qs}`), { headers: authHeaders() });
  return handleJsonResponse(res, "Failed to load library");
}

// ---------- reviews ----------

export async function fetchReviews(listingId) {
  const res = await fetch(apiUrl(`/reviews/${listingId}`), { headers: authHeaders() });
  return handleJsonResponse(res, "Failed to load reviews");
}

export async function createReview(listingId, payload) {
  const res = await fetch(apiUrl(`/reviews/${listingId}`), {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(res, "Failed to create review");
}

export async function updateMyReview(listingId, payload) {
  const res = await fetch(apiUrl(`/reviews/${listingId}/mine`), {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(res, "Failed to update review");
}

// ---------- reports ----------

export async function reportListing(listingId, payload) {
  const res = await fetch(apiUrl(`/reports/listing/${listingId}`), {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(res, "Failed to submit report");
}

// ---------- auth ----------

export async function signup(payload) {
  const res = await fetch(apiUrl("/auth/signup"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(res, "Failed to sign up");
}

export async function verifySignup(payload) {
  const res = await fetch(apiUrl("/auth/verify-signup"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(res, "Failed to verify signup code");
}

export async function login({ email, password }) {
  const form = new URLSearchParams();
  form.append("username", email);
  form.append("password", password);
  const res = await fetch(apiUrl("/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  return handleJsonResponse(res, "Failed to log in");
}

export async function getMe() {
  const res = await fetch(apiUrl("/auth/me"), { headers: authHeaders() });
  return handleJsonResponse(res, "Failed to load current user");
}

// ---------- admin ----------

export async function getAdminStats() {
  const res = await fetch(apiUrl("/admin/stats"), { headers: authHeaders() });
  return handleJsonResponse(res, "Failed to load stats");
}

export async function getAdminUsers() {
  const res = await fetch(apiUrl("/admin/users"), { headers: authHeaders() });
  return handleJsonResponse(res, "Failed to load admin users");
}

export async function getAdminListings() {
  const res = await fetch(apiUrl("/admin/listings"), { headers: authHeaders() });
  return handleJsonResponse(res, "Failed to load admin listings");
}

export async function getAdminReports(status = "open") {
  const res = await fetch(apiUrl(`/reports/?status=${status}`), { headers: authHeaders() });
  return handleJsonResponse(res, "Failed to load reports");
}

export async function resolveReport(reportId, payload) {
  const res = await fetch(apiUrl(`/reports/${reportId}/resolve`), {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(res, "Failed to resolve report");
}

export async function blacklistUser(userId) {
  const res = await fetch(apiUrl(`/admin/users/${userId}/blacklist`), {
    method: "POST",
    headers: authHeaders(),
  });
  return handleJsonResponse(res, "Failed to blacklist user");
}

export async function unblacklistUser(userId) {
  const res = await fetch(apiUrl(`/admin/users/${userId}/unblacklist`), {
    method: "POST",
    headers: authHeaders(),
  });
  return handleJsonResponse(res, "Failed to unblacklist user");
}

export async function adminDeleteUser(userId) {
  const res = await fetch(apiUrl(`/admin/users/${userId}`), {
    method: "DELETE",
    headers: authHeaders(),
  });
  await handleJsonResponse(res, "Failed to delete user");
  return true;
}

export async function adminDeleteListing(listingId) {
  const res = await fetch(apiUrl(`/admin/listings/${listingId}`), {
    method: "DELETE",
    headers: authHeaders(),
  });
  await handleJsonResponse(res, "Failed to delete listing");
  return true;
}

export async function adminRejectListing(listingId) {
  const res = await fetch(apiUrl(`/admin/listings/${listingId}/reject`), {
    method: "POST",
    headers: authHeaders(),
  });
  return handleJsonResponse(res, "Failed to reject listing");
}

export async function adminDeleteReview(reviewId) {
  const res = await fetch(apiUrl(`/reviews/item/${reviewId}`), {
    method: "DELETE",
    headers: authHeaders(),
  });
  await handleJsonResponse(res, "Failed to delete review");
  return true;
}
