import React from "react";
import { Link, useLocation } from "react-router-dom";

const CONTENT = {
  terms: {
    title: "Terms of Use",
    sections: [
      {
        h: "Using Insider Library",
        body: "Insider Library is a marketplace for compact, practical knowledge documents. By using the site you agree to follow these terms and our Content Policy.",
      },
      {
        h: "Accounts",
        body: "You are responsible for your account credentials and activity. Do not share access or impersonate others.",
      },
      {
        h: "Purchases & downloads",
        body: "Access to files is granted per listing terms. Paid purchases are recorded on-platform; payment processor integration may be added in a future release.",
      },
      {
        h: "Termination",
        body: "We may suspend accounts or remove content that violates our policies or applicable law.",
      },
    ],
  },
  "content-policy": {
    title: "Content Policy",
    sections: [
      {
        h: "Upload only what you have rights to share",
        body: "You must own the content or have explicit permission to distribute it. No pirated PDFs, stolen documents, or unauthorized copies.",
      },
      {
        h: "Prohibited material",
        body: "Do not upload illegal content, private personal information (doxxing), malware, exploit packs, credentials, private leaks, or material intended to harm others.",
      },
      {
        h: "Reporting",
        body: "Anyone can report a listing. Administrators review reports and may remove content, reject listings, or suspend accounts.",
      },
      {
        h: "DMCA / copyright",
        body: "If you believe content infringes your copyright, report it with details. We will review and remove infringing material when appropriate.",
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    sections: [
      {
        h: "Overview",
        body: "This is a plain-language placeholder. We collect account email, listing metadata, and download/purchase records to operate the library.",
      },
      {
        h: "Data use",
        body: "Information is used to authenticate users, deliver downloads, display reviews, and moderate the platform. We do not sell personal data.",
      },
      {
        h: "Contact",
        body: "For privacy questions, contact the site operator through your deployment's support channel.",
      },
    ],
  },
};

export default function PolicyPage() {
  const location = useLocation();
  const page = location.pathname.replace(/^\//, "") || "terms";
  const doc = CONTENT[page] || CONTENT.terms;

  return (
    <div className="page fade-in panel policy-prose">
      <nav className="breadcrumb">
        <Link to="/">Home</Link> / {doc.title}
      </nav>
      <h1 className="page-title">{doc.title}</h1>
      {doc.sections.map((s) => (
        <div key={s.h}>
          <h2>{s.h}</h2>
          <p className="form-help">{s.body}</p>
        </div>
      ))}
      <p style={{ marginTop: "2rem" }}>
        See also{" "}
        <Link to="/terms">Terms</Link>, <Link to="/content-policy">Content Policy</Link>,{" "}
        <Link to="/privacy">Privacy</Link>.
      </p>
    </div>
  );
}
