import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";

import HomePage from "./HomePage";
import DashboardPage from "./DashboardPage";
import ListingsPage from "./ListingsPage";
import UploadPage from "./UploadPage";
import AccountPage from "./AccountPage";
import AdminPage from "./AdminPage";

import { getMe } from "./api";

function App() {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const loadMe = async () => {
      try {
        const me = await getMe();
        setCurrentUser(me);
      } catch {
        setCurrentUser(null);
      }
    };

    loadMe();
  }, []);

  return (
    <BrowserRouter>
      <div className="app-root">
        {/* Top bar */}
        <header className="topbar">
          <div className="topbar-inner">
            {/* Left: brand / logo */}
            <div className="topbar-left">
              <Link to="/" className="brand-link">
                <div className="brand-mark">
                  <span className="brand-symbol" />
                  <span className="brand-text">Insider Library</span>
                </div>
              </Link>
            </div>

            {/* Center: nav links */}
            <nav className="topnav-links">
              <Link to="/" className="topnav-link">
                Home
              </Link>
              <Link to="/dashboard" className="topnav-link">
                Dashboard
              </Link>
              <Link to="/upload" className="topnav-link">
                Upload
              </Link>
              <Link to="/listings" className="topnav-link">
                Listings
              </Link>
            </nav>

            {/* Right: account pill */}
            <div className="topbar-right">
              <Link to="/account" className="topbar-account">
                <span className="account-icon" aria-hidden="true">
                  👤
                </span>
                <span>Account</span>
              </Link>
            </div>
          </div>
        </header>

        {/* Main content area */}
        <main className="app-main">
          <div className="app-container">
            <Routes>
              <Route path="/" element={<HomePage currentUser={currentUser} />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/listings" element={<ListingsPage />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/account" element={<AccountPage />} />

              {/* Admin route */}
              <Route path="/internal-admin-8d14c11" element={<AdminPage />} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
