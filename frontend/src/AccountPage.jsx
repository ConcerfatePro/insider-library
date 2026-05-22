import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { API_BASE, getMe, signup, verifySignup, login } from "./api";

function EyeIcon({ open = false }) {
  // open=false => eye (hidden), open=true => eye-off (visible state)
  // (Naming here is just "open", meaning "show password")
  return open ? (
    // Eye-off icon
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 3l18 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M10.58 10.58A2 2 0 0 0 12 14a2 2 0 0 0 1.42-.58"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M9.9 5.07A10.9 10.9 0 0 1 12 5c7 0 10 7 10 7a18.2 18.2 0 0 1-4.34 5.32"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M6.11 6.11C2.99 8.28 2 12 2 12s3 7 10 7c1.22 0 2.36-.21 3.4-.58"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ) : (
    // Eye icon
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  required = true,
  inputClassName = "input",
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="form-field">
      <label className="form-label">{label}</label>

      <div style={{ position: "relative" }}>
        <input
          className={inputClassName}
          type={show ? "text" : "password"}
          value={value}
          onChange={onChange}
          required={required}
          placeholder={placeholder}
          style={{ paddingRight: "2.6rem" }}
        />

        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          style={{
            position: "absolute",
            right: "0.6rem",
            top: "50%",
            transform: "translateY(-50%)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "2rem",
            height: "2rem",
            borderRadius: "10px",
            border: "1px solid rgba(148, 163, 184, 0.18)",
            background: "rgba(2, 8, 22, 0.35)",
            color: "rgba(226, 232, 240, 0.9)",
            cursor: "pointer",
          }}
        >
          <EyeIcon open={show} />
        </button>
      </div>
    </div>
  );
}

