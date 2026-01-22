/**
 * ESP32 MQTT IoT Device
 * 
 * Fitur:
 * - Koneksi WiFi dengan auto-reconnect
 * - MQTT client dengan authentikasi API Key
 * - Multi-sensor support (DHT, analog, digital)
 * - JSON payload
 * - OTA update support
 * - Deep sleep mode
 * - LED status indicator
 * - Button control
 * - Watchdog timer
 */

#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <esp_task_wdt.h>
#include <EEPROM.h>

// ============== CONFIGURATION ==============
// WiFi Configuration
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// MQTT Broker Configuration
#define MQTT_SERVER "192.168.1.100"  // Ganti dengan IP server
#define MQTT_PORT 1883
#define MQTT_CLIENT_ID "esp32_device_001"

// API Key dari Dashboard (sebagai username MQTT)
#define MQTT_API_KEY "mqtt_your_api_key_here"
#define MQTT_PASSWORD ""  // Kosong jika hanya pakai API Key

// Topics
#define TOPIC_SENSOR "home/sensor/data"
#define TOPIC_STATUS "home/sensor/status"
#define TOPIC_COMMAND "home/sensor/command"
#define TOPIC_CONFIG "home/sensor/config"

// Hardware Pins
#define LED_STATUS 2        // Built-in LED
#define LED_WIFI 4          // WiFi status LED
#define LED_MQTT 5          // MQTT status LED
#define BUTTON_PIN 0        // Boot button
#define DHT_PIN 15          // DHT sensor
#define DHT_TYPE DHT22      // DHT11 atau DHT22
#define ANALOG_PIN 34       // Analog input
#define RELAY_PIN 16        // Relay output
#define PIR_PIN 17          // PIR motion sensor

// Timing
#define SENSOR_INTERVAL 5000      // Kirim data setiap 5 detik
#define RECONNECT_INTERVAL 5000   // Retry koneksi setiap 5 detik
#define HEARTBEAT_INTERVAL 30000  // Heartbeat setiap 30 detik
#define WDT_TIMEOUT 30            // Watchdog timeout 30 detik

// ============== GLOBAL OBJECTS ==============
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);
DHT dht(DHT_PIN, DHT_TYPE);

// ============== STATE VARIABLES ==============
unsigned long lastSensorRead = 0;
unsigned long lastReconnect = 0;
unsigned long lastHeartbeat = 0;
unsigned long messageCount = 0;
bool relayState = false;
bool motionDetected = false;
bool debugMode = true;

// Sensor data structure
struct SensorData {
    float temperature;
    float humidity;
    int analogValue;
    bool motion;
    float voltage;
    int rssi;
};

// ============== FUNCTION DECLARATIONS ==============
void setupWiFi();
void setupMQTT();
void connectWiFi();
void connectMQTT();
void mqttCallback(char* topic, byte* payload, unsigned int length);
void readSensors(SensorData &data);
void publishSensorData(SensorData &data);
void publishStatus(const char* status);
void handleCommand(JsonDocument &doc);
void blinkLED(int pin, int times, int delayMs);
void updateStatusLEDs();
void enterDeepSleep(int seconds);
void IRAM_ATTR buttonISR();
void IRAM_ATTR motionISR();

// Button interrupt flag
volatile bool buttonPressed = false;

// ============== SETUP ==============
void setup() {
    Serial.begin(115200);
    Serial.println("\n\n========================================");
    Serial.println("   ESP32 MQTT IoT Device v1.0");
    Serial.println("========================================\n");

    // Initialize EEPROM
    EEPROM.begin(512);

    // Initialize pins
    pinMode(LED_STATUS, OUTPUT);
    pinMode(LED_WIFI, OUTPUT);
    pinMode(LED_MQTT, OUTPUT);
    pinMode(RELAY_PIN, OUTPUT);
    pinMode(BUTTON_PIN, INPUT_PULLUP);
    pinMode(PIR_PIN, INPUT);

    // Set initial states
    digitalWrite(LED_STATUS, LOW);
    digitalWrite(LED_WIFI, LOW);
    digitalWrite(LED_MQTT, LOW);
    digitalWrite(RELAY_PIN, LOW);

    // Attach interrupts
    attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), buttonISR, FALLING);
    attachInterrupt(digitalPinToInterrupt(PIR_PIN), motionISR, RISING);

    // Initialize DHT sensor
    dht.begin();

    // Setup WiFi
    setupWiFi();

    // Setup MQTT
    setupMQTT();

    // Configure watchdog
    esp_task_wdt_init(WDT_TIMEOUT, true);
    esp_task_wdt_add(NULL);

    // Startup indication
    blinkLED(LED_STATUS, 3, 200);
    
    Serial.println("Setup complete!\n");
}

