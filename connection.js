/* =========================================================
   Migraine Risk Monitor — Connection State
   =========================================================
   Tracks whether the app is "connecting", "online", or
   "offline" and reflects that across the loading overlay,
   the system status panel, and an offline banner.

   In this demo build the state is driven by a simulated
   connect delay plus a manual "Simulate Offline" button.
   When wired to the real backend, call setConnectionState()
   from the fetch success/error handlers instead.
   ========================================================= */

let connectionState = "connecting"; // "connecting" | "online" | "offline"

const CONNECTION_COPY = {
  connecting: {
    mqtt: "Connecting…",
    stream: "Waiting for data",
    pi: "Connecting…",
    dotClass: "dot--connecting",
  },
  online: {
    mqtt: "Connected",
    stream: "Active",
    pi: "Online",
    dotClass: "dot--online",
  },
  offline: {
    mqtt: "Disconnected",
    stream: "Interrupted",
    pi: "Offline",
    dotClass: "dot--offline",
  },
};

/** Central place to change connection state; updates every dependent UI piece. */
function setConnectionState(newState) {
  connectionState = newState;

  const copy = CONNECTION_COPY[newState] || CONNECTION_COPY.connecting;

  setText("statusMqtt", copy.mqtt);
  setText("statusStream", copy.stream);
  setText("statusPi", copy.pi);

  document.querySelectorAll("[data-status-dot]").forEach((dot) => {
    dot.className = `dot ${copy.dotClass}`;
  });

  // Top-of-page banner only appears when offline.
  const banner = document.getElementById("offlineBanner");
  if (banner) banner.classList.toggle("d-none", newState !== "offline");

  // Header "Live Monitoring" pill reflects state too.
  const pill = document.getElementById("headerStatusPill");
  const pillDot = document.getElementById("headerStatusDot");
  if (pill && pillDot) {
    pillDot.className = `dot ${copy.dotClass}`;
    pill.lastChild.textContent =
      newState === "online" ? " Live Monitoring" : newState === "offline" ? " Disconnected" : " Connecting…";
  }
}

// ---------------------------------------------------------
// Loading overlay
// ---------------------------------------------------------
function showLoadingOverlay() {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) overlay.classList.remove("d-none");
}

function hideLoadingOverlay() {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) overlay.classList.add("fade-out");
  setTimeout(() => {
    if (overlay) overlay.classList.add("d-none");
  }, 300);
}

// ---------------------------------------------------------
// Demo-only manual offline toggle
// ---------------------------------------------------------
// Lets a demo presenter show what the "offline" state looks
// like without needing to actually disconnect the backend.
function initOfflineDemoButton() {
  const button = document.getElementById("simulateOfflineBtn");
  if (!button) return;

  button.addEventListener("click", () => {
    if (connectionState === "offline") {
      setConnectionState("online");
      button.textContent = "Simulate connection loss (demo)";
    } else {
      setConnectionState("offline");
      button.textContent = "Restore connection (demo)";
    }
  });
}
