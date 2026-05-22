import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Link, NavLink, useLocation } from "react-router-dom";

import HomePage from "./HomePage";
import DashboardPage from "./DashboardPage";
import BrowsePage from "./BrowsePage";
import ListingDetailPage from "./ListingDetailPage";
import MyLibraryPage from "./MyLibraryPage";
import MyListingsPage from "./MyListingsPage";
import UploadPage from "./UploadPage";
import AccountPage from "./AccountPage";
import AdminPage from "./AdminPage";
import PolicyPage from "./PolicyPage";

import { getMe } from "./api";
import ThemeToggle from "./components/ThemeToggle";

function NavLinks({ currentUser }) {
  return (
    <>
      <NavLink to="/browse" className={({ isActive }) => `topnav-link${isActive ? " active" : ""}`}>
        Browse
      </NavLink>
      {currentUser && (
        <>
          <NavLink to="/upload" className={({ isActive }) => `topnav-link${isActive ? " active" : ""}`}>
            Upload
          </NavLink>
          <NavLink to="/library" className={({ isActive }) => `topnav-link${isActive ? " active" : ""}`}>
            My Library
          </NavLink>
          <NavLink to="/dashboard" className={({ isActive }) => `topnav-link${isActive ? " active" : ""}`}>
            Dashboard
          </NavLink>
        </>
      )}
      {currentUser?.is_admin && (
        <NavLink
          to="/internal-admin-8d14c11"
          className={({ isActive }) => `topnav-link${isActive ? " active" : ""}`}
        >
          Admin
        </NavLink>
      )}
    </>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <span>© Insider Library — focused knowledge, quietly kept.</span>
        <div className="footer-links">
          <Link to="/terms">Terms</Link>
          <Link to="/content-policy">Content Policy</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/account">Account</Link>
        </div>
      </div>
    </footer>
  );
}

function AppShell() {
  const [currentUser, setCurrentUser] = useState(null);
  const location = useLocation();

  useEffect(() => {
    getMe()
      .then(setCurrentUser)
      .catch(() => setCurrentUser(null));
  }, [location.pathname]);

  return (
    <div className="app-root">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand-link topbar-brand">
            <div className="brand-mark">
              <span className="brand-text">Insider Library</span>
              <span className="brand-sub">Archive</span>
            </div>
          </Link>
          <nav className="topnav-links" aria-label="Main">
            <NavLinks currentUser={currentUser} />
          </nav>
          <div className="topbar-actions">
            <ThemeToggle />
            <Link to="/account" className="topbar-account">
              {currentUser ? currentUser.name.split(" ")[0] : "Login"}
            </Link>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="app-container">
          <Routes>
            <Route path="/" element={<HomePage currentUser={currentUser} />} />
            <Route path="/browse" element={<BrowsePage />} />
            <Route path="/listings" element={<BrowsePage />} />
            <Route path="/pack/:id" element={<ListingDetailPage />} />
            <Route path="/library" element={<MyLibraryPage />} />
            <Route path="/my-listings" element={<MyListingsPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/terms" element={<PolicyPage />} />
            <Route path="/content-policy" element={<PolicyPage />} />
            <Route path="/privacy" element={<PolicyPage />} />
            <Route path="/internal-admin-8d14c11" element={<AdminPage />} />
          </Routes>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

export default App;
