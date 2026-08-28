/**
 * Calibration Constants
 * Thresholds, gains, and tunable parameters for EMG detection
 *
 * These values should be adjusted during calibration phase (Phase 3/5)
 * based on individual electrode impedance, muscle physiology, and
 * desired sensitivity.
 */

#ifndef CALIBRATION_H
#define CALIBRATION_H

// ============================================================================
// Gesture Detection Thresholds
// ============================================================================
// These define the RMS levels (in ADC units or post-filtered magnitude)
// that trigger hand open/close gestures.
//
// Hysteresis: close_threshold > open_threshold prevents flickering
// on weak or transitional signals.

const float CALIBRATION_OPEN_THRESHOLD = 150.0;   // RMS to relax (open) hand
const float CALIBRATION_CLOSE_THRESHOLD = 250.0;  // RMS to activate (close) hand

// ============================================================================
// Signal Conditioning Gains
// ============================================================================
// ADC → filtered signal conversion; encodes the analog front-end gain
// and any digital scaling applied in firmware.

const float ADC_TO_SIGNAL_GAIN = 1.0;  // 1.0 = no additional digital gain
                                        // Adjust if firmware rescales ADC readings

// ============================================================================
// Filtering Parameters
// ============================================================================

// Moving average window size (samples)
// Larger = more smoothing but slower response; typical 16-64 samples
const int MA_WINDOW_SIZE = 32;

// Single-pole IIR low-pass filter alpha [0, 1]
// Smaller alpha = more smoothing; typical 0.05-0.3
const float LP_FILTER_ALPHA = 0.1;

// ============================================================================
// Servo Timing
// ============================================================================

// Debounce interval (ms): minimum time between gesture transitions
// Prevents false triggers from noise
const unsigned long GESTURE_DEBOUNCE_MS = 500;

// Servo response time (ms): sweep duration for smooth actuation
// Shorter = faster response, but may cause jitter if too fast
const int SERVO_SWEEP_TIME_MS = 300;

// ============================================================================
// Calibration Procedure (to be run during Phase 3)
// ============================================================================
//
// 1. With hand idle and wearer relaxed:
//    - Record 10 seconds of ADC and filtered RMS values
//    - Note the maximum resting RMS (e.g., 100-150 units)
//    - Set CALIBRATION_OPEN_THRESHOLD slightly above this (e.g., 180)
//
// 2. With wearer maximally flexing forearm (strong grip intention):
//    - Record 10 seconds of RMS
//    - Note the peak RMS (e.g., 400-600 units depending on electrode quality)
//    - Set CALIBRATION_CLOSE_THRESHOLD ~60-75% of peak (e.g., 300-350)
//
// 3. Test gesture triggering:
//    - Relax hand -> should see OPEN gesture when RMS < OPEN_THRESHOLD
//    - Flex hand -> should see CLOSE gesture when RMS > CLOSE_THRESHOLD
//    - Verify hysteresis (hand doesn't flicker on weak signals)
//
// 4. Iterate if needed:
//    - If too sensitive: increase thresholds
//    - If not responsive: decrease thresholds
//    - If flickering: increase GESTURE_DEBOUNCE_MS or MA_WINDOW_SIZE
//
// Note: Thresholds are highly individual; plan 30-60 minutes for
// thorough calibration across multiple test subjects.

#endif  // CALIBRATION_H
