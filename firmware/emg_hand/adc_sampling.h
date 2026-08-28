/**
 * ADC Sampling Utilities
 * ESP32-S3 analog-to-digital conversion and buffering
 */

#ifndef ADC_SAMPLING_H
#define ADC_SAMPLING_H

#include <Arduino.h>

/**
 * Initialize ADC for EMG sampling
 * @param pin Analog input pin to configure
 */
void init_adc(int pin) {
    pinMode(pin, INPUT);
    // Optional: configure ADC resolution and attenuation
    // analogSetAttenuation(attenuation);  // For wider voltage range
}

/**
 * Read raw ADC value with averaging
 * @param pin Analog input pin
 * @param samples Number of samples to average
 * @return Averaged ADC value (0-4095 for 12-bit)
 */
uint16_t read_adc_averaged(int pin, int samples = 10) {
    uint32_t sum = 0;
    for (int i = 0; i < samples; i++) {
        sum += analogRead(pin);
    }
    return (uint16_t)(sum / samples);
}

/**
 * Compute RMS (root mean square) of a signal buffer
 * Approximates signal magnitude for envelope detection
 * @param buffer Pointer to signal samples (float)
 * @param length Number of samples
 * @return RMS magnitude
 */
float compute_rms(float* buffer, int length) {
    if (length <= 0) return 0.0;

    float sum_sq = 0.0;
    for (int i = 0; i < length; i++) {
        float sample = buffer[i];
        sum_sq += sample * sample;
    }

    return sqrt(sum_sq / length);
}

#endif  // ADC_SAMPLING_H
