// =========================================================
// Migraine Risk Monitoring System - Backend Server
// =========================================================
// This server connects to a HiveMQ Cloud MQTT broker,
// listens for sensor data published by a Raspberry Pi,
// and exposes the latest reading through a REST API.
// =========================================================

// --- A. Imports ---------------------------------------------------------
require("dotenv").config(); // Load variables from .env into process.env
const express = require("express");
const cors = require("cors");
const mqtt = require("mqtt");

// --- C. Create Express app and enable middleware ------------------------
const app = express();
app.use(cors());
app.use(express.json());

// --- D. Read environment variables ---------------------------------------
const MQTT_HOST = process.env.MQTT_HOST;
const MQTT_PORT = process.env.MQTT_PORT || 8883;
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;
const MQTT_TOPIC = process.env.MQTT_TOPIC || "migraine/sensors";
const PORT = process.env.PORT || 3000;

// --- E. Validate required environment variables ---------------------------
if (!MQTT_HOST || !MQTT_USERNAME || !MQTT_PASSWORD) {
  console.error(
    "ERROR: Missing required MQTT environment variables.\n" +
      "Please check your .env file and make sure MQTT_HOST, MQTT_USERNAME, " +
      "and MQTT_PASSWORD are all set to your HiveMQ Cloud credentials."
  );
  process.exit(1); // Stop the application, nothing will work without these
}

// This variable holds the most recent JSON payload received from the Pi.
// It starts as null because no data has arrived yet.
let latestData = null;

// --- F. Connect to HiveMQ Cloud over secure MQTT (MQTTS) ------------------
const mqttUrl = `mqtts://${MQTT_HOST}:${MQTT_PORT}`;

const mqttClient = mqtt.connect(mqttUrl, {
  username: MQTT_USERNAME,
  password: MQTT_PASSWORD,
  protocol: "mqtts",
  rejectUnauthorized: true, // Verify the broker's TLS certificate
});

// --- G. Handle successful connection --------------------------------------
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

// --- H. Handle incoming MQTT messages --------------------------------------
mqttClient.on("message", (topic, message) => {
  const payloadString = message.toString();

  try {
    // Parse the incoming message as JSON and store it as-is.
    // We do not modify the structure of the data.
    const parsed = JSON.parse(payloadString);
    latestData = parsed;
    console.log(`Received data on "${topic}":`, parsed);
  } catch (err) {
    // Don't crash the server on bad data - just log the problem.
    console.error("Received invalid JSON from MQTT:", err.message);
  }
});

// --- I. Handle MQTT errors ---------------------------------------------
mqttClient.on("error", (err) => {
  console.error("MQTT connection error:", err.message);
});

// --- J. Root route: basic health check ------------------------------------
app.get("/", (req, res) => {
  res.json({
    message: "Migraine Risk Monitoring Backend is running",
    mqttTopic: MQTT_TOPIC,
  });
});

// --- K. Latest data route ---------------------------------------------
app.get("/api/latest", (req, res) => {
  res.json({
    success: true,
    data: latestData, // Will be null until the first MQTT message arrives
  });
});

// --- L. Start the Express server ---------------------------------------
// --- L. Start the Express server ---------------------------------------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
