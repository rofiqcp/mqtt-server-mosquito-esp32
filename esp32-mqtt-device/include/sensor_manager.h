/**
 * Sensor Manager
 * Handles all sensor readings and calibration
 */

#ifndef SENSOR_MANAGER_H
#define SENSOR_MANAGER_H

#include <Arduino.h>
#include <DHT.h>
#include <ArduinoJson.h>

class SensorManager {
private:
    DHT* dht;
    int analogPin;
    int pirPin;
    
    // Calibration values
    float tempOffset = 0.0;
    float humidityOffset = 0.0;
    float voltageMultiplier = 1.0;
    
    // Moving average for smoothing
    static const int AVG_SIZE = 5;
    float tempBuffer[AVG_SIZE] = {0};
    float humBuffer[AVG_SIZE] = {0};
    int bufferIndex = 0;

public:
    struct SensorData {
        float temperature;
        float humidity;
        int analogValue;
        float voltage;
        bool motion;
        bool isValid;
    };

    SensorManager(uint8_t dhtPin, uint8_t dhtType, uint8_t analogPin, uint8_t pirPin) 
        : analogPin(analogPin), pirPin(pirPin) {
        dht = new DHT(dhtPin, dhtType);
    }

    void begin() {
        dht->begin();
        pinMode(pirPin, INPUT);
        
        // Warm-up read
        delay(2000);
        dht->readTemperature();
        dht->readHumidity();
    }

    SensorData read() {
        SensorData data;
        
        // Read DHT sensor
        float temp = dht->readTemperature();
        float hum = dht->readHumidity();
        
        // Validate readings
        if (isnan(temp) || isnan(hum)) {
            data.isValid = false;
            data.temperature = 0;
            data.humidity = 0;
        } else {
            data.isValid = true;
            
            // Add to buffer
            tempBuffer[bufferIndex] = temp;
            humBuffer[bufferIndex] = hum;
            bufferIndex = (bufferIndex + 1) % AVG_SIZE;
            
            // Calculate moving average
            data.temperature = calculateAverage(tempBuffer, AVG_SIZE) + tempOffset;
            data.humidity = calculateAverage(humBuffer, AVG_SIZE) + humidityOffset;
        }
        
        // Read analog
        data.analogValue = analogRead(analogPin);
        data.voltage = (data.analogValue / 4095.0) * 3.3 * voltageMultiplier;
        
        // Read PIR
        data.motion = digitalRead(pirPin);
        
        return data;
    }

    void setCalibration(float tempOff, float humOff, float voltMult) {
        tempOffset = tempOff;
        humidityOffset = humOff;
        voltageMultiplier = voltMult;
    }

    JsonDocument toJson(SensorData& data) {
        JsonDocument doc;
        
        doc["valid"] = data.isValid;
        doc["temperature"]["value"] = round(data.temperature * 100) / 100.0;
        doc["temperature"]["unit"] = "°C";
        doc["humidity"]["value"] = round(data.humidity * 100) / 100.0;
        doc["humidity"]["unit"] = "%";
        doc["analog"]["raw"] = data.analogValue;
        doc["analog"]["voltage"] = round(data.voltage * 1000) / 1000.0;
        doc["motion"] = data.motion;
        
        return doc;
    }

private:
    float calculateAverage(float* buffer, int size) {
        float sum = 0;
        for (int i = 0; i < size; i++) {
            sum += buffer[i];
        }
        return sum / size;
    }
};

#endif
