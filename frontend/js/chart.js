/* =========================================================
   Migraine Risk Monitor — Trend Chart
   =========================================================
   Draws a lightweight MRI-over-time line chart on a <canvas>
   using plain Canvas 2D — no charting library, per the
   project's "vanilla JS only" constraint.
   ========================================================= */

/** Reads the current theme's chart colors from CSS variables. */
function getChartColors() {
  const styles = getComputedStyle(document.documentElement);
  return {
    grid: styles.getPropertyValue("--color-border").trim() || "#E3E9EC",
    text: styles.getPropertyValue("--color-text-muted").trim() || "#5B6B78",
    line: styles.getPropertyValue("--color-teal").trim() || "#0E7C86",
    low: styles.getPropertyValue("--risk-low").trim() || "#2E9E5B",
    medium: styles.getPropertyValue("--risk-medium").trim() || "#B9820A",
    high: styles.getPropertyValue("--risk-high").trim() || "#C1590D",
    severe: styles.getPropertyValue("--risk-severe").trim() || "#C22C22",
  };
}

/**
 * Renders the MRI trend chart from a history array of
 * { t: timestampMs, mri: number } entries covering up to 1 hour.
 */
function drawTrendChart(history) {
  const canvas = document.getElementById("trendChart");
  const emptyState = document.getElementById("trendChartEmpty");
  if (!canvas) return;

  if (!canvas.getContext) {
    if (emptyState) {
      emptyState.textContent = "Your browser does not support chart rendering (canvas unavailable).";
      emptyState.classList.remove("d-none");
    }
    return;
  }

  if (!history || history.length < 2) {
    if (emptyState) emptyState.classList.remove("d-none");
    canvas.classList.add("d-none");
    return;
  }
  if (emptyState) emptyState.classList.add("d-none");
  canvas.classList.remove("d-none");

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Scale the canvas for crisp rendering on high-DPI screens.
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || canvas.parentElement.clientWidth || 600;
  const cssHeight = 220;
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  canvas.style.height = `${cssHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const colors = getChartColors();
  const padding = { top: 12, right: 12, bottom: 24, left: 34 };
  const chartW = cssWidth - padding.left - padding.right;
  const chartH = cssHeight - padding.top - padding.bottom;

  const now = Date.now();
  const oldest = Math.max(now - HISTORY_MAX_AGE_MS, history[0].t);

  const xForTime = (t) => padding.left + ((t - oldest) / (now - oldest || 1)) * chartW;
  const yForScore = (score) => padding.top + chartH - (clampScore(score) / 100) * chartH;

  // --- Background risk bands (subtle, for context) ---
  const bands = [
    { from: 0, to: 29, color: colors.low },
    { from: 30, to: 59, color: colors.medium },
    { from: 60, to: 79, color: colors.high },
    { from: 80, to: 100, color: colors.severe },
  ];
  bands.forEach((band) => {
    ctx.fillStyle = hexToRgba(band.color, 0.06);
    const yTop = yForScore(band.to);
    const yBottom = yForScore(band.from);
    ctx.fillRect(padding.left, yTop, chartW, yBottom - yTop);
  });

  // --- Y-axis gridlines + labels (0/25/50/75/100) ---
  ctx.strokeStyle = colors.grid;
  ctx.fillStyle = colors.text;
  ctx.font = "10px Manrope, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  [0, 25, 50, 75, 100].forEach((tick) => {
    const y = yForScore(tick);
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + chartW, y);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillText(String(tick), padding.left - 6, y);
  });

  // --- X-axis time labels (start / midpoint / now) ---
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const labelPoints = [oldest, (oldest + now) / 2, now];
  labelPoints.forEach((t) => {
    const x = xForTime(t);
    const label = new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    ctx.fillText(label, Math.min(Math.max(x, padding.left + 20), padding.left + chartW - 20), cssHeight - 16);
  });

  // --- The MRI line itself ---
  ctx.beginPath();
  history.forEach((entry, index) => {
    const x = xForTime(entry.t);
    const y = yForScore(entry.mri);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.stroke();

  // --- Latest point marker ---
  const last = history[history.length - 1];
  ctx.beginPath();
  ctx.arc(xForTime(last.t), yForScore(last.mri), 3.5, 0, Math.PI * 2);
  ctx.fillStyle = colors.line;
  ctx.fill();
}

/** Converts a "#RRGGBB" hex color + alpha into an rgba() string. */
function hexToRgba(hex, alpha) {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Redraw the chart on window resize so it stays crisp/responsive.
let chartResizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(chartResizeTimer);
  chartResizeTimer = setTimeout(() => {
    safeRun(() => drawTrendChart(getHistory()), "chart resize redraw");
  }, 200);
});
