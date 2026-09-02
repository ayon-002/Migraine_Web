/* =========================================================
   Migraine Risk Monitor — History & Export
   =========================================================
   Keeps a rolling ~1 hour log of MRI readings in localStorage
   so the trend chart survives a page refresh, and provides
   JSON/CSV export of the current reading and history.

   All storage access is wrapped in try/catch: localStorage can
   throw in private-browsing modes or when disabled by policy,
   and the app should degrade gracefully (no persistence, no
   crash) rather than break the whole dashboard.
   ========================================================= */

let historyCache = null; // in-memory copy, avoids re-parsing localStorage constantly

/** Loads history from localStorage once, caching it for subsequent calls. */
function getHistory() {
  if (historyCache) return historyCache;

  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    historyCache = Array.isArray(parsed) ? pruneHistory(parsed) : [];
  } catch (err) {
    console.warn("History: could not read stored data, starting fresh.", err);
    historyCache = [];
  }
  return historyCache;
}

/** Removes entries older than HISTORY_MAX_AGE_MS. */
function pruneHistory(entries) {
  const cutoff = Date.now() - HISTORY_MAX_AGE_MS;
  return entries.filter((entry) => entry && typeof entry.t === "number" && entry.t >= cutoff);
}

/** Persists the given history array, trimming it if storage quota is hit. */
function saveHistory(entries) {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries));
  } catch (err) {
    console.warn("History: save failed, attempting to trim and retry.", err);
    try {
      const trimmed = entries.slice(Math.floor(entries.length / 2));
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(trimmed));
      historyCache = trimmed;
    } catch (retryErr) {
      console.error("History: retry also failed, persistence disabled for this session.", retryErr);
    }
  }
}

/** Appends one new reading to history, prunes old entries, and saves. */
function pushReading(data) {
  const entry = {
    t: Date.now(),
    mri: data.MRI,
    risk: data.risk,
    sensors: { ...data.sensors },
  };

  const history = getHistory();
  history.push(entry);
  historyCache = pruneHistory(history);
  saveHistory(historyCache);
  return historyCache;
}

/** Clears all stored history (used by the "Reset history" control, if present). */
function clearHistory() {
  historyCache = [];
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch (err) {
    console.warn("History: could not clear storage.", err);
  }
}

// ---------------------------------------------------------
// Export
// ---------------------------------------------------------

function exportCurrentReadingJSON(data) {
  const payload = {
    exportedAt: new Date().toISOString(),
    reading: data,
  };
  const ok = downloadTextFile(
    `migraine-reading-${Date.now()}.json`,
    JSON.stringify(payload, null, 2),
    "application/json"
  );
  showExportFeedback(ok, "Current reading exported as JSON.");
}

function exportHistoryCSV() {
  const history = getHistory();
  if (!history.length) {
    showExportFeedback(false, "No history yet to export.");
    return;
  }

  const header = "timestamp_iso,mri,risk,temperature_c,co2_ppm,sound_db,light_lux";
  const rows = history.map((entry) => {
    const s = entry.sensors || {};
    return [
      new Date(entry.t).toISOString(),
      entry.mri,
      entry.risk,
      s.temperature ?? "",
      s.co2_ppm ?? "",
      s.db ?? "",
      s.lux ?? "",
    ].join(",");
  });

  const csv = [header, ...rows].join("\n");
  const ok = downloadTextFile(`migraine-history-${Date.now()}.csv`, csv, "text/csv");
  showExportFeedback(ok, "History exported as CSV.");
}

/** Small reusable feedback line under the export buttons (success or failure). */
function showExportFeedback(success, message) {
  const el = document.getElementById("exportFeedback");
  if (!el) return;
  el.textContent = success ? message : "Export failed. Your browser may be blocking downloads.";
  el.classList.toggle("text-danger", !success);
  el.classList.toggle("text-muted", success);
  el.classList.remove("d-none");
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => el.classList.add("d-none"), 4000);
}

function initExportButtons() {
  const jsonBtn = document.getElementById("exportJsonBtn");
  const csvBtn = document.getElementById("exportCsvBtn");

  if (jsonBtn) {
    jsonBtn.addEventListener("click", () => {
      safeRun(() => {
        const data = getLatestData();

        if (!data) {
          showExportFeedback(
            false,
            "No live reading available yet."
          );
          return;
        }

        exportCurrentReadingJSON(data);
      }, "export JSON");
    });
  }

  if (csvBtn) {
    csvBtn.addEventListener("click", () => {
      safeRun(
        () => exportHistoryCSV(),
        "export CSV"
      );
    });
  }
}
