"""
Unit tests for EMG signal processing pipeline.
"""

import sys
from pathlib import Path
import numpy as np

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from emg_hand import signal_analyzer, calibration_tools


def test_moving_average():
    """Test moving average filter."""
    data = np.array([1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0])
    filtered = signal_analyzer.moving_average(data, window_size=3)

    # First value should be averaged with padding
    assert len(filtered) == len(data)
    assert filtered[4] > 0  # Should have some smoothing effect


def test_bandpass_filter():
    """Test bandpass filter extracts expected frequency range."""
    fs = 1000.0
    duration = 1.0
    t = np.arange(0, duration, 1/fs)

    # Signal at 100 Hz (within EMG band)
    signal_in_band = np.sin(2 * np.pi * 100 * t)

    # Signal at 10 Hz (below EMG band)
    signal_below = np.sin(2 * np.pi * 10 * t)

    # Filter both
    filtered_in = signal_analyzer.bandpass_filter(signal_in_band, fs)
    filtered_below = signal_analyzer.bandpass_filter(signal_below, fs)

    # In-band signal should be mostly preserved
    in_band_power = np.mean(filtered_in ** 2)
    below_power = np.mean(filtered_below ** 2)

    assert in_band_power > below_power


def test_rectify():
    """Test rectification methods."""
    data = np.array([-2.0, -1.0, 0.0, 1.0, 2.0])

    full = signal_analyzer.rectify(data, method='full')
    assert np.allclose(full, np.array([2.0, 1.0, 0.0, 1.0, 2.0]))

    half = signal_analyzer.rectify(data, method='half')
    assert np.allclose(half, np.array([0.0, 0.0, 0.0, 1.0, 2.0]))

    squared = signal_analyzer.rectify(data, method='squared')
    assert np.allclose(squared, np.array([4.0, 1.0, 0.0, 1.0, 4.0]))


def test_compute_rms():
    """Test RMS computation."""
    data = np.array([1.0, 2.0, 3.0, 4.0, 5.0])

    rms = signal_analyzer.compute_rms(data)
    expected = np.sqrt((1**2 + 2**2 + 3**2 + 4**2 + 5**2) / 5)
    assert np.isclose(rms, expected)


def test_synthetic_emg_generation():
    """Test synthetic EMG signal generation."""
    t, signal = signal_analyzer.generate_synthetic_emg(
        duration=1.0,
        fs=1000.0,
        muscle_signal_freq=50.0,
        noise_level=0.1
    )

    assert len(t) == len(signal)
    assert len(t) == 1000  # 1 second at 1000 Hz
    assert np.min(signal) < 0 and np.max(signal) > 0  # Bipolar


def test_emg_analyzer_pipeline():
    """Test the full EMG analysis pipeline."""
    # Generate synthetic signal
    t, raw_signal = signal_analyzer.generate_synthetic_emg(
        duration=2.0,
        fs=1000.0,
        muscle_signal_freq=50.0,
        noise_level=0.05
    )

    # Process
    analyzer = signal_analyzer.EMGAnalyzer(fs=1000.0)
    envelope, rms_vals = analyzer.process_pipeline(raw_signal)

    # Envelope should be smoothed and non-negative
    assert len(envelope) == len(raw_signal)
    assert np.all(envelope >= 0)

    # RMS should be shorter (windowed computation)
    assert len(rms_vals) < len(raw_signal)
    assert np.all(rms_vals >= 0)


def test_threshold_estimation():
    """Test threshold estimation from resting/active data."""
    # Simulated resting data (low RMS)
    rms_resting = np.random.normal(loc=100.0, scale=20.0, size=1000)
    rms_resting = np.maximum(rms_resting, 0)  # No negative RMS

    # Simulated active data (high RMS)
    rms_active = np.random.normal(loc=300.0, scale=50.0, size=1000)
    rms_active = np.maximum(rms_active, 0)

    open_thresh, close_thresh = calibration_tools.estimate_gesture_thresholds(
        rms_resting, rms_active
    )

    # Thresholds should be in expected ranges
    assert 80 < open_thresh < 150
    assert 200 < close_thresh < 400
    assert close_thresh > open_thresh


def test_threshold_optimizer():
    """Test threshold optimizer false rate calculations."""
    rms_resting = np.random.normal(loc=100.0, scale=20.0, size=500)
    rms_resting = np.maximum(rms_resting, 0)

    rms_active = np.random.normal(loc=300.0, scale=50.0, size=500)
    rms_active = np.maximum(rms_active, 0)

    optimizer = calibration_tools.ThresholdOptimizer(rms_resting, rms_active)

    # Test FPR calculation
    fpr = optimizer.false_positive_rate(open_threshold=150.0)
    assert 0.0 <= fpr <= 1.0

    # Test FNR calculation
    fnr = optimizer.false_negative_rate(close_threshold=250.0)
    assert 0.0 <= fnr <= 1.0

    # Find optimal thresholds
    opt_open, opt_close = optimizer.find_optimal_thresholds(
        target_fpr=0.05,
        target_fnr=0.05
    )
    assert opt_close > opt_open


if __name__ == "__main__":
    # Simple test runner
    tests = [
        test_moving_average,
        test_bandpass_filter,
        test_rectify,
        test_compute_rms,
        test_synthetic_emg_generation,
        test_emg_analyzer_pipeline,
        test_threshold_estimation,
        test_threshold_optimizer,
    ]

    passed = 0
    failed = 0
    for test in tests:
        try:
            test()
            print(f"✓ {test.__name__}")
            passed += 1
        except Exception as e:
            print(f"✗ {test.__name__}: {e}")
            failed += 1

    print(f"\n{passed} passed, {failed} failed")
    sys.exit(0 if failed == 0 else 1)
