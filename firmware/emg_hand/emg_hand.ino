/**
 * EMG-Controlled Robotic Hand
 * ESP32-S3 Firmware
 *
 * Real-time EMG signal acquisition, processing, and servo control.
 * Reads analog EMG from instrumentation amplifier chain, applies
 * digital signal processing, detects muscle activation, and drives
 * servo motors for finger control.
 */

#include <Arduino.h>
#include <ESP32Servo.h>
#include "adc_sampling.h"
#include "signal_processing.h"
#include "servo_control.h"
#include "calibration.h"

// ADC input pin for EMG signal
const int EMG_PIN = A0;

// Servo control pins (one per finger)
const int SERVO_PINS[] = {4, 5, 6, 7, 8};
const int NUM_FINGERS = 5;

// Signal buffers
const int BUFFER_SIZE = 512;
uint16_t emg_raw[BUFFER_SIZE];
float emg_filtered[BUFFER_SIZE];

// Moving average filter state
MovingAverageFilter ma_filter(32);  // 32-sample moving average

// Servo objects
Servo finger_servos[NUM_FINGERS];
ServoController servo_controller;

// Gesture state
bool fingers_open = true;
unsigned long last_gesture_time = 0;
const unsigned long MIN_GESTURE_INTERVAL = 500;  // 500ms debounce

void setup() {
    // Initialize serial for debugging
    Serial.begin(115200);
    delay(1000);

    Serial.println("\n========================================");
    Serial.println("EMG-Controlled Robotic Hand - Startup");
    Serial.println("========================================\n");

    // Initialize ADC
    init_adc(EMG_PIN);
    Serial.println("[OK] ADC initialized");

    // Initialize servo pins and attach servos
    for (int i = 0; i < NUM_FINGERS; i++) {
        finger_servos[i].attach(SERVO_PINS[i]);
        servo_controller.add_servo(&finger_servos[i], i);
    }
    Serial.println("[OK] Servo motors initialized");

    // Home all servos to open position
    servo_controller.open_all();
    delay(500);

    Serial.println("\n[INFO] Calibration thresholds:");
    Serial.print("  Open threshold:  ");
    Serial.println(CALIBRATION_OPEN_THRESHOLD);
    Serial.print("  Close threshold: ");
    Serial.println(CALIBRATION_CLOSE_THRESHOLD);

    Serial.println("\n[READY] Waiting for EMG signal...\n");
}

void loop() {
    // Read and buffer ADC samples
    for (int i = 0; i < BUFFER_SIZE; i++) {
        emg_raw[i] = analogRead(EMG_PIN);
    }

    // Apply moving average filter
    for (int i = 0; i < BUFFER_SIZE; i++) {
        emg_filtered[i] = ma_filter.update(emg_raw[i]);
    }

    // Compute RMS of filtered signal as muscle activation proxy
    float rms = compute_rms(emg_filtered, BUFFER_SIZE);

    // Gesture detection with hysteresis
    unsigned long now = millis();
    if (now - last_gesture_time > MIN_GESTURE_INTERVAL) {
        if (fingers_open && rms > CALIBRATION_CLOSE_THRESHOLD) {
            // Muscle activation detected: close hand
            servo_controller.close_all();
            fingers_open = false;
            last_gesture_time = now;

            Serial.print("[GESTURE] CLOSE - RMS: ");
            Serial.println(rms);

        } else if (!fingers_open && rms < CALIBRATION_OPEN_THRESHOLD) {
            // Muscle relaxation detected: open hand
            servo_controller.open_all();
            fingers_open = true;
            last_gesture_time = now;

            Serial.print("[GESTURE] OPEN - RMS: ");
            Serial.println(rms);
        }
    }

    // Optional: print signal level every 500ms for monitoring
    static unsigned long last_print = 0;
    if (now - last_print > 500) {
        Serial.print("[SIGNAL] RMS=");
        Serial.print(rms);
        Serial.print(" State=");
        Serial.println(fingers_open ? "OPEN" : "CLOSE");
        last_print = now;
    }

    delay(10);  // Process batch every 10ms (~100 Hz outer loop)
}
