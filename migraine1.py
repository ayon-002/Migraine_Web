import spidev
import time
import os
import glob
import smbus2
import json
import paho.mqtt.client as mqtt

from datetime import datetime, timezone
from collections import deque


# =========================================================
# MQTT SETTINGS — HiveMQ Cloud
# =========================================================

BROKER_IP = "f6984fab9e884ec88e595fcaf653acf6.s1.eu.hivemq.cloud"
PORT = 8883
TOPIC = "migraine/sensors"

MQTT_USERNAME = "migraine"
MQTT_PASSWORD = "YOUR_HIVEMQ_PASSWORD"

mqtt_client = mqtt.Client(client_id="MigrainePi")

mqtt_client.username_pw_set(
    MQTT_USERNAME,
    MQTT_PASSWORD
)

mqtt_client.tls_set()


# =========================================================
# MQTT CALLBACKS
# =========================================================

mqtt_connected = False


def on_connect(client, userdata, flags, rc):
    global mqtt_connected

    if rc == 0:
        mqtt_connected = True
        print("\nMQTT Connected to HiveMQ Cloud ✅")
        print(f"Topic: {TOPIC}\n")
    else:
        mqtt_connected = False
        print(f"\nMQTT connection failed. RC = {rc}")


def on_disconnect(client, userdata, rc):
    global mqtt_connected

    mqtt_connected = False

    if rc != 0:
        print("\nMQTT disconnected unexpectedly. Reconnecting...")


mqtt_client.on_connect = on_connect
mqtt_client.on_disconnect = on_disconnect


# =========================================================
# MQTT CONNECTION
# =========================================================

print("=" * 55)
print("       MIGRAINE TRIGGER DETECTION SYSTEM")
print("=" * 55)

print("\nConnecting to HiveMQ Cloud...")

try:
    mqtt_client.connect(BROKER_IP, PORT, 60)
    mqtt_client.loop_start()

except Exception as e:
    print(f"MQTT connection error: {e}")
    print("System will continue and retry MQTT connection.")


# =========================================================
# MCP3008 SETUP
# =========================================================

spi = spidev.SpiDev()

spi.open(0, 0)

spi.max_speed_hz = 1350000


# Voltage divider:
# Top resistor    = 10kΩ
# Bottom resistor = 15kΩ

R_TOP = 10000
R_BOTTOM = 15000

VREF = 3.3
ADC_MAX = 1023

V_SUPPLY = 5.0


def read_adc(channel):

    if channel < 0 or channel > 7:
        return 0

    data = spi.xfer2([
        1,
        (8 + channel) << 4,
        0
    ])

    return ((data[1] & 3) << 8) | data[2]


def adc_to_mcp_voltage(adc):

    return (adc / ADC_MAX) * VREF


def mcp_to_sensor_voltage(v_mcp):

    return v_mcp * (R_TOP + R_BOTTOM) / R_BOTTOM


# =========================================================
# DS18B20 TEMPERATURE
# =========================================================

os.system("modprobe w1-gpio")
os.system("modprobe w1-therm")

device_folder = glob.glob(
    "/sys/bus/w1/devices/28-*"
)


def read_temperature():

    try:

        if not device_folder:
            return None

        with open(
            device_folder[0] + "/w1_slave"
        ) as f:

            lines = f.readlines()

        if "YES" not in lines[0]:
            return None

        pos = lines[1].find("t=")

        if pos == -1:
            return None

        temperature = float(
            lines[1][pos + 2:]
        ) / 1000.0

        return temperature

    except Exception:

        return None


# =========================================================
# GY-302 / BH1750 LIGHT
# =========================================================

try:

    bus = smbus2.SMBus(1)

except Exception:

    bus = None


def read_light():

    if bus is None:
        return None

    try:

        bus.write_byte(
            0x23,
            0x20
        )

        time.sleep(0.18)

        data = bus.read_i2c_block_data(
            0x23,
            0x00,
            2
        )

        lux = (
            ((data[0] << 8) | data[1])
            / 1.2
        )

        return lux

    except Exception:

        return None


# =========================================================
# HW-484 SOUND
# =========================================================

ADC_DB_TABLE = [

    (0, 30),
    (150, 50),
    (250, 60),
    (380, 70),
    (510, 80),
    (650, 90),
    (800, 100),
    (1023, 110),

]


def adc_to_db(adc_value):

    for i in range(
        len(ADC_DB_TABLE) - 1
    ):

        adc_low, db_low = ADC_DB_TABLE[i]

        adc_high, db_high = ADC_DB_TABLE[i + 1]

        if adc_low <= adc_value <= adc_high:

            ratio = (
                (adc_value - adc_low)
                /
                (adc_high - adc_low)
            )

            return (
                db_low
                +
                ratio * (db_high - db_low)
            )

    if adc_value >= 1023:
        return 110

    return 30


