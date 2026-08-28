"""
EMG Signal Processing and Analysis

Utilities for EMG signal conditioning, feature extraction, and visualization.
Supports offline analysis of recorded signals and synthetic test data.
"""

import numpy as np
from scipy import signal as sp_signal
from typing import Tuple, Optional


def moving_average(data: np.ndarray, window_size: int) -> np.ndarray:
    """
    Apply moving average filter to smooth signal.

    Args:
        data: Input signal array
        window_size: Number of samples in the moving window

    Returns:
        Filtered signal of same length as input
    """
    kernel = np.ones(window_size) / window_size
    filtered = np.convolve(data, kernel, mode='same')
    return filtered


def bandpass_filter(
    data: np.ndarray,
    fs: float,
    lowcut: float = 20.0,
    highcut: float = 450.0,
    order: int = 4
) -> np.ndarray:
    """
    Apply bandpass filter to extract EMG signal band.

    Args:
        data: Input signal array
        fs: Sampling frequency (Hz)
        lowcut: Lower cutoff frequency (Hz)
        highcut: Upper cutoff frequency (Hz)
        order: Filter order

    Returns:
        Bandpass-filtered signal
    """
    nyquist = fs / 2
    low_norm = lowcut / nyquist
    high_norm = highcut / nyquist

    b, a = sp_signal.butter(order, [low_norm, high_norm], btype='band')
    filtered = sp_signal.filtfilt(b, a, data)
    return filtered


def rectify(data: np.ndarray, method: str = 'full') -> np.ndarray:
    """
    Rectify signal (extract envelope).

    Args:
        data: Input signal
        method: 'full' (abs), 'half' (max with 0), or 'squared'

    Returns:
        Rectified signal
    """
    if method == 'full':
        return np.abs(data)
    elif method == 'half':
        return np.maximum(data, 0)
    elif method == 'squared':
        return data ** 2
    else:
        raise ValueError(f"Unknown rectification method: {method}")


def compute_rms(data: np.ndarray, window_size: Optional[int] = None) -> np.ndarray:
    """
    Compute RMS (root mean square) of signal.

    Args:
        data: Input signal array
        window_size: If provided, compute RMS over rolling window

    Returns:
        Single RMS value if window_size is None, else rolling RMS array
    """
    if window_size is None:
        return np.sqrt(np.mean(data ** 2))

    rms_vals = np.zeros(len(data) - window_size + 1)
    for i in range(len(rms_vals)):
        rms_vals[i] = np.sqrt(np.mean(data[i:i+window_size] ** 2))
    return rms_vals


def lowpass_filter(
    data: np.ndarray,
    fs: float,
    cutoff: float = 16.0,
    order: int = 4
) -> np.ndarray:
    """
    Apply low-pass filter for envelope smoothing.

    Args:
        data: Input signal
        fs: Sampling frequency (Hz)
        cutoff: Cutoff frequency (Hz)
        order: Filter order

    Returns:
        Smoothed signal
    """
    nyquist = fs / 2
    cutoff_norm = cutoff / nyquist
    b, a = sp_signal.butter(order, cutoff_norm, btype='low')
    filtered = sp_signal.filtfilt(b, a, data)
    return filtered


def power_spectral_density(
    data: np.ndarray,
    fs: float,
    method: str = 'welch'
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Compute power spectral density of signal.

    Args:
        data: Input signal
        fs: Sampling frequency (Hz)
        method: 'welch' or 'periodogram'

    Returns:
        Tuple of (frequencies, power) arrays
    """
    if method == 'welch':
        freq, psd = sp_signal.welch(data, fs=fs, nperseg=min(1024, len(data)))
    elif method == 'periodogram':
        freq, psd = sp_signal.periodogram(data, fs=fs)
    else:
        raise ValueError(f"Unknown PSD method: {method}")

    return freq, psd


def generate_synthetic_emg(
    duration: float = 5.0,
    fs: float = 1000.0,
    muscle_signal_freq: float = 50.0,
    noise_level: float = 0.1
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Generate synthetic EMG signal for testing.

    Combines a base sinusoidal muscle signal with Gaussian noise.

    Args:
        duration: Signal duration (seconds)
        fs: Sampling frequency (Hz)
        muscle_signal_freq: Frequency of simulated muscle activity (Hz)
        noise_level: Noise standard deviation as fraction of signal amplitude

    Returns:
        Tuple of (time_array, signal_array)
    """
    t = np.arange(0, duration, 1/fs)
    # Base muscle signal
    muscle = np.sin(2 * np.pi * muscle_signal_freq * t)

    # Add amplitude modulation to simulate contraction
    modulation = 0.5 * (1 + np.sin(2 * np.pi * 0.5 * t))  # 0.5 Hz envelope
    muscle = modulation * muscle

    # Add Gaussian noise
    noise = noise_level * np.random.randn(len(t))

    signal = muscle + noise
    return t, signal


class EMGAnalyzer:
    """
    High-level EMG signal analyzer with common processing pipeline.
    """

    def __init__(self, fs: float = 1000.0):
        """
        Initialize analyzer.

        Args:
            fs: Sampling frequency (Hz)
        """
        self.fs = fs

    def process_pipeline(
        self,
        data: np.ndarray,
        apply_bandpass: bool = True,
        apply_rectify: bool = True,
        apply_smoothing: bool = True,
        ma_window: int = 32
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Apply standard EMG processing pipeline.

        Args:
            data: Raw EMG signal
            apply_bandpass: Whether to apply bandpass filter
            apply_rectify: Whether to rectify signal
            apply_smoothing: Whether to apply smoothing
            ma_window: Moving average window size

        Returns:
            Tuple of (envelope, rms) arrays
        """
        signal_out = data.copy()

        if apply_bandpass:
            signal_out = bandpass_filter(signal_out, self.fs)

        if apply_rectify:
            signal_out = rectify(signal_out, method='full')

        if apply_smoothing:
            signal_out = moving_average(signal_out, ma_window)
            signal_out = lowpass_filter(signal_out, self.fs, cutoff=16.0)

        rms_vals = compute_rms(signal_out, window_size=ma_window)

        return signal_out, rms_vals