// ============== MAIN LOOP ==============
void loop() {
    // Reset watchdog
    esp_task_wdt_reset();

    // Handle WiFi connection
    if (WiFi.status() != WL_CONNECTED) {
        digitalWrite(LED_WIFI, LOW);
        if (millis() - lastReconnect >= RECONNECT_INTERVAL) {
            lastReconnect = millis();
            connectWiFi();
        }
    } else {
        digitalWrite(LED_WIFI, HIGH);
    }

    // Handle MQTT connection
    if (!mqtt.connected()) {
        digitalWrite(LED_MQTT, LOW);
        if (millis() - lastReconnect >= RECONNECT_INTERVAL) {
            lastReconnect = millis();
            connectMQTT();
        }
    } else {
        digitalWrite(LED_MQTT, HIGH);
        mqtt.loop();
    }

    // Read and publish sensor data
    if (millis() - lastSensorRead >= SENSOR_INTERVAL) {
        lastSensorRead = millis();
        
        SensorData data;
        readSensors(data);
        
        if (mqtt.connected()) {
            publishSensorData(data);
        }
    }

    // Heartbeat
    if (millis() - lastHeartbeat >= HEARTBEAT_INTERVAL) {
        lastHeartbeat = millis();
        
        if (mqtt.connected()) {
            publishStatus("online");
        }
    }

    // Handle button press
    if (buttonPressed) {
        buttonPressed = false;
        relayState = !relayState;
        digitalWrite(RELAY_PIN, relayState);
        
        Serial.printf("Button pressed! Relay: %s\n", relayState ? "ON" : "OFF");
        
        if (mqtt.connected()) {
            JsonDocument doc;
            doc["relay"] = relayState;
            doc["source"] = "button";
            
            char buffer[128];
            serializeJson(doc, buffer);
            mqtt.publish(TOPIC_STATUS, buffer);
        }
        
        blinkLED(LED_STATUS, 1, 100);
    }

    // Handle motion detection
    if (motionDetected) {
        motionDetected = false;
        
        Serial.println("Motion detected!");
        
        if (mqtt.connected()) {
            JsonDocument doc;
            doc["motion"] = true;
            doc["timestamp"] = millis();
            
            char buffer[128];
            serializeJson(doc, buffer);
            mqtt.publish(TOPIC_STATUS, buffer);
        }
    }

    // Status LED blink
    static unsigned long lastBlink = 0;
    if (millis() - lastBlink >= 1000) {
        lastBlink = millis();
        digitalWrite(LED_STATUS, !digitalRead(LED_STATUS));
    }
}

// ============== WIFI FUNCTIONS ==============
void setupWiFi() {
    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);
    connectWiFi();
}

void connectWiFi() {
    Serial.printf("Connecting to WiFi: %s", WIFI_SSID);
    
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        attempts++;
        blinkLED(LED_WIFI, 1, 100);
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println(" Connected!");
        Serial.printf("IP Address: %s\n", WiFi.localIP().toString().c_str());
        Serial.printf("Signal Strength: %d dBm\n", WiFi.RSSI());
        digitalWrite(LED_WIFI, HIGH);
    } else {
        Serial.println(" Failed!");
    }
}

// ============== MQTT FUNCTIONS ==============
void setupMQTT() {
    mqtt.setServer(MQTT_SERVER, MQTT_PORT);
    mqtt.setCallback(mqttCallback);
    mqtt.setBufferSize(512);  // Increase buffer for large messages
}

