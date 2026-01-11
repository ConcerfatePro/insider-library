// frontend/src/HomePage.jsx
import React from "react";
import { useNavigate } from "react-router-dom";

const HomePage = ({ currentUser }) => {
  const navigate = useNavigate();
  const isLoggedIn = !!currentUser;

  const firstName =
    currentUser?.name?.split(" ")[0] ||
    currentUser?.name ||
    currentUser?.email ||
    "";

  return (
    <div className="home-page">
      <div className="home-inner">
        {/* Grid = Rubik-style layout */}
        <div className="home-grid">
          {/* HERO: spans two columns */}
          <section className="home-card home-hero">
            <div className="home-hero-tag">
              {isLoggedIn
                ? `Signed in as ${firstName}`
                : "INSIDER LIBRARY"}
            </div>

            <h1 className="home-hero-title">
              {isLoggedIn ? (
                <>
                  Welcome back, <span>{firstName || "creator"}</span>.
                </>
              ) : (
                <>
                  A quiet place for <span>sharp information</span>.
                </>
              )}
            </h1>

            <p className="home-hero-text">
              {isLoggedIn
                ? "Pick a direction: update your packs, check your activity, or explore new PDFs from other creators."
                : "Upload compact PDFs, price them fairly, and let people discover the insider knowledge you’ve already worked hard to learn."}
            </p>

            <div className="home-hero-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate("/dashboard")}
              >
                {isLoggedIn ? "Open your dashboard" : "Go to dashboard"}
              </button>

              {isLoggedIn ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => navigate("/upload")}
                >
                  Upload a new pack
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => navigate("/listings")}
                >
                  Browse listings
                </button>
              )}
            </div>
          </section>

          {/* STATS / TRUST */}
          <section className="home-card home-stats">
            <h2 className="home-card-title">
              {isLoggedIn ? "Your library at a glance" : "Why a library?"}
            </h2>

            <p className="home-card-text">
              {isLoggedIn
                ? "This space, together with your dashboard, becomes the quick overview of how your information library is doing."
                : "Instead of endless feeds, Insider Library is built like a stack of well-labeled shelves. You come in, find the one thing you need, and get back to real life."}
            </p>

            <div className="home-stats-row">
              <div>
                <div className="home-stat-label">
                  {isLoggedIn ? "Your role" : "Designed for"}
                </div>
                <div className="home-stat-value">
                  {isLoggedIn ? "Creator & learner" : "Clarity"}
                </div>
              </div>
              <div>
                <div className="home-stat-label">Noise level</div>
                <div className="home-stat-value">
                  {isLoggedIn ? "Still quiet" : "Low"}
                </div>
              </div>
            </div>
          </section>

          {/* FOR LEARNERS */}
          <section className="home-card home-learners">
            <h2 className="home-card-title">
              {isLoggedIn ? "Learn from others" : "For learners"}
            </h2>

            {isLoggedIn ? (
              <>
                <ul className="home-list">
                  <li>Browse recent listings to see what others are sharing.</li>
                  <li>Save ideas for future packs by seeing what resonates.</li>
                  <li>Leave honest reviews to support good work.</li>
                </ul>
                <button
                  type="button"
                  className="home-link-button"
                  onClick={() => navigate("/listings")}
                >
                  Explore the library →
                </button>
              </>
            ) : (
              <>
                <ul className="home-list">
                  <li>Find focused PDFs instead of huge textbooks.</li>
                  <li>Sort by category, rating, and recency.</li>
                  <li>Leave honest reviews to help others.</li>
                </ul>
                <button
                  type="button"
                  className="home-link-button"
                  onClick={() => navigate("/listings")}
                >
                  Start browsing →
                </button>
              </>
            )}
          </section>

          {/* FOR CREATORS */}
          <section className="home-card home-creators">
            <h2 className="home-card-title">
              {isLoggedIn ? "Build your shelf" : "For creators"}
            </h2>

            {isLoggedIn ? (
              <>
                <ul className="home-list">
                  <li>Turn your notes, checklists, and slides into packs.</li>
                  <li>Keep your uploads organized by category and purpose.</li>
                  <li>Refine over time based on feedback and reviews.</li>
                </ul>
                <button
                  type="button"
                  className="home-link-button"
                  onClick={() => navigate("/upload")}
                >
                  Go to upload →
                </button>
              </>
            ) : (
              <>
                <ul className="home-list">
                  <li>Turn notes and checklists into proper packs.</li>
                  <li>Attach a PDF and publish in a few clicks.</li>
                  <li>Keep control of pricing and updates.</li>
                </ul>
                <button
                  type="button"
                  className="home-link-button"
                  onClick={() => navigate("/upload")}
                >
                  Publish a pack →
                </button>
              </>
            )}
          </section>

          {/* HOW IT WORKS */}
          <section className="home-card home-how">
            <h2 className="home-card-title">
              {isLoggedIn ? "Next steps for you" : "How it works"}
            </h2>

            <ol className="home-steps">
              <li>
                <span className="step-dot">1</span>
                <div>
                  <div className="step-label">
                    {isLoggedIn ? "Check your dashboard" : "Create an account"}
                  </div>
                  <div className="step-text">
                    {isLoggedIn
                      ? "Glance over your overview tiles and see what needs attention."
                      : "Sign up once, verify with a 6-digit code, and you're in."}
                  </div>
                </div>
              </li>
              <li>
                <span className="step-dot">2</span>
                <div>
                  <div className="step-label">
                    {isLoggedIn ? "Upload or refine" : "Upload a PDF"}
                  </div>
                  <div className="step-text">
                    {isLoggedIn
                      ? "Add a new pack or clean up the description of an existing one."
                      : "Give it a clear title, category, and short description."}
                  </div>
                </div>
              </li>
              <li>
                <span className="step-dot">3</span>
                <div>
                  <div className="step-label">
                    {isLoggedIn ? "Share selectively" : "Share the link"}
                  </div>
                  <div className="step-text">
                    {isLoggedIn
                      ? "Share your links with people who will actually use them, not everyone."
                      : "Your buyers download directly from Insider Library."}
                  </div>
                </div>
              </li>
            </ol>
          </section>

          {/* START HERE */}
          <section className="home-card home-start">
            <h2 className="home-card-title">
              {isLoggedIn ? "Quick links" : "New here?"}
            </h2>

            <p className="home-card-text">
              {isLoggedIn
                ? "Jump straight to the parts of Insider Library that help you ship more and think less about the admin."
                : "If you're just browsing, explore public listings. If you're ready to publish, head straight to your dashboard."}
            </p>

            <div className="home-start-actions">
              {isLoggedIn ? (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => navigate("/account")}
                  >
                    Account settings
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => navigate("/dashboard")}
                  >
                    Open dashboard
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => navigate("/account")}
                  >
                    Create account
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => navigate("/account")}
                  >
                    Log in
                  </button>
                </>
              )}
            </div>
          </section>

          {/* LIBRARY VIBE / FOOTER TILE */}
          <section className="home-card home-vibe">
            <h2 className="home-card-title">
              {isLoggedIn
                ? "Your corner of the night library"
                : "Built like a night library"}
            </h2>
            <p className="home-card-text">
              {isLoggedIn
                ? "As you add more packs, this place should feel like a small, organized wing of the library that only you fully understand."
                : "Dark, quiet, and organized. No pop-ups, no autoplay. Just shelves of tightly-edited PDFs waiting for the right person to pull them off the stack."}
            </p>
            <p className="home-card-text home-card-text-sub">
              {isLoggedIn
                ? "Over time, the home and dashboard views can surface your most-used categories, best-rated packs, and gentle reminders to tidy older uploads."
                : "As Insider Library grows, this page will surface featured topics, trusted creators, and staff picks."}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
