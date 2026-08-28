/**
 * Signal Processing Utilities
 * Digital filtering and feature extraction
 */

#ifndef SIGNAL_PROCESSING_H
#define SIGNAL_PROCESSING_H

#include <Arduino.h>

/**
 * Moving Average Filter
 * Reduces high-frequency noise and tremor from EMG signal
 */
class MovingAverageFilter {
private:
    int window_size;
    float* buffer;
    int head;
    float sum;

public:
    /**
     * Constructor
     * @param window_size Number of samples to average (typically 16-64)
     */
    MovingAverageFilter(int window_size = 32)
        : window_size(window_size), head(0), sum(0.0) {
        buffer = new float[window_size];
        for (int i = 0; i < window_size; i++) {
            buffer[i] = 0.0;
        }
    }

    /**
     * Process one sample through the filter
     * @param sample Input value
     * @return Filtered output
     */
    float update(float sample) {
        // Remove old sample from sum
        sum -= buffer[head];

        // Add new sample
        buffer[head] = sample;
        sum += sample;

        // Advance circular buffer pointer
        head = (head + 1) % window_size;

        // Return average
        return sum / window_size;
    }

    void reset() {
        head = 0;
        sum = 0.0;
        for (int i = 0; i < window_size; i++) {
            buffer[i] = 0.0;
        }
    }

    ~MovingAverageFilter() {
        delete[] buffer;
    }
};

/**
 * Simple low-pass filter (single-pole IIR)
 * For additional smoothing at low computational cost
 *
 * y[n] = alpha * x[n] + (1 - alpha) * y[n-1]
 * where alpha = 1 / (1 + RC), and RC is a time constant
 */
class LowPassFilter {
private:
    float alpha;
    float last_output;

public:
    /**
     * Constructor
     * @param alpha Smoothing factor [0, 1]. Smaller = more smoothing.
     *              Typical range: 0.05 - 0.3
     */
    LowPassFilter(float alpha = 0.1) : alpha(alpha), last_output(0.0) {}

    float update(float input) {
        last_output = alpha * input + (1.0 - alpha) * last_output;
        return last_output;
    }

    void reset() {
        last_output = 0.0;
    }

    void set_alpha(float new_alpha) {
        alpha = constrain(new_alpha, 0.0, 1.0);
    }
};

/**
 * Hysteresis threshold detector
 * Prevents flickering on slow signal transitions
 */
class HysteresisDetector {
private:
    float threshold_high;
    float threshold_low;
    bool state;

public:
    /**
     * Constructor
     * @param low Lower threshold
     * @param high Upper threshold (should be > low)
     */
    HysteresisDetector(float low, float high)
        : threshold_low(low), threshold_high(high), state(false) {}

    /**
     * Update detector with new sample
     * @param value Input signal magnitude
     * @return True if "active" state, false otherwise
     */
    bool update(float value) {
        if (state && value < threshold_low) {
            state = false;
        } else if (!state && value > threshold_high) {
            state = true;
        }
        return state;
    }

    bool get_state() const {
        return state;
    }

    void reset() {
        state = false;
    }
};

#endif  // SIGNAL_PROCESSING_H
