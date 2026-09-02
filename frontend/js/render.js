/* =========================================================
   Migraine Risk Monitor — Render Functions
   =========================================================
   Pure "take data, update the DOM" functions. No timers or
   data generation live here — see app.js for the simulation
   loop that calls into this file.
   ========================================================= */

let lastUpdateTimestamp = Date.now();

/** Top-level entry point: renders every section from a data object. */
function updateDashboard(data) {
  safeRun(() => updateRisk(data), "updateRisk");
  safeRun(() => updateSensors(data.sensors), "updateSensors");
  safeRun(() => updateTriggers(data.sensors), "updateTriggers");
  lastUpdateTimestamp = Date.now();
  safeRun(() => updateTimestamps(), "updateTimestamps");
}

/** Updates the hero risk card: badge, gauge, dominant trigger, summary text. */
function updateRisk(data) {
  const risk = data.risk;
  const mri = data.MRI;

  setText("mriValue", formatValue(mri, 1));
  setText("mriScoreText", formatValue(mri, 1));

  const triggerConfig = SENSOR_CONFIG[mapTriggerKey(data.dominant_trigger)];
  const triggerLabel = triggerConfig?.triggerLabel || data.dominant_trigger;
  const triggerIcon = triggerConfig?.icon || "bi-exclamation-circle";

  const triggerEl = document.getElementById("dominantTrigger");
  if (triggerEl) triggerEl.innerHTML = `<i class="bi ${triggerIcon}" aria-hidden="true"></i> ${triggerLabel}`;

  // Draw the gauge arc based on the MRI score (0-100 -> 0-283 dash length).
  const gaugeFill = document.getElementById("gaugeFill");
  if (gaugeFill) {
    const dashLength = (mri / 100) * GAUGE_PATH_LENGTH;
    gaugeFill.style.strokeDasharray = `${dashLength} ${GAUGE_PATH_LENGTH}`;
  }

  updateRiskLevel(risk, mri);
}

/**
 * Applies a risk level (LOW/MEDIUM/HIGH/SEVERE) across every part of the
 * UI that depends on it: badge, MRI scale highlight, and recommendations.
 */
function updateRiskLevel(risk, mri) {
  const meta = RISK_LEVELS[risk] || RISK_LEVELS.MEDIUM;
  const recommendation = RECOMMENDATIONS[risk] || RECOMMENDATIONS.MEDIUM;

  const badgeColorClass = { LOW: "normal", MEDIUM: "moderate", HIGH: "elevated", SEVERE: "severe" }[risk];
  const riskVar = { normal: "low", moderate: "medium", elevated: "high", severe: "severe" }[badgeColorClass];

  // Risk badges (hero + MRI section)
  document.querySelectorAll(".risk-badge").forEach((el) => {
    el.textContent = meta.label;
    el.dataset.risk = risk;
    el.className = `risk-badge status-chip--${badgeColorClass}`;
  });

  const summaries = {
    LOW: "Environmental conditions show a low combined risk for migraine onset.",
    MEDIUM: "Environmental conditions show a moderate combined risk for migraine onset.",
    HIGH: "Environmental conditions show an elevated combined risk for migraine onset.",
    SEVERE: "Environmental conditions show a severe combined risk for migraine onset.",
  };
  setText("riskSummary", summaries[risk]);

  // Highlight the matching range on the MRI scale
  document.querySelectorAll(".mri-scale__range").forEach((el) => {
    el.classList.toggle("is-active", el.dataset.range === risk);
  });
  const scaleFill = document.getElementById("mriScaleFill");
  const scaleMarker = document.getElementById("mriScaleMarker");
  if (scaleFill) scaleFill.style.width = `${mri}%`;
  if (scaleMarker) scaleMarker.style.left = `${mri}%`;

  // Recommendation card
  const card = document.getElementById("recommendationCard");
  if (card) {
    card.dataset.risk = risk;
    card.style.borderLeftColor = `var(--risk-${riskVar})`;
    setText("recommendationMessage", recommendation.message);

    const list = document.getElementById("recommendationList");
    if (list) {
      list.innerHTML = recommendation.items
        .map((item) => `<li><i class="bi bi-check2-circle" aria-hidden="true"></i> ${item}</li>`)
        .join("");
    }

    const icon = card.querySelector(".recommendation-card__icon");
    if (icon) icon.style.color = `var(--risk-${riskVar})`;
  }

  checkRiskAlert(risk, mri);
}

/** Renders the four sensor overview cards + environmental conditions panel. */
function updateSensors(sensors) {
  const readings = {
    temperature: sensors.temperature,
    co2: sensors.co2_ppm,
    sound: sensors.db,
    light: sensors.lux,
  };

  Object.entries(readings).forEach(([key, value]) => {
    const config = SENSOR_CONFIG[key];
    const formatted = formatValue(value, config.decimals);
    const score = config.score(value);
    const status = statusForScore(score);

    setText(`value-${key}`, formatted);

    const statusEl = document.getElementById(`status-${key}`);
    if (statusEl) {
      statusEl.textContent = status.label;
      statusEl.className = `status-chip status-chip--${status.chip}`;
    }

    setText(`env-${key}`, `${formatted} ${config.unit}`);

    const envBarEl = document.getElementById(`env-bar-${key}`);
    if (envBarEl) {
      envBarEl.style.width = `${score}%`;
      envBarEl.className = `env-bar__fill env-bar__fill--${status.chip}`;
    }
  });
}

/** Renders the Trigger Analysis section (scores + progress bars). */
function updateTriggers(sensors) {
  const readings = {
    temperature: sensors.temperature,
    co2: sensors.co2_ppm,
    sound: sensors.db,
    light: sensors.lux,
  };

  Object.entries(readings).forEach(([key, value]) => {
    const config = SENSOR_CONFIG[key];
    const formatted = formatValue(value, config.decimals);
    const score = config.score(value);
    const status = statusForScore(score);
    const triggerKey = key === "sound" ? "noise" : key;

    setText(`trigger-${triggerKey}-value`, `${formatted} ${config.unit}`);
    setText(`trigger-${triggerKey}-score`, score);

    const barEl = document.getElementById(`trigger-${triggerKey}-bar`);
    if (barEl) {
      barEl.style.width = `${score}%`;
      barEl.className = `trigger-bar__fill trigger-bar__fill--${status.chip}`;
    }

    const itemEl = document.getElementById(`trigger-${triggerKey}`);
    const statusChipEl = itemEl?.querySelector(".trigger-item__status");
    if (statusChipEl) {
      statusChipEl.textContent = status.label;
      statusChipEl.className = `trigger-item__status status-chip status-chip--${status.chip}`;
    }
  });
}

/** Refreshes all "time ago" labels from the stored lastUpdateTimestamp. */
function updateTimestamps() {
  const relative = formatRelativeTime(lastUpdateTimestamp);
  const heroEl = document.getElementById("lastUpdated");
  if (heroEl) heroEl.innerHTML = `<i class="bi bi-clock-history" aria-hidden="true"></i> Last updated: ${relative}`;
  setText("lastDataReceived", relative);
}