void connectMQTT() {
    Serial.printf("Connecting to MQTT: %s:%d...", MQTT_SERVER, MQTT_PORT);
    
    // Last Will Testament
    String willTopic = TOPIC_STATUS;
    String willMessage = "{\"status\":\"offline\",\"client\":\"" + String(MQTT_CLIENT_ID) + "\"}";
    
    bool connected = mqtt.connect(
        MQTT_CLIENT_ID,
        MQTT_API_KEY,           // Username = API Key
        MQTT_PASSWORD,          // Password
        willTopic.c_str(),      // Will topic
        0,                      // Will QoS
        true,                   // Will retain
        willMessage.c_str()     // Will message
    );
    
    if (connected) {
        Serial.println(" Connected!");
        digitalWrite(LED_MQTT, HIGH);
        
        // Subscribe to command topic
        mqtt.subscribe(TOPIC_COMMAND);
        mqtt.subscribe(TOPIC_CONFIG);
        
        Serial.printf("Subscribed to: %s\n", TOPIC_COMMAND);
        Serial.printf("Subscribed to: %s\n", TOPIC_CONFIG);
        
        // Publish online status
        publishStatus("online");
        
        blinkLED(LED_MQTT, 2, 100);
    } else {
        Serial.printf(" Failed! Error: %d\n", mqtt.state());
        /*
         * MQTT State Codes:
         * -4 : MQTT_CONNECTION_TIMEOUT
         * -3 : MQTT_CONNECTION_LOST
         * -2 : MQTT_CONNECT_FAILED
         * -1 : MQTT_DISCONNECTED
         *  0 : MQTT_CONNECTED
         *  1 : MQTT_CONNECT_BAD_PROTOCOL
         *  2 : MQTT_CONNECT_BAD_CLIENT_ID
         *  3 : MQTT_CONNECT_UNAVAILABLE
         *  4 : MQTT_CONNECT_BAD_CREDENTIALS
         *  5 : MQTT_CONNECT_UNAUTHORIZED
         */
    }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
    Serial.printf("Message received [%s]: ", topic);
    
    // Convert payload to string
    char message[length + 1];
    memcpy(message, payload, length);
    message[length] = '\0';
    Serial.println(message);
    
    // Parse JSON
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, message);
    
    if (error) {
        Serial.printf("JSON parse error: %s\n", error.c_str());
        return;
    }
    
    // Handle based on topic
    if (strcmp(topic, TOPIC_COMMAND) == 0) {
        handleCommand(doc);
    } else if (strcmp(topic, TOPIC_CONFIG) == 0) {
        // Handle configuration updates
        if (doc.containsKey("interval")) {
            // Update sensor interval
            Serial.printf("New interval: %d\n", doc["interval"].as<int>());
        }
    }
}

void handleCommand(JsonDocument &doc) {
    // Handle relay command
    if (doc.containsKey("relay")) {
        relayState = doc["relay"].as<bool>();
        digitalWrite(RELAY_PIN, relayState);
        Serial.printf("Relay set to: %s\n", relayState ? "ON" : "OFF");
    }
    
    // Handle LED command
    if (doc.containsKey("led")) {
        bool ledState = doc["led"].as<bool>();
        digitalWrite(LED_STATUS, ledState);
        Serial.printf("LED set to: %s\n", ledState ? "ON" : "OFF");
    }
    
    // Handle restart command
    if (doc.containsKey("restart") && doc["restart"].as<bool>()) {
        Serial.println("Restart command received!");
        publishStatus("restarting");
        delay(1000);
        ESP.restart();
    }
    
    // Handle deep sleep command
    if (doc.containsKey("sleep")) {
        int seconds = doc["sleep"].as<int>();
        Serial.printf("Deep sleep for %d seconds\n", seconds);
        enterDeepSleep(seconds);
    }
    
    // Handle debug mode
    if (doc.containsKey("debug")) {
        debugMode = doc["debug"].as<bool>();
        Serial.printf("Debug mode: %s\n", debugMode ? "ON" : "OFF");
    }
    
    // Send acknowledgment
    JsonDocument ack;
    ack["ack"] = true;
    ack["command"] = doc.as<JsonObject>();
    
    char buffer[256];
    serializeJson(ack, buffer);
    mqtt.publish(TOPIC_STATUS, buffer);
}

