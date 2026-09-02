/* =========================================================
   Migraine Risk Monitor — App Entry Point
   =========================================================
   Real-time version:
   Raspberry Pi
        ↓
      MQTT
        ↓
   HiveMQ Cloud
        ↓
   Node.js Backend
        ↓
   GET /api/latest
        ↓
   This Dashboard
   ========================================================= */

// ---------------------------------------------------------
// BACKEND CONFIGURATION
// ---------------------------------------------------------
//
// IMPORTANT:
// Change this IP to the IP address of the PC where Node.js
// backend is running.
//
// Example:
// http://192.168.0.104:3000
//
const API_BASE_URL = "https://migraine-backend.onrender.com";
const API_ENDPOINT = `${API_BASE_URL}/api/latest`;

// Same update interval as Raspberry Pi publishing interval.
const FETCH_INTERVAL_MS = 2000;

// Number of failed requests before showing OFFLINE.
const MAX_CONSECUTIVE_FAILURES = 3;


// ---------------------------------------------------------
// Global error safety net
// ---------------------------------------------------------

window.addEventListener("error", (event) => {
  console.error(
    "Unhandled error:",
    event.error || event.message
  );
});

window.addEventListener("unhandledrejection", (event) => {
  console.error(
    "Unhandled promise rejection:",
    event.reason
  );
});


// ---------------------------------------------------------
// Real data state
// ---------------------------------------------------------

let latestData = null;
let consecutiveFailures = 0;
let fetchTimer = null;
let firstDataReceived = false;


// ---------------------------------------------------------
// Fetch latest reading from Node.js backend
// ---------------------------------------------------------

async function fetchLatestData() {

  try {

    const response = await fetch(API_ENDPOINT, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(
        `Backend responded with HTTP ${response.status}`
      );
    }

    const result = await response.json();

    if (!result.success || !result.data) {
      throw new Error("Backend returned no sensor data.");
    }

    const data = result.data;

    // Basic validation
    if (!data.sensors) {
      throw new Error("Sensor data is missing.");
    }

    if (typeof data.MRI !== "number") {
      throw new Error("MRI value is missing or invalid.");
    }

    // -----------------------------------------------------
    // Successful connection
    // -----------------------------------------------------

    consecutiveFailures = 0;
    latestData = data;

    setConnectionState("online");

    // Hide loading overlay after first successful reading.
    if (!firstDataReceived) {
      firstDataReceived = true;
      hideLoadingOverlay();
    }

    // -----------------------------------------------------
    // Update dashboard
    // -----------------------------------------------------

    updateDashboard(data);

    // Save reading for historical trend.
    const history = pushReading(data);

    // Redraw chart.
    drawTrendChart(history);

    console.log("Live data received:", data);

  } catch (err) {

    console.error(
      "Failed to fetch latest backend data:",
      err
    );

    consecutiveFailures++;

    // First failure: keep previous state.
    // After several failures: show offline.
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      setConnectionState("offline");
    }

  }
}


// ---------------------------------------------------------
// Service Worker
// ---------------------------------------------------------

function registerServiceWorker() {

  if (!("serviceWorker" in navigator)) {
    return;
  }

  // Service worker does not work with file://
  if (window.location.protocol === "file:") {
    return;
  }

  navigator.serviceWorker
    .register("./sw.js")
    .then(() => {
      console.log("Service worker registered.");
    })
    .catch((err) => {
      console.warn(
        "Service worker registration failed:",
        err
      );
    });
}


// ---------------------------------------------------------
// Application initialization
// ---------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {

  // UI initialization
  safeRun(initTheme, "initTheme");
  safeRun(
    initNotificationToggle,
    "initNotificationToggle"
  );

  safeRun(
    initOfflineDemoButton,
    "initOfflineDemoButton"
  );

  safeRun(
    initExportButtons,
    "initExportButtons"
  );

  safeRun(
    registerServiceWorker,
    "registerServiceWorker"
  );


  // -------------------------------------------------------
  // Initial connection state
  // -------------------------------------------------------

  setConnectionState("connecting");

  showLoadingOverlay();


  // -------------------------------------------------------
  // Show previously stored history immediately
  // -------------------------------------------------------

  safeRun(
    () => drawTrendChart(getHistory()),
    "initial chart draw"
  );


  // -------------------------------------------------------
  // First backend request
  // -------------------------------------------------------
  //
  // Small delay so the loading screen feels natural.
  // This does NOT generate fake data.
  //

  setTimeout(() => {

    fetchLatestData();

    // -----------------------------------------------------
    // Continue requesting real backend data every 2 sec
    // -----------------------------------------------------

    fetchTimer = setInterval(
      () => safeRun(
        fetchLatestData,
        "fetchLatestData"
      ),
      FETCH_INTERVAL_MS
    );

  }, LOADING_DELAY_MS);

});


// ---------------------------------------------------------
// Helper: get latest real reading
// ---------------------------------------------------------
//
// Used by other parts of the application if needed.
//

function getLatestData() {
  return latestData;
}