function AccountPage() {
  const location = useLocation();

  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // signup state
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupStep, setSignupStep] = useState("form"); // "form" | "verify"
  const [signupCode, setSignupCode] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");

  // resend state
  const RESEND_SECONDS = 30;
  const [resendRemaining, setResendRemaining] = useState(0);
  const [resending, setResending] = useState(false);

  // login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // password reset UI state
  const [resetStep, setResetStep] = useState("off"); // "off" | "request" | "reset"
  const [resetEmail, setResetEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  // ---------- helpers ----------
  async function jsonFetch(path, { method = "GET", body } = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const msg = data?.detail || data?.message || `Request failed (${res.status})`;
      const err = new Error(String(msg));
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // ---------- load user ----------
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const me = await getMe();
        setCurrentUser(me);
      } catch (e) {
        console.error(e);
        setCurrentUser(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // ---------- if reset token is in URL, open reset panel ----------
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const t = params.get("resetToken");
    if (t && !currentUser) {
      setResetToken(t);
      setResetStep("reset");
      setSuccess("Paste a new password to reset your account.");
    }
  }, [location.search, currentUser]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    setCurrentUser(null);
    setSuccess("You’ve been logged out.");
  };

  // ---------- resend countdown timer ----------
  useEffect(() => {
    if (signupStep !== "verify") return;
    if (resendRemaining <= 0) return;

    const t = window.setInterval(() => {
      setResendRemaining((s) => Math.max(0, s - 1));
    }, 1000);

    return () => window.clearInterval(t);
  }, [signupStep, resendRemaining]);

  // ---------- signup + verify ----------
  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      await signup({
        name: signupName,
        email: signupEmail,
        password: signupPassword,
      });

      setPendingEmail(signupEmail);
      setSignupStep("verify");
      setResendRemaining(RESEND_SECONDS);

      setSuccess("Sign up successful. A 6-digit code has been sent to your email.");
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to sign up. Please check your details and try again.");
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const res = await verifySignup({
        email: pendingEmail,
        code: signupCode,
      });

      localStorage.setItem("token", res.access_token);
      const me = await getMe();
      setCurrentUser(me);

      // reset signup fields
      setSignupStep("form");
      setSignupName("");
      setSignupEmail("");
      setSignupPassword("");
      setSignupCode("");
      setPendingEmail("");
      setResendRemaining(0);
      setResending(false);

      setSuccess("Your email has been verified and you’re now signed in.");
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to verify code. Please double-check and try again.");
    }
  };

  const handleResendCode = async () => {
    if (!pendingEmail) return;

    setError("");
    setSuccess("");

    try {
      setResending(true);

      await signup({
        name: signupName,
        email: pendingEmail,
        password: signupPassword,
      });

      setSuccess("Verification code re-sent. Please check your email.");
      setResendRemaining(RESEND_SECONDS);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Could not resend the code yet. Please wait and try again.");
    } finally {
      setResending(false);
    }
  };

  // ---------- login ----------
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const res = await login({
        email: loginEmail,
        password: loginPassword,
      });
      localStorage.setItem("token", res.access_token);
      const me = await getMe();
      setCurrentUser(me);

      setLoginEmail("");
      setLoginPassword("");
      setSuccess("Logged in successfully.");
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to log in. Check your email/password and try again.");
    }
  };

  // ---------- password reset ----------
  const handleRequestReset = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      await jsonFetch("/auth/request-password-reset", {
        method: "POST",
        body: { email: resetEmail },
      });

      setResetStep("reset");
      setSuccess("If an account exists for that email, a reset link has been sent.");
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to request password reset.");
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      setResetting(true);
      await jsonFetch("/auth/reset-password", {
        method: "POST",
        body: { token: resetToken, new_password: resetNewPassword },
      });

      setSuccess("Password updated. You can now log in.");
      setResetToken("");
      setResetNewPassword("");
      setResetEmail("");
      setResetStep("off");
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to reset password.");
    } finally {
      setResetting(false);
    }
  };

  const resendLabel = useMemo(() => {
    if (resending) return "Resending…";
    if (resendRemaining > 0) return `Resend in ${resendRemaining}s`;
    return "Resend code";
  }, [resending, resendRemaining]);

  // ---------- render ----------
  return (
    <div className="page fade-in">
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

        {loading ? (
          <section className="panel">
            <p className="page-eyebrow">Account</p>
            <h1 className="page-title">Loading your account…</h1>
            <p className="page-lead">
              Checking your authentication status with Insider Library.
            </p>
          </section>
        ) : currentUser ? (
          <div className="page-stack">
            <header className="page-header">
              <p className="page-eyebrow">Account</p>
              <h1 className="page-title">Your Insider Library account</h1>
              <p className="page-lead">
                Your identity in the archive. Name and email appear on packs you publish.
              </p>
            </header>

            <div className="account-layout">
              <section className="panel">
                <h2 className="section-heading">Profile</h2>
                <div className="account-info-grid">
                  <div className="account-info-row">
                    <div className="account-label">Name</div>
                    <div className="account-value">{currentUser.name || "—"}</div>
                  </div>
                  <div className="account-info-row">
                    <div className="account-label">Email</div>
                    <div className="account-value">{currentUser.email}</div>
                  </div>
                  <div className="account-info-row">
                    <div className="account-label">Role</div>
                    <div className="account-value">
                      {currentUser.is_admin ? "Admin" : "User"}
                    </div>
                  </div>
                  <div className="account-info-row">
                    <div className="account-label">Status</div>
                    <div className="account-value">
                      {currentUser.is_active ? "Active" : "Inactive"}
                    </div>
                  </div>
                </div>

                <div className="page-actions">
                  <Link to="/dashboard" className="btn btn-primary">
                    Go to dashboard
                  </Link>
                  <Link to="/browse" className="btn btn-ghost">
                    Browse library
                  </Link>
                  <Link to="/my-listings" className="btn btn-ghost">
                    My listings
                  </Link>
                </div>
              </section>

              <section className="panel">
                <h2 className="section-heading">Security & session</h2>
                <p className="section-lead" style={{ margin: "0 0 1rem" }}>
                  You signed up with email verification (6-digit code). Password reset is
                  available from the login screen when signed out.
                </p>
                <div className="page-actions">
                  <button type="button" className="btn btn-ghost" onClick={handleLogout}>
                    Log out
                  </button>
                </div>
              </section>
            </div>

            {currentUser.is_admin ? (
              <section className="panel admin-callout">
                <h2 className="section-heading">Admin access</h2>
                <p className="section-lead" style={{ margin: "0 0 1rem" }}>
                  Your account has administrator privileges. Open the control panel to
                  manage users, listings, and reports.
                </p>
                <Link to="/internal-admin-8d14c11" className="btn btn-primary">
                  Open admin panel
                </Link>
              </section>
            ) : null}
          </div>
        ) : (
          // ================= LOGGED OUT VIEW =================
          <>
            <header className="page-header">
              <p className="page-eyebrow">Account</p>
              <h1 className="page-title">Sign in or create an account</h1>
              <p className="page-lead">
                Access your library, upload knowledge packs, and leave verified reviews.
              </p>
            </header>
            <div className="account-auth-layout">
            <section className="panel">
              <p className="page-eyebrow">Log in</p>
              <h1 className="section-heading">Welcome back</h1>
              <p className="section-lead">
                Sign in to access your dashboard, manage uploads, and track your listings.
              </p>

              <form onSubmit={handleLoginSubmit}>
                <div className="form-grid">
                  <div className="form-field">
                    <label className="form-label">Email</label>
                    <input
                      className="input"
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                    />
                  </div>

                  <PasswordField
                    label="Password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />

                  <div className="form-field" style={{ alignSelf: "flex-end" }}>
                    <button type="submit" className="btn btn-primary">
                      Log in
                    </button>
                  </div>

                  <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        setResetStep((s) => (s === "off" ? "request" : "off"));
                        setError("");
                        setSuccess("");
                      }}
                      style={{ width: "100%" }}
                    >
                      Forgot password?
                    </button>
                  </div>
                </div>
              </form>

              {resetStep !== "off" && (
                <div className="inset-panel">
                  {resetStep === "request" ? (
                    <form onSubmit={handleRequestReset}>
                      <div className="metric-label" style={{ marginBottom: "0.35rem" }}>
                        Reset password
                      </div>
                      <div className="form-grid">
                        <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                          <label className="form-label">Email</label>
                          <input
                            className="input"
                            type="email"
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                            required
                            placeholder="you@example.com"
                          />
                        </div>
                        <div className="form-field" style={{ alignSelf: "flex-end" }}>
                          <button type="submit" className="btn btn-primary">
                            Send reset email
                          </button>
                        </div>
                        <div className="form-field" style={{ alignSelf: "flex-end" }}>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => setResetStep("off")}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </form>
                  ) : (
                    <form onSubmit={handleResetPassword}>
                      <div className="metric-label" style={{ marginBottom: "0.35rem" }}>
                        Enter reset token + new password
                      </div>
                      <div className="form-grid">
                        <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                          <label className="form-label">Reset token</label>
                          <input
                            className="input"
                            type="text"
                            value={resetToken}
                            onChange={(e) => setResetToken(e.target.value)}
                            required
                            placeholder="Paste token from your email"
                          />
                        </div>

                        <PasswordField
                          label="New password"
                          value={resetNewPassword}
                          onChange={(e) => setResetNewPassword(e.target.value)}
                          required
                          placeholder="At least 8 characters"
                        />

                        <div className="form-field" style={{ alignSelf: "flex-end" }}>
                          <button type="submit" className="btn btn-primary" disabled={resetting}>
                            {resetting ? "Resetting…" : "Reset password"}
                          </button>
                        </div>
                        <div className="form-field" style={{ alignSelf: "flex-end" }}>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => setResetStep("request")}
                            disabled={resetting}
                          >
                            Back
                          </button>
                        </div>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </section>

            <section className="panel">
              <p className="page-eyebrow">Sign up</p>
              <h1 className="section-heading">Create an account</h1>
              <p className="section-lead">
                New here? Create an Insider Library account to publish info packs and leave reviews.
              </p>

              {signupStep === "form" ? (
                <form onSubmit={handleSignupSubmit}>
                  <div className="form-grid">
                    <div className="form-field">
                      <label className="form-label">Name</label>
                      <input
                        className="input"
                        type="text"
                        value={signupName}
                        onChange={(e) => setSignupName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Email</label>
                      <input
                        className="input"
                        type="email"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        required
                      />
                    </div>

                    <PasswordField
                      label="Password"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      required
                    />

                    <div className="form-field" style={{ alignSelf: "flex-end" }}>
                      <button type="submit" className="btn btn-primary">
                        Sign up
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleVerifyCode}>
                  <p className="section-lead" style={{ marginBottom: "0.8rem" }}>
                    Enter the 6-digit code sent to <strong>{pendingEmail}</strong>.
                  </p>

                  <div className="form-grid">
                    <div className="form-field">
                      <label className="form-label">Verification code</label>
                      <input
                        className="input"
                        type="text"
                        value={signupCode}
                        onChange={(e) => setSignupCode(e.target.value)}
                        required
                        maxLength={6}
                      />
                    </div>

                    <div className="form-field" style={{ alignSelf: "flex-end" }}>
                      <button type="submit" className="btn btn-primary">
                        Verify
                      </button>
                    </div>

                    <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={handleResendCode}
                        disabled={resending || resendRemaining > 0}
                        style={{ width: "100%" }}
                      >
                        {resendLabel}
                      </button>
                    </div>

                    <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => {
                          setSignupStep("form");
                          setSignupCode("");
                          setPendingEmail("");
                          setResendRemaining(0);
                          setResending(false);
                          setError("");
                          setSuccess("");
                        }}
                        style={{ width: "100%" }}
                      >
                        ← Back to sign up
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </section>
          </div>
          </>
        )}
    </div>
  );
}

export default AccountPage;
