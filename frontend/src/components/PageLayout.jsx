/**
 * Standard full-width page wrapper for all routes except the home page.
 */
export function Page({ children, className = "" }) {
  return <div className={`page fade-in ${className}`.trim()}>{children}</div>;
}

export function PageHeader({ eyebrow, title, lead }) {
  return (
    <header className="page-header">
      {eyebrow && <p className="page-eyebrow">{eyebrow}</p>}
      {title && <h1 className="page-title">{title}</h1>}
      {lead && <p className="page-lead">{lead}</p>}
    </header>
  );
}
