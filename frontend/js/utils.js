/* =========================================================
   Migraine Risk Monitor — Utilities
   =========================================================
   Small, pure helper functions shared across the other files.
   No DOM updates happen here — just calculations and formatting.
   ========================================================= */

/** Keeps a score within the 0–100 range. */
function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Returns the status word + status-chip class for a given 0–100 score. */
function statusForScore(score) {
  if (score >= 80) return { label: "Severe", chip: "severe" };
  if (score >= 60) return { label: "Elevated", chip: "elevated" };
  if (score >= 40) return { label: "Moderate", chip: "moderate" };
  return { label: "Normal", chip: "normal" };
}

/** Determines which named risk band (LOW/MEDIUM/HIGH/SEVERE) a score falls into. */
function riskLevelForScore(score) {
  if (score >= 80) return "SEVERE";
  if (score >= 60) return "HIGH";
  if (score >= 30) return "MEDIUM";
  return "LOW";
}

/** Maps the incoming sensor keys (lux/db/...) to internal SENSOR_CONFIG keys. */
function mapTriggerKey(key) {
  const map = { noise: "sound", db: "sound", lux: "light", co2_ppm: "co2", temperature: "temperature" };
  return map[key] || key;
}

function formatValue(value, decimals) {
  return Number(value).toFixed(decimals);
}

/** Sets textContent on an element by id, no-op if the element isn't found. */
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/** Turns a millisecond timestamp into a short "X seconds/minutes ago" string. */
function formatRelativeTime(timestampMs) {
  const diffSeconds = Math.max(0, Math.round((Date.now() - timestampMs) / 1000));
  if (diffSeconds < 5) return "Just now";
  if (diffSeconds < 60) return `${diffSeconds} seconds ago`;
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  const diffHours = Math.round(diffMinutes / 60);
  return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
}

/**
 * Triggers a browser download for the given text content.
 * Wrapped in try/catch since Blob/URL APIs can be restricted
 * in some locked-down or private-browsing environments.
 */
function downloadTextFile(filename, content, mimeType) {
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error("Download failed:", err);
    return false;
  }
}

/** Safe wrapper: runs fn and logs+swallows any error instead of crashing the app. */
function safeRun(fn, context) {
  try {
    fn();
  } catch (err) {
    console.error(`Error in ${context || "unnamed operation"}:`, err);
  }
}
