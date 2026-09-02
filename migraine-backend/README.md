# Migraine Risk Monitoring System - Backend

A Node.js + Express backend that receives sensor data from a Raspberry Pi
over HiveMQ Cloud MQTT and exposes the latest reading through a simple
REST API.

## Architecture

```
Raspberry Pi
    ↓
HiveMQ Cloud MQTT Broker
    ↓
Node.js + Express Backend   ← (this project)
    ↓
REST API
    ↓
Future Web Dashboard
```

The Raspberry Pi collects sensor readings (light, sound, temperature, CO2,
etc.), calculates a migraine risk score, and publishes the result as JSON
to the HiveMQ Cloud MQTT broker. This backend subscribes to that topic,
keeps the latest message in memory, and serves it over a REST API so a
future web dashboard (or any other client) can display it.

## Setup

1. Open a terminal inside the `migraine-backend` folder.

2. Install dependencies:

   ```
   npm install
   ```

3. Open the `.env` file.

4. Replace the placeholder values with your actual HiveMQ Cloud
   credentials:

   - `YOUR_HIVEMQ_HOST` → your HiveMQ Cloud cluster hostname
   - `YOUR_HIVEMQ_USERNAME` → your HiveMQ Cloud username
   - `YOUR_HIVEMQ_PASSWORD` → your HiveMQ Cloud password

   You can find these values in your HiveMQ Cloud console.

5. Start the server:

   ```
   npm start
   ```

If everything is configured correctly, you should see:

```
Connected to HiveMQ Cloud
Subscribed to topic: migraine/sensors
Server running on port 3000
```

## API Endpoints

### `GET /`

A basic health check. Confirms the backend is running and shows which
MQTT topic it is listening to.

Visit in your browser:

```
http://localhost:3000/
```

### `GET /api/latest`

Returns the most recent JSON sensor payload received from the Raspberry
Pi over MQTT. If no data has arrived yet, `data` will be `null`.

Visit in your browser:

```
http://localhost:3000/api/latest
```

## MQTT Details

- **Topic:** `migraine/sensors` (the Raspberry Pi publishes to this topic)
- **Broker:** HiveMQ Cloud
- **Protocol:** Secure MQTT (MQTTS) on port `8883`

Example JSON payload the Pi might publish:

```json
{
  "sensors": {
    "lux": 450,
    "db": 62,
    "temperature": 28.5,
    "co2_ppm": 850
  },
  "MRI": 35.6,
  "risk": "MEDIUM",
  "dominant_trigger": "noise"
}
```

The backend stores this data exactly as received, without modifying its
structure.

## Notes on Security

- Your real HiveMQ credentials should only ever live in your local `.env`
  file, which is excluded from version control via `.gitignore`.
- Never commit or share your `.env` file.
