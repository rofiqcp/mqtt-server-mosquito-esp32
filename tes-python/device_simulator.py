#!/usr/bin/env python3
"""
MQTT Device Simulator
Simulates multiple ESP32 devices sending sensor data
"""

import paho.mqtt.client as mqtt
import json
import random
import time
import threading
import argparse
from datetime import datetime

class DeviceSimulator:
    def __init__(self, device_id, broker_host, broker_port, api_key):
        self.device_id = device_id
        self.broker_host = broker_host
        self.broker_port = broker_port
        self.api_key = api_key
        self.connected = False
        self.message_count = 0
        
        # Sensor simulation parameters
        self.base_temp = random.uniform(22, 28)
        self.base_humidity = random.uniform(45, 65)
        
        # MQTT Client
        self.client = mqtt.Client(client_id=device_id)
        self.client.username_pw_set(api_key, "")
        self.client.on_connect = self.on_connect
        self.client.on_disconnect = self.on_disconnect
        self.client.on_message = self.on_message
        
        # Topics
        self.topic_data = f"home/{device_id}/data"
        self.topic_status = f"home/{device_id}/status"
        self.topic_command = f"home/{device_id}/command"
        
    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            self.connected = True
            print(f"✅ [{self.device_id}] Connected to broker")
            
            # Subscribe to command topic
            client.subscribe(self.topic_command)
            
            # Publish online status
            self.publish_status("online")
        else:
            print(f"❌ [{self.device_id}] Connection failed: {rc}")
            
    def on_disconnect(self, client, userdata, rc):
        self.connected = False
        print(f"📴 [{self.device_id}] Disconnected")
        
    def on_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode())
            print(f"📥 [{self.device_id}] Command: {payload}")
            
            # Handle commands
            if payload.get("restart"):
                print(f"🔄 [{self.device_id}] Restart requested")
            elif "relay" in payload:
                print(f"⚡ [{self.device_id}] Relay: {payload['relay']}")
                
        except Exception as e:
            print(f"⚠️ [{self.device_id}] Error: {e}")
            
    def connect(self):
        try:
            # Set LWT
            lwt_payload = json.dumps({
                "device": self.device_id,
                "status": "offline"
            })
            self.client.will_set(self.topic_status, lwt_payload, qos=1, retain=True)
            
            self.client.connect(self.broker_host, self.broker_port, 60)
            self.client.loop_start()
        except Exception as e:
            print(f"❌ [{self.device_id}] Connect error: {e}")
            
    def disconnect(self):
        self.publish_status("offline")
        self.client.loop_stop()
        self.client.disconnect()
        
    def publish_status(self, status):
        payload = {
            "device": self.device_id,
            "status": status,
            "timestamp": datetime.now().isoformat()
        }
        self.client.publish(self.topic_status, json.dumps(payload), qos=1, retain=True)
        
    def generate_sensor_data(self):
        """Generate realistic sensor data with some variation"""
        # Temperature varies ±2°C from base
        temp = self.base_temp + random.uniform(-2, 2)
        temp += random.uniform(-0.5, 0.5)  # Noise
        
        # Humidity varies ±10% from base
        humidity = self.base_humidity + random.uniform(-10, 10)
        humidity = max(0, min(100, humidity))  # Clamp to 0-100
        
        # Analog value
        analog = random.randint(1500, 2500)
        voltage = (analog / 4095.0) * 3.3
        
        # Motion detection (random)
        motion = random.random() < 0.1  # 10% chance
        
        self.message_count += 1
        
        return {
            "device": self.device_id,
            "uptime": int(time.time()),
            "messages": self.message_count,
            "sensors": {
                "temperature": round(temp, 2),
                "humidity": round(humidity, 2),
                "analog": analog,
                "voltage": round(voltage, 3),
                "motion": motion
            },
            "status": {
                "relay": False,
                "rssi": random.randint(-80, -30),
                "heap": random.randint(200000, 300000)
            }
        }
        
    def publish_data(self):
        if not self.connected:
            return
            
        data = self.generate_sensor_data()
        payload = json.dumps(data)
        
        result = self.client.publish(self.topic_data, payload, qos=0)
        
        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            print(f"📤 [{self.device_id}] T:{data['sensors']['temperature']}°C H:{data['sensors']['humidity']}%")
        else:
            print(f"⚠️ [{self.device_id}] Publish failed")


def main():
    parser = argparse.ArgumentParser(description='MQTT Device Simulator')
    parser.add_argument('--host', default='localhost', help='MQTT broker host')
    parser.add_argument('--port', type=int, default=1883, help='MQTT broker port')
    parser.add_argument('--api-key', default='admin', help='API key for authentication')
    parser.add_argument('--devices', type=int, default=3, help='Number of devices to simulate')
    parser.add_argument('--interval', type=int, default=5, help='Publish interval in seconds')
    args = parser.parse_args()
    
    print("🚀 MQTT Device Simulator")
    print("========================")
    print(f"Broker: {args.host}:{args.port}")
    print(f"Devices: {args.devices}")
    print(f"Interval: {args.interval}s")
    print("")
    
    # Create devices
    devices = []
    for i in range(args.devices):
        device_id = f"sim_device_{i+1:03d}"
        device = DeviceSimulator(device_id, args.host, args.port, args.api_key)
        device.connect()
        devices.append(device)
        time.sleep(0.5)  # Stagger connections
    
    print(f"\n✅ {len(devices)} devices created")
    print("Press Ctrl+C to stop\n")
    
    try:
        while True:
            for device in devices:
                device.publish_data()
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("\n\n🛑 Stopping simulator...")
        for device in devices:
            device.disconnect()
        print("👋 Goodbye!")


if __name__ == "__main__":
    main()
