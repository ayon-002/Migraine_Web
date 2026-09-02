let latestDashboardData = null;
let consecutiveFailures = 0;

/* =========================================
   FETCH REAL DATA FROM BACKEND
   ========================================= */

async function fetchLatestData() {
  try {
    const response = await fetch("/api/latest", {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    // Backend is running, but no MQTT data has arrived yet
    if (!result.success || !result.data) {
      console.warn("Backend connected, but no sensor data is available yet.");
      setConnectionState("connecting");
      return;
    }

    // Successful data received
    consecutiveFailures = 0;
    latestDashboardData = result.data;

    // Update connection status
    setConnectionState("online");

    // Hide loading screen
    hideLoadingOverlay();

    // Update dashboard with REAL sensor data
    updateDashboard(result.data);

    // Save reading to history
    pushReading(result.data);

    // Update chart
    drawTrendChart(getHistory());

  } catch (error) {
    consecutiveFailures++;

    console.error("Failed to fetch sensor data:", error);

    // Don't immediately show offline.
    // Wait for 3 consecutive failures.
    if (consecutiveFailures >= 3) {
      setConnectionState("offline");
    }
  }
}


/* =========================================
   INITIALIZE APPLICATION
   ========================================= */

document.addEventListener("DOMContentLoaded", () => {

  /* -----------------------------------------
     Theme
     ----------------------------------------- */
  safeRun(() => initTheme(), "initialize theme");


  /* -----------------------------------------
     Notifications
     ----------------------------------------- */
  safeRun(() => initNotificationToggle(), "initialize notifications");


  /* -----------------------------------------
     Offline Demo Button
     ----------------------------------------- */
  safeRun(() => initOfflineDemoButton(), "initialize offline demo button");


  /* -----------------------------------------
     Export Buttons
     ----------------------------------------- */
  safeRun(() => initExportButtons(), "initialize export buttons");


  /* -----------------------------------------
     Service Worker
     ----------------------------------------- */
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => {
        console.log("Service worker registered.");
      })
      .catch((error) => {
        console.warn("Service worker registration failed:", error);
      });
  }


  /* -----------------------------------------
     Load Previously Saved History
     ----------------------------------------- */
  safeRun(() => {
    drawTrendChart(getHistory());
  }, "draw stored history");


  /* -----------------------------------------
     Initial Loading State
     ----------------------------------------- */
  setConnectionState("connecting");
  showLoadingOverlay();


  /* -----------------------------------------
     Start Real Backend Data Fetching
     ----------------------------------------- */

  setTimeout(() => {

    // Fetch immediately
    fetchLatestData();

    // Then fetch every 2 seconds
    setInterval(fetchLatestData, SIMULATION_INTERVAL_MS);

  }, LOADING_DELAY_MS);

});