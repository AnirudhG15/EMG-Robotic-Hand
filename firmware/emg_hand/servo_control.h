/**
 * Servo Control Utilities
 * PWM-based finger actuation
 */

#ifndef SERVO_CONTROL_H
#define SERVO_CONTROL_H

#include <Arduino.h>
#include <ESP32Servo.h>

// Servo travel limits (microseconds, standard hobby servo range)
const int SERVO_OPEN_US = 2000;   // Fully open finger
const int SERVO_CLOSE_US = 1000;  // Fully closed finger
const int SERVO_SPEED_MS = 300;   // Smooth sweep duration (ms)

/**
 * Servo Controller
 * Manages multiple servo motors for finger actuation
 */
class ServoController {
private:
    static const int MAX_SERVOS = 5;
    Servo* servos[MAX_SERVOS];
    int servo_count;
    bool servo_state[MAX_SERVOS];  // true = open, false = closed

public:
    ServoController() : servo_count(0) {
        for (int i = 0; i < MAX_SERVOS; i++) {
            servos[i] = nullptr;
            servo_state[i] = true;  // Default: open
        }
    }

    /**
     * Register a servo for control
     * @param servo Pointer to Servo object
     * @param index Finger index (0-4)
     */
    void add_servo(Servo* servo, int index) {
        if (index >= 0 && index < MAX_SERVOS && servo_count < MAX_SERVOS) {
            servos[index] = servo;
            servo_count++;
            servo_state[index] = true;
        }
    }

    /**
     * Open a single finger
     * @param finger_index 0-4
     */
    void open_finger(int finger_index) {
        if (finger_index >= 0 && finger_index < MAX_SERVOS && servos[finger_index]) {
            servos[finger_index]->writeMicroseconds(SERVO_OPEN_US);
            servo_state[finger_index] = true;
        }
    }

    /**
     * Close a single finger
     * @param finger_index 0-4
     */
    void close_finger(int finger_index) {
        if (finger_index >= 0 && finger_index < MAX_SERVOS && servos[finger_index]) {
            servos[finger_index]->writeMicroseconds(SERVO_CLOSE_US);
            servo_state[finger_index] = false;
        }
    }

    /**
     * Open all fingers simultaneously
     */
    void open_all() {
        for (int i = 0; i < MAX_SERVOS; i++) {
            if (servos[i]) {
                servos[i]->writeMicroseconds(SERVO_OPEN_US);
                servo_state[i] = true;
            }
        }
    }

    /**
     * Close all fingers simultaneously
     */
    void close_all() {
        for (int i = 0; i < MAX_SERVOS; i++) {
            if (servos[i]) {
                servos[i]->writeMicroseconds(SERVO_CLOSE_US);
                servo_state[i] = false;
            }
        }
    }

    /**
     * Set a single finger to intermediate position
     * @param finger_index 0-4
     * @param position 0.0 (open) to 1.0 (closed)
     */
    void set_finger_position(int finger_index, float position) {
        if (finger_index >= 0 && finger_index < MAX_SERVOS && servos[finger_index]) {
            position = constrain(position, 0.0, 1.0);
            int us = SERVO_OPEN_US - (int)(position * (SERVO_OPEN_US - SERVO_CLOSE_US));
            servos[finger_index]->writeMicroseconds(us);
        }
    }

    /**
     * Query current state of a finger
     * @param finger_index 0-4
     * @return true if open, false if closed
     */
    bool is_open(int finger_index) {
        if (finger_index >= 0 && finger_index < MAX_SERVOS) {
            return servo_state[finger_index];
        }
        return true;
    }

    int get_servo_count() const {
        return servo_count;
    }
};

#endif  // SERVO_CONTROL_H