# =========================================================
# MQ-135 GAS / CO2
# =========================================================

R_LOAD = 20000

R0 = None


def calculate_rs(sensor_voltage):

    if sensor_voltage <= 0:
        return None

    if sensor_voltage >= V_SUPPLY:
        return None

    return (
        R_LOAD
        *
        (V_SUPPLY - sensor_voltage)
        /
        sensor_voltage
    )


def calibrate_r0(rs):

    return (
        rs
        *
        ((400 / 116.6020682)
         ** (-1 / 2.769034857))
    )


def rs_to_ppm(rs):

    if (
        R0 is None
        or rs is None
        or R0 <= 0
    ):
        return None

    ratio = rs / R0

    if ratio <= 0:
        return None

    return (
        116.6020682
        *
        (ratio ** -2.769034857)
    )


# =========================================================
# TRIGGER SCORE FUNCTIONS
# =========================================================

def light_trigger_score(lux):

    if lux is None:
        return 0.0, "No data"

    if lux > 2000:

        return (
            1.00,
            f"{lux:.0f} lux — Severe"
        )

    elif lux > 1000:

        return (
            0.75,
            f"{lux:.0f} lux — High"
        )

    elif lux > 500:

        return (
            0.40,
            f"{lux:.0f} lux — Moderate"
        )

    else:

        return (
            0.10,
            f"{lux:.0f} lux — Safe"
        )


def noise_trigger_score(db):

    if db is None:
        return 0.0, "No data"

    if db >= 90:

        return (
            1.00,
            f"{db:.1f} dB — Above SAT"
        )

    elif db >= 76:

        return (
            0.75,
            f"{db:.1f} dB — High risk"
        )

    elif db >= 60:

        return (
            0.40,
            f"{db:.1f} dB — Moderate"
        )

    else:

        return (
            0.10,
            f"{db:.1f} dB — Safe"
        )


def temp_trigger_score(temp):

    if temp is None:
        return 0.0, "No data"

    if temp > 35:

        return (
            1.00,
            f"{temp:.1f}°C — Severe"
        )

    elif temp > 30:

        return (
            0.75,
            f"{temp:.1f}°C — High"
        )

    elif temp > 27:

        return (
            0.40,
            f"{temp:.1f}°C — Moderate"
        )

    elif 21 <= temp <= 24:

        return (
            0.00,
            f"{temp:.1f}°C — Optimal"
        )

    else:

        return (
            0.20,
            f"{temp:.1f}°C — Suboptimal"
        )


def gas_trigger_score(ppm):

    if ppm is None:
        return 0.0, "No data"

    if ppm > 2000:

        return (
            1.00,
            f"{ppm:.0f} ppm — Severe"
        )

    elif ppm > 1500:

        return (
            0.75,
            f"{ppm:.0f} ppm — High"
        )

    elif ppm > 1000:

        return (
            0.40,
            f"{ppm:.0f} ppm — Moderate"
        )

    else:

        return (
            0.10,
            f"{ppm:.0f} ppm — Safe"
        )


# =========================================================
# ADVANCED MRI
# =========================================================

HISTORY_LEN = 30

light_hist = deque(
    maxlen=HISTORY_LEN
)

noise_hist = deque(
    maxlen=HISTORY_LEN
)

temp_hist = deque(
    maxlen=HISTORY_LEN
)

gas_hist = deque(
    maxlen=HISTORY_LEN
)


def calculate_advanced_MRI(
    ls,
    ns,
    ts,
    gs,
    raw_temp,
    raw_gas
):

    # -----------------------------------------------------
    # 1. SINGLE SPIKE
    # -----------------------------------------------------

    max_single = max(
        ls,
        ns,
        ts,
        gs
    )


    # -----------------------------------------------------
    # 2. CUMULATIVE LOAD
    # -----------------------------------------------------

    cumulative = (

        ls * 0.35

        +

        ns * 0.30

        +

        ts * 0.20

        +

        gs * 0.15

    )


    # -----------------------------------------------------
    # 3. SYNERGISTIC EFFECT
    # -----------------------------------------------------

    synergy_penalty = 0.0


    # Heat + Poor Air Quality

    if (
        ts >= 0.40
        and
        gs >= 0.40
    ):

        synergy_penalty += 0.20


    # Loud Noise + Bright Light

    if (
        ls >= 0.40
        and
        ns >= 0.40
    ):

        synergy_penalty += 0.20


    # -----------------------------------------------------
    # 4. RAPID FLUCTUATION
    # -----------------------------------------------------

    delta_penalty = 0.0


    if (
        len(temp_hist)
        == temp_hist.maxlen
        and
        raw_temp is not None
    ):

        temp_change = abs(
            raw_temp
            -
            temp_hist[0]
        )

        if temp_change > 2.0:

            delta_penalty += 0.30


    # -----------------------------------------------------
    # 5. PROLONGED EXPOSURE
    # -----------------------------------------------------

    prolonged_penalty = 0.0


    if (
        len(noise_hist)
        == noise_hist.maxlen
    ):

        avg_noise_score = (
            sum(noise_hist)
            /
            len(noise_hist)
        )

        if avg_noise_score > 0.40:

            prolonged_penalty += 0.25


    # -----------------------------------------------------
    # FINAL MRI
    # -----------------------------------------------------

    base_risk = max(
        max_single,
        cumulative
    )


    final_score = (
        base_risk
        +
        synergy_penalty
        +
        delta_penalty
        +
        prolonged_penalty
    )


    final_score = min(
        final_score,
        1.0
    )


    breakdown = {

        "max_single":
            round(
                max_single * 100,
                1
            ),

        "cumulative":
            round(
                cumulative * 100,
                1
            ),

        "synergy":
            round(
                synergy_penalty * 100,
                1
            ),

        "delta":
            round(
                delta_penalty * 100,
                1
            ),

        "prolonged":
            round(
                prolonged_penalty * 100,
                1
            ),

    }


    return (
        final_score * 100,
        breakdown
    )