// ============== SENSOR FUNCTIONS ==============
void readSensors(SensorData &data) {
    // Read DHT sensor
    data.temperature = dht.readTemperature();
    data.humidity = dht.readHumidity();
    
    // Check for DHT read errors
    if (isnan(data.temperature) || isnan(data.humidity)) {
        Serial.println("DHT read error!");
        data.temperature = 0;
        data.humidity = 0;
    }
    
    // Read analog value
    data.analogValue = analogRead(ANALOG_PIN);
    
    // Convert to voltage (ESP32 ADC is 12-bit, 0-3.3V)
    data.voltage = (data.analogValue / 4095.0) * 3.3;
    
    // Read motion sensor
    data.motion = digitalRead(PIR_PIN);
    
    // Get WiFi signal strength
    data.rssi = WiFi.RSSI();
    
    if (debugMode) {
        Serial.println("\n--- Sensor Readings ---");
        Serial.printf("Temperature: %.2f °C\n", data.temperature);
        Serial.printf("Humidity: %.2f %%\n", data.humidity);
        Serial.printf("Analog: %d (%.2f V)\n", data.analogValue, data.voltage);
        Serial.printf("Motion: %s\n", data.motion ? "YES" : "NO");
        Serial.printf("RSSI: %d dBm\n", data.rssi);
        Serial.println("-----------------------\n");
    }
}

void publishSensorData(SensorData &data) {
    JsonDocument doc;
    
    // Device info
    doc["device"] = MQTT_CLIENT_ID;
    doc["uptime"] = millis() / 1000;
    doc["messages"] = ++messageCount;
    
    // Sensor data
    JsonObject sensors = doc["sensors"].to<JsonObject>();
    sensors["temperature"] = round(data.temperature * 100) / 100.0;
    sensors["humidity"] = round(data.humidity * 100) / 100.0;
    sensors["analog"] = data.analogValue;
    sensors["voltage"] = round(data.voltage * 100) / 100.0;
    sensors["motion"] = data.motion;
    
    // Status
    JsonObject status = doc["status"].to<JsonObject>();
    status["relay"] = relayState;
    status["rssi"] = data.rssi;
    status["heap"] = ESP.getFreeHeap();
    
    // Serialize and publish
    char buffer[512];
    size_t len = serializeJson(doc, buffer);
    
    if (mqtt.publish(TOPIC_SENSOR, buffer)) {
        if (debugMode) {
            Serial.printf("Published (%d bytes): %s\n", len, buffer);
        }
    } else {
        Serial.println("Publish failed!");
    }
}

void publishStatus(const char* status) {
    JsonDocument doc;
    doc["client"] = MQTT_CLIENT_ID;
    doc["status"] = status;
    doc["ip"] = WiFi.localIP().toString();
    doc["rssi"] = WiFi.RSSI();
    doc["uptime"] = millis() / 1000;
    doc["heap"] = ESP.getFreeHeap();
    doc["version"] = "1.0.0";
    
    char buffer[256];
    serializeJson(doc, buffer);
    mqtt.publish(TOPIC_STATUS, buffer, true);  // Retained message
    
    Serial.printf("Status: %s\n", status);
}

// ============== UTILITY FUNCTIONS ==============
void blinkLED(int pin, int times, int delayMs) {
    for (int i = 0; i < times; i++) {
        digitalWrite(pin, HIGH);
        delay(delayMs);
        digitalWrite(pin, LOW);
        delay(delayMs);
    }
}

void enterDeepSleep(int seconds) {
    Serial.printf("Entering deep sleep for %d seconds...\n", seconds);
    
    // Turn off LEDs
    digitalWrite(LED_STATUS, LOW);
    digitalWrite(LED_WIFI, LOW);
    digitalWrite(LED_MQTT, LOW);
    
    // Disconnect MQTT
    publishStatus("sleeping");
    mqtt.disconnect();
    
    // Disconnect WiFi
    WiFi.disconnect(true);
    
    // Configure wake-up timer
    esp_sleep_enable_timer_wakeup(seconds * 1000000ULL);
    
    // Enter deep sleep
    esp_deep_sleep_start();
}

// Interrupt Service Routines
void IRAM_ATTR buttonISR() {
    static unsigned long lastPress = 0;
    if (millis() - lastPress > 200) {  // Debounce
        buttonPressed = true;
        lastPress = millis();
    }
}

void IRAM_ATTR motionISR() {
    motionDetected = true;
}
