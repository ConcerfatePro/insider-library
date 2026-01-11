// frontend/src/api.js
export const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

// ---------------- helpers ----------------

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

async function fetchWithFallback(primary, fallback, options = {}, defaultErrorMessage) {
  const res1 = await fetch(primary, options);
  if (res1.status !== 404) return handleJsonResponse(res1, defaultErrorMessage);

  const res2 = await fetch(fallback, options);
  return handleJsonResponse(res2, defaultErrorMessage);
}

// ---------------- listings ----------------

export async function fetchListings() {
  const res = await fetch(`${API_BASE}/listings/`, { headers: authHeaders() });
  return handleJsonResponse(res, "Failed to load listings");
}

export async function fetchMyListings() {
  const res = await fetch(`${API_BASE}/listings/mine`, { headers: authHeaders() });
  return handleJsonResponse(res, "Failed to load your listings");
}

export async function createListing(payload) {
  const res = await fetch(`${API_BASE}/listings/`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(res, "Failed to create listing");
}

export async function updateListing(listingId, payload) {
  const res = await fetch(`${API_BASE}/listings/${listingId}`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(res, "Failed to update listing");
}

export async function deleteListing(listingId) {
  const res = await fetch(`${API_BASE}/listings/${listingId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  await handleJsonResponse(res, "Failed to delete listing");
  return true;
}

export async function uploadListingFile(listingId, file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/listings/${listingId}/upload`, {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  });

  return handleJsonResponse(res, "Failed to upload file");
}

export async function getMyActivity() {
  const res = await fetch(`${API_BASE}/listings/activity/me`, {
    headers: authHeaders(),
  });
  return handleJsonResponse(res, "Failed to load activity");
}

/**
 * 🔒 Authenticated download: fetches PDF with Authorization header and triggers a browser download.
 */
export async function downloadListingFile(listingId) {
  const res = await fetch(`${API_BASE}/listings/${listingId}/download`, {
    headers: authHeaders(),
  });

  if (!res.ok) {
    const msg = (await readErrorDetail(res)) || "Failed to download file";
    throw new Error(msg);
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `listing_${listingId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  window.URL.revokeObjectURL(url);
}

// ---------------- reviews ----------------

export async function fetchReviews(listingId) {
  return fetchWithFallback(
    `${API_BASE}/listings/${listingId}/reviews`,
    `${API_BASE}/reviews/${listingId}`,
    { headers: authHeaders() },
    "Failed to load reviews"
  );
}

export async function createReview(listingId, payload) {
  return fetchWithFallback(
    `${API_BASE}/listings/${listingId}/reviews`,
    `${API_BASE}/reviews/${listingId}`,
    {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    },
    "Failed to create review"
  );
}

// ---------------- auth ----------------

export async function signup(payload) {
  const res = await fetch(`${API_BASE}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(res, "Failed to sign up");
}

export async function verifySignup(payload) {
  return fetchWithFallback(
    `${API_BASE}/auth/verify-signup`,
    `${API_BASE}/auth/verify`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Failed to verify signup code"
  );
}

export async function login({ email, password }) {
  const form = new URLSearchParams();
  form.append("username", email);
  form.append("password", password);

  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  return handleJsonResponse(res, "Failed to log in");
}

export async function getMe() {
  const res = await fetch(`${API_BASE}/auth/me`, { headers: authHeaders() });
  return handleJsonResponse(res, "Failed to load current user");
}

// ---------------- admin ----------------

export async function getAdminUsers() {
  const res = await fetch(`${API_BASE}/admin/users`, { headers: authHeaders() });
  return handleJsonResponse(res, "Failed to load admin users");
}

export async function getAdminListings() {
  const res = await fetch(`${API_BASE}/admin/listings`, { headers: authHeaders() });
  return handleJsonResponse(res, "Failed to load admin listings");
}

export async function blacklistUser(userId) {
  const res = await fetch(`${API_BASE}/admin/users/${userId}/blacklist`, {
    method: "POST",
    headers: authHeaders(),
  });
  return handleJsonResponse(res, "Failed to blacklist user");
}

export async function unblacklistUser(userId) {
  const res = await fetch(`${API_BASE}/admin/users/${userId}/unblacklist`, {
    method: "POST",
    headers: authHeaders(),
  });
  return handleJsonResponse(res, "Failed to unblacklist user");
}

export async function adminDeleteUser(userId) {
  const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  await handleJsonResponse(res, "Failed to delete user");
  return true;
}

export async function adminDeleteListing(listingId) {
  const res = await fetch(`${API_BASE}/admin/listings/${listingId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  await handleJsonResponse(res, "Failed to delete listing");
  return true;
}