# =========================================================
# RISK LEVEL
# =========================================================

def get_risk_level(mri):

    if mri >= 80:
        return "SEVERE"

    elif mri >= 60:
        return "HIGH"

    elif mri >= 30:
        return "MEDIUM"

    else:
        return "LOW"


# =========================================================
# DOMINANT TRIGGER
# =========================================================

def get_dominant_trigger(scores):

    return max(
        scores,
        key=scores.get
    )


# =========================================================
# MQTT PUBLISH FUNCTION
# =========================================================

def publish_data(payload):

    try:

        if not mqtt_connected:

            print(
                "MQTT not connected — "
                "trying to reconnect..."
            )

            try:

                mqtt_client.reconnect()

            except Exception:

                return False


        message = json.dumps(
            payload
        )

        result = mqtt_client.publish(
            TOPIC,
            message,
            qos=1
        )

        if result.rc == mqtt.MQTT_ERR_SUCCESS:

            return True

        return False

    except Exception as e:

        print(
            f"MQTT publish error: {e}"
        )

        return False


# =========================================================
# MQ-135 WARMUP
# =========================================================

print("\nMQ-135 Warming up — 5 minutes...")

for i in range(300):

    remaining = 300 - i

    filled = min(
        i // 15,
        20
    )

    bar = (
        "█" * filled
        +
        "░" * (20 - filled)
    )

    print(
        f"[{bar}] "
        f"{remaining}s remaining",
        end="\r"
    )

    time.sleep(1)


print(
    "\nWarmup complete!\n"
)


# =========================================================
# R0 CALIBRATION
# =========================================================

print(
    "Calibrating R0 "
    "(fresh air)..."
)

r0_readings = []


for _ in range(10):

    adc = read_adc(1)

    vmcp = adc_to_mcp_voltage(
        adc
    )

    vsns = mcp_to_sensor_voltage(
        vmcp
    )

    rs = calculate_rs(
        vsns
    )

    if rs is not None:

        r0_readings.append(
            rs
        )

    time.sleep(1)


if r0_readings:

    avg_rs = (
        sum(r0_readings)
        /
        len(r0_readings)
    )

    R0 = calibrate_r0(
        avg_rs
    )

    print(
        f"R0 calibrated: "
        f"{R0:.0f} Ω\n"
    )

else:

    R0 = 41763

    print(
        f"R0 default: "
        f"{R0:.0f} Ω\n"
    )


# =========================================================
# MAIN LOOP
# =========================================================

print(
    "System running...\n"
)


