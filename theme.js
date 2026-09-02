/* =========================================================
   Migraine Risk Monitor — Theme (Light / Dark Mode)
   =========================================================
   Applies a data-theme attribute to <html> which style.css
   uses to swap CSS variable values. Preference is persisted
   to localStorage so it survives a refresh.
   ========================================================= */

/** Reads the stored theme preference, falling back to system preference. */
function getPreferredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch (err) {
    console.warn("Theme: localStorage unavailable, using system preference.", err);
  }

  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);

  const button = document.getElementById("themeToggle");
  if (button) {
    const icon = button.querySelector("i");
    if (icon) icon.className = theme === "dark" ? "bi bi-sun" : "bi bi-moon-stars";
    button.setAttribute("aria-pressed", String(theme === "dark"));
    button.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
  }

  // Keep the browser UI (address bar on mobile) in sync with the theme.
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute("content", theme === "dark" ? "#0B1B2B" : "#0F3A5F");
  }
}

function storeTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (err) {
    console.warn("Theme: could not save preference.", err);
  }
}

function initTheme() {
  applyTheme(getPreferredTheme());

  const button = document.getElementById("themeToggle");
  if (!button) return;

  button.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
    storeTheme(next);

    // Redraw the trend chart so its canvas colors match the new theme.
    if (typeof drawTrendChart === "function" && typeof getHistory === "function") {
      safeRun(() => drawTrendChart(getHistory()), "theme change chart redraw");
    }
  });
}
