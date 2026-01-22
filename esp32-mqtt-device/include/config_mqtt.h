/**
 * MQTT Configuration Handler
 * Manages MQTT connection settings
 */

#ifndef CONFIG_MQTT_H
#define CONFIG_MQTT_H

#include <Arduino.h>

// MQTT Connection Settings
struct MQTTConfig {
    char server[64];
    int port;
    char clientId[32];
    char apiKey[64];
    char password[64];
    char topicPrefix[32];
    
    // Default constructor
    MQTTConfig() {
        strcpy(server, "192.168.1.100");
        port = 1883;
        strcpy(clientId, "esp32_device");
        strcpy(apiKey, "");
        strcpy(password, "");
        strcpy(topicPrefix, "home/sensor");
    }
    
    // Generate unique client ID based on MAC
    void generateClientId() {
        uint64_t chipId = ESP.getEfuseMac();
        snprintf(clientId, sizeof(clientId), "esp32_%04X%08X", 
                 (uint16_t)(chipId >> 32), (uint32_t)chipId);
    }
    
    // Get topic with prefix
    String getTopic(const char* suffix) {
        return String(topicPrefix) + "/" + String(suffix);
    }
};

// MQTT Topics
struct MQTTTopics {
    String data;
    String status;
    String command;
    String config;
    String lwt;
    
    void init(const char* prefix) {
        data = String(prefix) + "/data";
        status = String(prefix) + "/status";
        command = String(prefix) + "/command";
        config = String(prefix) + "/config";
        lwt = String(prefix) + "/lwt";
    }
};

// MQTT Quality of Service
enum MQTTQoS {
    QOS_0 = 0,  // At most once
    QOS_1 = 1,  // At least once
    QOS_2 = 2   // Exactly once
};

// MQTT Connection States
enum MQTTState {
    MQTT_STATE_DISCONNECTED,
    MQTT_STATE_CONNECTING,
    MQTT_STATE_CONNECTED,
    MQTT_STATE_ERROR
};

#endif
