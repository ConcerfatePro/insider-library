const STORAGE_KEY = "insider-theme";

export function getTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(theme) {
  const t = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", t);
  try {
    localStorage.setItem(STORAGE_KEY, t);
  } catch {
    /* ignore */
  }
  return t;
}

export function initTheme() {
  return applyTheme(getTheme());
}

export function toggleTheme() {
  return applyTheme(getTheme() === "dark" ? "light" : "dark");
}
