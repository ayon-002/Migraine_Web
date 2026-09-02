/* =========================================================
   Migraine Risk Monitor — Alerts & Notifications
   =========================================================
   Shows an in-page toast (and, if permitted, a native OS
   notification) whenever risk newly transitions into HIGH
   or SEVERE. Alerts only fire on transition, not on every
   refresh while risk stays in the same band.
   ========================================================= */

let previousRisk = null;
let bootstrapToast = null;
let notificationsEnabled = false;

/** Call this whenever risk + MRI are updated; decides whether to alert. */
function checkRiskAlert(risk, mri) {
  const isAlertLevel = risk === "HIGH" || risk === "SEVERE";
  const justEnteredAlertLevel = isAlertLevel && risk !== previousRisk;

  if (justEnteredAlertLevel) {
    safeRun(() => showRiskToast(risk, mri), "show risk toast");
    safeRun(() => sendBrowserNotification(risk, mri), "send browser notification");
  }

  previousRisk = risk;
}

/** Shows the in-page Bootstrap toast styled for the given risk level. */
function showRiskToast(risk, mri) {
  const toastEl = document.getElementById("riskAlertToast");
  if (!toastEl || typeof bootstrap === "undefined") return;

  const content = ALERT_CONTENT[risk] || ALERT_CONTENT.HIGH;

  toastEl.dataset.risk = risk;
  const titleEl = document.getElementById("riskToastTitle");
  const bodyEl = document.getElementById("riskToastBody");
  if (titleEl) titleEl.textContent = content.title;
  if (bodyEl) bodyEl.textContent = `${content.body} (MRI: ${formatValue(mri, 1)})`;

  if (!bootstrapToast) {
    bootstrapToast = new bootstrap.Toast(toastEl, { autohide: true, delay: 8000 });
  }
  bootstrapToast.show();
}

/** Sends a native OS-level notification, if the user has granted permission. */
function sendBrowserNotification(risk, mri) {
  if (!notificationsEnabled || !("Notification" in window) || Notification.permission !== "granted") {
    return;
  }
  const content = ALERT_CONTENT[risk] || ALERT_CONTENT.HIGH;
  new Notification(`Migraine Risk Monitor — ${content.title}`, {
    body: `${content.body} (MRI: ${formatValue(mri, 1)})`,
    tag: "migraine-risk-alert",
  });
}

/** Wires up the "Enable Alerts" header button to request notification permission. */
function initNotificationToggle() {
  const button = document.getElementById("notifyToggle");
  if (!button) return;

  if (!("Notification" in window)) {
    button.style.display = "none"; // Hide if the browser has no support
    return;
  }

  if (Notification.permission === "granted") {
    notificationsEnabled = true;
    setNotifyButtonState(button, true);
  }

  button.addEventListener("click", async () => {
    if (notificationsEnabled) {
      // Permission can't be programmatically revoked; just stop sending in-app.
      notificationsEnabled = false;
      setNotifyButtonState(button, false);
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      notificationsEnabled = permission === "granted";
      setNotifyButtonState(button, notificationsEnabled);
    } catch (err) {
      console.warn("Notification permission request failed:", err);
    }
  });
}

function setNotifyButtonState(button, enabled) {
  button.setAttribute("aria-pressed", String(enabled));
  const label = button.querySelector(".notify-toggle__label");
  const icon = button.querySelector("i");
  if (label) label.textContent = enabled ? "Alerts On" : "Enable Alerts";
  if (icon) icon.className = enabled ? "bi bi-bell-fill" : "bi bi-bell";
}
