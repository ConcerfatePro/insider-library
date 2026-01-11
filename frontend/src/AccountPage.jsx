import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMe, signup, verifySignup, login } from "./api";

function AccountPage() {
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

  // login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

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

  const handleLogout = () => {
    localStorage.removeItem("token");
    setCurrentUser(null);
    setSuccess("You’ve been logged out.");
  };

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
      setSuccess(
        "Sign up successful. A 6-digit code has been sent to your email (in dev, check backend console)."
      );
    } catch (err) {
      console.error(err);
      setError("Failed to sign up. Please check your details and try again.");
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

      setSuccess("Your email has been verified and you’re now signed in.");
    } catch (err) {
      console.error(err);
      setError("Failed to verify code. Please double-check and try again.");
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
      setError("Failed to log in. Check your email/password and try again.");
    }
  };

  // ---------- render ----------

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

        {loading ? (
          <section className="card">
            <div className="home-section-label">Account</div>
            <h2 className="section-title">Loading your account…</h2>
            <p className="home-hero-subtitle">
              Checking your authentication status with Insider Library.
            </p>
          </section>
        ) : currentUser ? (
          // ================= LOGGED IN VIEW =================
          <div className="account-layout">
            <section className="card">
              <div className="home-section-label">Account</div>
              <h2 className="section-title">Your Insider Library account</h2>
              <p className="home-hero-subtitle">
                This is your identity inside the library. Your name and email
                help buyers know who created each info pack.
              </p>

              <div className="account-info-grid">
                <div className="account-info-row">
                  <div className="account-label">Name</div>
                  <div className="account-value">
                    {currentUser.name || "—"}
                  </div>
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

              <div className="home-hero-actions" style={{ marginTop: "1rem" }}>
                <Link to="/dashboard" className="btn btn-primary">
                  Go to dashboard
                </Link>
                <Link to="/listings" className="btn btn-ghost">
                  Browse listings
                </Link>
              </div>
            </section>

            <section className="card">
              <div className="home-section-label">Profile & security</div>
              <h3 className="section-title">Security & session</h3>
              <p className="home-hero-subtitle">
                You signed up with email-based verification (6-digit code).
                In future updates, you&apos;ll be able to change your profile
                details and password from here.
              </p>

              <ul className="upload-guidelines">
                <li>
                  Keep your account email secure; it&apos;s used for login and
                  verification codes.
                </li>
                <li>
                  Don&apos;t share your account with others—listings are tied to
                  your identity.
                </li>
                <li>
                  If you ever suspect suspicious activity, change your password
                  and contact the Insider Library admin
                </li>
              </ul>

              <div className="home-hero-actions" style={{ marginTop: "1.1rem" }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleLogout}
                >
                  Log out
                </button>
              </div>
            </section>
          </div>
        ) : (
          // ================= LOGGED OUT VIEW =================
          <div className="account-auth-layout">
            {/* Login card */}
            <section className="card">
              <div className="home-section-label">Log in</div>
              <h2 className="section-title">Welcome back</h2>
              <p className="home-hero-subtitle">
                Sign in to access your dashboard, manage uploads, and track
                your listings.
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
                  <div className="form-field">
                    <label className="form-label">Password</label>
                    <input
                      className="input"
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-field" style={{ alignSelf: "flex-end" }}>
                    <button type="submit" className="btn btn-primary">
                      Log in
                    </button>
                  </div>
                </div>
              </form>
            </section>

            {/* Signup / verify card */}
            <section className="card">
              <div className="home-section-label">Sign up</div>
              <h2 className="section-title">Create an account</h2>
              <p className="home-hero-subtitle">
                New here? Create an Insider Library account to publish info
                packs and leave reviews.
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
                    <div className="form-field">
                      <label className="form-label">Password</label>
                      <input
                        className="input"
                        type="password"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-field" style={{ alignSelf: "flex-end" }}>
                      <button type="submit" className="btn btn-primary">
                        Sign up
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleVerifyCode}>
                  <p className="home-hero-subtitle" style={{ marginBottom: "0.8rem" }}>
                    Enter the 6-digit code sent to{" "}
                    <strong>{pendingEmail}</strong>.  
                    (In dev, the code is logged in the backend console.)
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
                  </div>
                </form>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

export default AccountPage;
