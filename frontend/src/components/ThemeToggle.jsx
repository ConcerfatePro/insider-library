import React, { useState } from "react";
import { getTheme, toggleTheme } from "../theme";

export default function ThemeToggle() {
  const [theme, setTheme] = useState(getTheme);

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => setTheme(toggleTheme())}
      aria-label={theme === "dark" ? "Switch to dim light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Dim mode" : "Dark mode"}
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        {theme === "dark" ? "◐" : "◑"}
      </span>
      <span className="theme-toggle-label">{theme === "dark" ? "Dim" : "Dark"}</span>
    </button>
  );
}