try:

    while True:

        # =================================================
        # SENSOR READINGS
        # =================================================

        # Light

        lux = read_light()


        # Temperature

        temp = read_temperature()


        # Sound

        sound_adc = read_adc(0)

        db = adc_to_db(
            sound_adc
        )


        # Gas / CO2

        gas_adc = read_adc(1)

        gas_vmcp = adc_to_mcp_voltage(
            gas_adc
        )

        gas_vsns = mcp_to_sensor_voltage(
            gas_vmcp
        )

        rs = calculate_rs(
            gas_vsns
        )

        ppm = rs_to_ppm(
            rs
        )


        # =================================================
        # TRIGGER SCORES
        # =================================================

        ls, l_info = (
            light_trigger_score(
                lux
            )
        )


        ns, n_info = (
            noise_trigger_score(
                db
            )
        )


        ts, t_info = (
            temp_trigger_score(
                temp
            )
        )


        gs, g_info = (
            gas_trigger_score(
                ppm
            )
        )


        scores = {

            "light": ls,

            "noise": ns,

            "temperature": ts,

            "gas": gs

        }


        # =================================================
        # HISTORY UPDATE
        # =================================================

        light_hist.append(ls)

        noise_hist.append(ns)

        temp_hist.append(
            temp
            if temp is not None
            else 0.0
        )

        gas_hist.append(gs)


        # =================================================
        # MRI CALCULATION
        # =================================================

        MRI, mri_breakdown = (
            calculate_advanced_MRI(

                ls,
                ns,
                ts,
                gs,

                temp,

                ppm

            )
        )


        # =================================================
        # RISK
        # =================================================

        risk = get_risk_level(
            MRI
        )


        # =================================================
        # DOMINANT TRIGGER
        # =================================================

        dominant = (
            get_dominant_trigger(
                scores
            )
        )


        # =================================================
        # CONSOLE DISPLAY
        # =================================================

        os.system("clear")


        print(
            "=" * 55
        )

        print(
            "       MIGRAINE TRIGGER DETECTION SYSTEM"
        )

        print(
            "=" * 55
        )


        print(
            f"\n{'Sensor':<15}"
            f"{'Value':<25}"
            f"Score"
        )

        print(
            "-" * 55
        )


        print(
            f"{'Light':<15}"
            f"{l_info:<25}"
            f"{ls:.2f}"
        )


        print(
            f"{'Noise':<15}"
            f"{n_info:<25}"
            f"{ns:.2f}"
        )


        print(
            f"{'Temperature':<15}"
            f"{t_info:<25}"
            f"{ts:.2f}"
        )


        print(
            f"{'Gas/CO2':<15}"
            f"{g_info:<25}"
            f"{gs:.2f}"
        )


        print(
            "\n--- Trigger Bars ---"
        )


        for name, score in scores.items():

            bar_length = int(
                score * 20
            )

            bar = (
                "█" * bar_length
                +
                "░" * (
                    20 - bar_length
                )
            )

            print(
                f"{name:<15}: "
                f"[{bar}] "
                f"{score:.2f}"
            )


        print(
            f"\n{'=' * 55}"
        )


        print(
            f"Migraine Risk Index : "
            f"{MRI:.1f} / 100"
        )


        print(
            f"Risk Level          : "
            f"{risk}"
        )


        print(
            f"Dominant Trigger    : "
            f"{dominant}"
        )


        print(
            f" ├─ Single Spike     : "
            f"{mri_breakdown['max_single']}"
        )


        print(
            f" ├─ Cumulative       : "
            f"{mri_breakdown['cumulative']}"
        )


        print(
            f" ├─ Synergy bonus    : "
            f"+{mri_breakdown['synergy']}"
        )


        print(
            f" ├─ Delta bonus      : "
            f"+{mri_breakdown['delta']}"
        )


        print(
            f" └─ Prolonged bonus  : "
            f"+{mri_breakdown['prolonged']}"
        )


        print(
            f"{'=' * 55}"
        )


        # =================================================
        # MQTT JSON PAYLOAD
        # =================================================

        payload = {

            "timestamp":
                datetime.now(
                    timezone.utc
                ).isoformat(),

            "sensors": {

                "lux":
                    round(
                        lux, 2
                    )
                    if lux is not None
                    else 0,

                "db":
                    round(
                        db, 1
                    )
                    if db is not None
                    else 0,

                "temperature":
                    round(
                        temp, 2
                    )
                    if temp is not None
                    else 0,

                "co2_ppm":
                    round(
                        ppm, 1
                    )
                    if ppm is not None
                    else 0

            },


            "scores": {

                "light":
                    round(ls, 3),

                "noise":
                    round(ns, 3),

                "temperature":
                    round(ts, 3),

                "gas":
                    round(gs, 3)

            },


            "MRI":
                round(
                    MRI,
                    1
                ),


            "risk":
                risk,


            "dominant_trigger":
                dominant,


            "risk_breakdown":
                mri_breakdown,


            "thresholds": {

                "light_lux":
                    500,

                "noise_db":
                    90.4,

                "temp_c":
                    35,

                "co2_ppm":
                    1000

            }

        }


        # =================================================
        # MQTT PUBLISH
        # =================================================

        published = publish_data(
            payload
        )


        if published:

            print(
                "\nMQTT Published ✅"
            )

        else:

            print(
                "\nMQTT Publish Failed ❌"
            )


        print(
            "Ctrl+C to stop"
        )


        # =================================================
        # REAL-TIME INTERVAL
        # =================================================

        time.sleep(2)


# =========================================================
# CLEANUP
# =========================================================

except KeyboardInterrupt:

    print(
        "\n\nSystem stopped."
    )


finally:

    try:
        spi.close()
    except:
        pass


    try:

        if bus:
            bus.close()

    except:
        pass


    try:

        mqtt_client.loop_stop()

        mqtt_client.disconnect()

    except:
        pass


    print(
        "Resources released."
    )