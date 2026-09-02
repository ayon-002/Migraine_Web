// =========================================================
// Migraine Risk Monitoring System - Backend Server
// =========================================================
// This server connects to a HiveMQ Cloud MQTT broker,
// listens for sensor data published by a Raspberry Pi,
// exposes the latest reading through a REST API,
// and serves the frontend HTML/CSS/JS files.
// =========================================================

// --- A. Imports ---------------------------------------------------------
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mqtt = require("mqtt");
const path = require("path");

// --- B. Create Express app and enable middleware ------------------------
const app = express();

app.use(cors());
app.use(express.json());

// Serve frontend files such as index.html, style.css, script.js
app.use(express.static(__dirname));

// --- C. Read environment variables --------------------------------------
const MQTT_HOST = process.env.MQTT_HOST;
const MQTT_PORT = process.env.MQTT_PORT || 8883;
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;
const MQTT_TOPIC = process.env.MQTT_TOPIC || "migraine/sensors";

const PORT = process.env.PORT || 3000;

// --- D. Validate required environment variables -------------------------
if (!MQTT_HOST || !MQTT_USERNAME || !MQTT_PASSWORD) {
  console.error(
    "ERROR: Missing required MQTT environment variables.\n" +
      "Please check your .env file and make sure MQTT_HOST, MQTT_USERNAME, " +
      "and MQTT_PASSWORD are all set to your HiveMQ Cloud credentials."
  );

  process.exit(1);
}

// --- E. Store latest sensor data -----------------------------------------
// This will contain the latest JSON payload received from Raspberry Pi.
let latestData = null;

// --- F. Connect to HiveMQ Cloud over secure MQTT ------------------------
const mqttUrl = `mqtts://${MQTT_HOST}:${MQTT_PORT}`;

const mqttClient = mqtt.connect(mqttUrl, {
  username: MQTT_USERNAME,
  password: MQTT_PASSWORD,
  protocol: "mqtts",
  rejectUnauthorized: true,
});

// --- G. Handle successful MQTT connection -------------------------------
mqttClient.on("connect", () => {
  console.log("Connected to HiveMQ Cloud");

  mqttClient.subscribe(MQTT_TOPIC, (err) => {
    if (err) {
      console.error("Failed to subscribe to topic:", err.message);
      return;
    }

    console.log(`Subscribed to topic: ${MQTT_TOPIC}`);
  });
});

// --- H. Handle incoming MQTT messages -----------------------------------
mqttClient.on("message", (topic, message) => {
  const payloadString = message.toString();

  try {
    // Convert MQTT message from JSON string to JavaScript object
    const parsed = JSON.parse(payloadString);

    // Store the latest sensor data
    latestData = parsed;

    console.log(`Received data on "${topic}":`, parsed);
  } catch (err) {
    // Do not crash the server if invalid JSON is received
    console.error("Received invalid JSON from MQTT:", err.message);
  }
});

// --- I. Handle MQTT errors ----------------------------------------------
mqttClient.on("error", (err) => {
  console.error("MQTT connection error:", err.message);
});

// --- J. Root route: serve the frontend website ---------------------------
// When someone opens the Render URL, index.html will be displayed.
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// --- K. Latest sensor data API -------------------------------------------
app.get("/api/latest", (req, res) => {
  res.json({
    success: true,
    data: latestData,
  });
});

// --- L. Start the Express server -----------------------------------------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});