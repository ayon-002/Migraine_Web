/* =========================================================
   Migraine Risk Monitor — Configuration & Demo Data
   =========================================================
   All static data, copy, and tunable constants live here so
   nothing important is buried inside logic files. Load this
   file first — everything else depends on it.
   ========================================================= */

// This mirrors the exact JSON shape the backend will return
// from GET /api/latest, so swapping to live data later only
// requires changing where this object comes from.
const demoData = {
  sensors: {
    lux: 450,
    db: 62,
    temperature: 28.5,
    co2_ppm: 850,
  },
  MRI: 35.6,
  risk: "MEDIUM",
  dominant_trigger: "noise",
};

// Risk level metadata used across the UI (colors, labels, order).
const RISK_LEVELS = {
  LOW: { label: "Low", min: 0, max: 29 },
  MEDIUM: { label: "Medium", min: 30, max: 59 },
  HIGH: { label: "High", min: 60, max: 79 },
  SEVERE: { label: "Severe", min: 80, max: 100 },
};

// Recommendation copy per risk level. Kept as "monitoring
// recommendations", never as medical advice or diagnosis.
const RECOMMENDATIONS = {
  LOW: {
    message: "Environmental conditions currently show a low combined risk indication.",
    items: [
      "Current environmental settings appear favorable.",
      "Continue routine monitoring, no action needed.",
      "Keep noise and lighting at their current levels.",
      "Maintain good room ventilation.",
    ],
  },
  MEDIUM: {
    message: "Environmental conditions may contribute to migraine discomfort.",
    items: [
      "Consider reducing surrounding noise.",
      "Maintain comfortable room temperature.",
      "Monitor CO₂ levels in the room.",
      "Avoid prolonged exposure to harsh lighting.",
    ],
  },
  HIGH: {
    message: "Multiple environmental factors indicate an elevated risk this session.",
    items: [
      "Reduce noise exposure where possible.",
      "Ventilate the room to lower CO₂ build-up.",
      "Dim or soften harsh lighting nearby.",
      "Take a short break from the current environment.",
    ],
  },
  SEVERE: {
    message: "Combined environmental readings indicate a significant possible trigger event.",
    items: [
      "Move to a quieter, dimmer space if possible.",
      "Improve ventilation immediately.",
      "Limit additional sensory exposure for now.",
      "Consider informing a caregiver or contact if discomfort develops.",
    ],
  },
};

// Sensor display + status-threshold configuration in one place,
// so nothing is hard-coded throughout the HTML.
const SENSOR_CONFIG = {
  temperature: {
    unit: "°C",
    decimals: 1,
    icon: "bi-thermometer-half",
    triggerLabel: "Temperature",
    score: (v) => clampScore((v - 18) * 3.33),
  },
  co2: {
    unit: "ppm",
    decimals: 0,
    icon: "bi-cloud-haze2",
    triggerLabel: "CO₂",
    score: (v) => clampScore((v - 400) * 0.107),
  },
  sound: {
    unit: "dB",
    decimals: 0,
    icon: "bi-volume-up",
    triggerLabel: "Noise",
    score: (v) => clampScore((v - 30) * 2.25),
  },
  light: {
    unit: "lux",
    decimals: 0,
    icon: "bi-brightness-high",
    triggerLabel: "Light",
    score: (v) => clampScore(v * 0.0667),
  },
};

// Alert copy shown in the toast + browser notification, per risk level.
const ALERT_CONTENT = {
  HIGH: {
    title: "Elevated Risk Detected",
    body: "Environmental readings indicate an elevated migraine risk level. Review the recommendations below.",
  },
  SEVERE: {
    title: "Severe Risk Detected",
    body: "Environmental readings indicate a severe combined migraine risk. Consider changing your environment.",
  },
};

// ---------------------------------------------------------
// Tunable constants
// ---------------------------------------------------------
const GAUGE_PATH_LENGTH = 283;          // length of the semicircular gauge arc
const SIMULATION_INTERVAL_MS = 2000;    // how often demo data refreshes
const LOADING_DELAY_MS = 1100;          // simulated "connecting" delay on first load
const HISTORY_MAX_AGE_MS = 60 * 60 * 1000; // keep 1 hour of trend history
const HISTORY_STORAGE_KEY = "migraineMonitor.history";
const THEME_STORAGE_KEY = "migraineMonitor.theme";
const OFFLINE_DEMO_CHANCE = 0; // set >0 (e.g. 0.03) to randomly demo the offline state
