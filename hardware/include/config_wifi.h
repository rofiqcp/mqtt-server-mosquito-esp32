/**
 * WiFi Configuration Handler
 * Manages WiFi credentials and connection
 */

#ifndef CONFIG_WIFI_H
#define CONFIG_WIFI_H

#include <Arduino.h>
#include <WiFi.h>
#include <EEPROM.h>

#define EEPROM_SIZE 512
#define SSID_ADDR 0
#define PASS_ADDR 64
#define MAX_SSID_LEN 32
#define MAX_PASS_LEN 64

class WiFiConfig {
public:
    static void begin() {
        EEPROM.begin(EEPROM_SIZE);
    }

    static bool loadCredentials(char* ssid, char* password) {
        // Check for valid data marker
        if (EEPROM.read(SSID_ADDR) == 0xFF) {
            return false;
        }

        // Read SSID
        for (int i = 0; i < MAX_SSID_LEN; i++) {
            ssid[i] = EEPROM.read(SSID_ADDR + i);
            if (ssid[i] == '\0') break;
        }

        // Read Password
        for (int i = 0; i < MAX_PASS_LEN; i++) {
            password[i] = EEPROM.read(PASS_ADDR + i);
            if (password[i] == '\0') break;
        }

        return strlen(ssid) > 0;
    }

    static void saveCredentials(const char* ssid, const char* password) {
        // Write SSID
        for (int i = 0; i < MAX_SSID_LEN; i++) {
            EEPROM.write(SSID_ADDR + i, ssid[i]);
            if (ssid[i] == '\0') break;
        }

        // Write Password
        for (int i = 0; i < MAX_PASS_LEN; i++) {
            EEPROM.write(PASS_ADDR + i, password[i]);
            if (password[i] == '\0') break;
        }

        EEPROM.commit();
    }

    static void clearCredentials() {
        for (int i = 0; i < EEPROM_SIZE; i++) {
            EEPROM.write(i, 0xFF);
        }
        EEPROM.commit();
    }

    static bool connect(const char* ssid, const char* password, int timeout = 20) {
        Serial.printf("Connecting to %s", ssid);
        
        WiFi.mode(WIFI_STA);
        WiFi.begin(ssid, password);

        int attempts = 0;
        while (WiFi.status() != WL_CONNECTED && attempts < timeout) {
            delay(500);
            Serial.print(".");
            attempts++;
        }

        if (WiFi.status() == WL_CONNECTED) {
            Serial.println(" Connected!");
            Serial.printf("IP: %s\n", WiFi.localIP().toString().c_str());
            return true;
        }

        Serial.println(" Failed!");
        return false;
    }

    static void startAP(const char* apName = "ESP32-Setup", const char* apPass = "12345678") {
        WiFi.mode(WIFI_AP);
        WiFi.softAP(apName, apPass);
        Serial.printf("AP Started: %s\n", apName);
        Serial.printf("IP: %s\n", WiFi.softAPIP().toString().c_str());
    }
};

#endif
