"""
Calibration Tools

Utilities for threshold tuning, parameter optimization, and test data generation
for EMG gesture detection and servo control.
"""

import numpy as np
from typing import Tuple, List, Dict
from . import signal_analyzer


def estimate_gesture_thresholds(
    rms_resting: np.ndarray,
    rms_active: np.ndarray,
    percentile_lower: float = 90.0,
    percentile_upper: float = 60.0
) -> Tuple[float, float]:
    """
    Estimate open/close thresholds from calibration data.

    Strategy:
      - Open threshold: ~90th percentile of resting RMS
      - Close threshold: ~60th percentile of active RMS (conservative)

    Args:
        rms_resting: RMS values from relaxed state (no muscle activation)
        rms_active: RMS values from active muscle state (strong flexion)
        percentile_lower: Percentile for open threshold
        percentile_upper: Percentile for close threshold (from active data)

    Returns:
        Tuple of (open_threshold, close_threshold)
    """
    open_thresh = np.percentile(rms_resting, percentile_lower)
    close_thresh = np.percentile(rms_active, percentile_upper)

    # Ensure hysteresis: close > open
    if close_thresh <= open_thresh:
        close_thresh = open_thresh * 1.5

    return float(open_thresh), float(close_thresh)


def analyze_resting_signal(
    raw_signal: np.ndarray,
    fs: float = 1000.0,
    duration_secs: float = 10.0
) -> Dict[str, float]:
    """
    Analyze a resting EMG recording to characterize baseline noise.

    Args:
        raw_signal: Recorded EMG data during rest
        fs: Sampling frequency (Hz)
        duration_secs: Duration of recording (for reference)

    Returns:
        Dictionary with statistics: mean, std, min, max, rms, percentiles
    """
    analyzer = signal_analyzer.EMGAnalyzer(fs=fs)
    envelope, rms_vals = analyzer.process_pipeline(raw_signal)

    stats = {
        'mean_rms': float(np.mean(rms_vals)),
        'std_rms': float(np.std(rms_vals)),
        'min_rms': float(np.min(rms_vals)),
        'max_rms': float(np.max(rms_vals)),
        'median_rms': float(np.median(rms_vals)),
        'p90_rms': float(np.percentile(rms_vals, 90)),
        'p95_rms': float(np.percentile(rms_vals, 95)),
    }
    return stats


def analyze_active_signal(
    raw_signal: np.ndarray,
    fs: float = 1000.0,
    duration_secs: float = 10.0
) -> Dict[str, float]:
    """
    Analyze an active EMG recording during muscle contraction.

    Args:
        raw_signal: Recorded EMG data during strong flexion
        fs: Sampling frequency (Hz)
        duration_secs: Duration of recording (for reference)

    Returns:
        Dictionary with statistics
    """
    analyzer = signal_analyzer.EMGAnalyzer(fs=fs)
    envelope, rms_vals = analyzer.process_pipeline(raw_signal)

    stats = {
        'mean_rms': float(np.mean(rms_vals)),
        'std_rms': float(np.std(rms_vals)),
        'min_rms': float(np.min(rms_vals)),
        'max_rms': float(np.max(rms_vals)),
        'median_rms': float(np.median(rms_vals)),
        'p10_rms': float(np.percentile(rms_vals, 10)),
        'p50_rms': float(np.percentile(rms_vals, 50)),
    }
    return stats


def generate_calibration_report(
    rms_resting: np.ndarray,
    rms_active: np.ndarray,
    output_file: str = None
) -> str:
    """
    Generate a human-readable calibration report.

    Args:
        rms_resting: RMS values from resting period
        rms_active: RMS values from active period
        output_file: Optional file to write report to

    Returns:
        Report text as string
    """
    open_thresh, close_thresh = estimate_gesture_thresholds(
        rms_resting, rms_active
    )

    resting_stats = {
        'mean': np.mean(rms_resting),
        'std': np.std(rms_resting),
        'max': np.max(rms_resting),
        'p95': np.percentile(rms_resting, 95),
    }

    active_stats = {
        'mean': np.mean(rms_active),
        'std': np.std(rms_active),
        'min': np.min(rms_active),
        'p10': np.percentile(rms_active, 10),
    }

    report = f"""
================================================================================
EMG CALIBRATION REPORT
================================================================================

RESTING STATE (No Muscle Activation)
  Mean RMS:        {resting_stats['mean']:.2f}
  Std Dev:         {resting_stats['std']:.2f}
  Max RMS:         {resting_stats['max']:.2f}
  95th Percentile: {resting_stats['p95']:.2f}

ACTIVE STATE (Strong Forearm Flexion)
  Mean RMS:        {active_stats['mean']:.2f}
  Std Dev:         {active_stats['std']:.2f}
  Min RMS:         {active_stats['min']:.2f}
  10th Percentile: {active_stats['p10']:.2f}

RECOMMENDED THRESHOLDS
  Open (relax) threshold:  {open_thresh:.2f}
    (when RMS drops below this, open hand)
  Close (flex) threshold:  {close_thresh:.2f}
    (when RMS rises above this, close hand)

Hysteresis margin: {close_thresh - open_thresh:.2f}
  (Prevents flickering; larger is more stable)

================================================================================
"""

    if output_file:
        with open(output_file, 'w') as f:
            f.write(report)

    return report


class ThresholdOptimizer:
    """
    Sweep and optimize gesture detection thresholds.
    """

    def __init__(self, rms_resting: np.ndarray, rms_active: np.ndarray):
        """
        Initialize optimizer.

        Args:
            rms_resting: RMS values from resting period
            rms_active: RMS values from active period
        """
        self.rms_resting = rms_resting
        self.rms_active = rms_active

    def false_positive_rate(
        self,
        open_threshold: float
    ) -> float:
        """
        Estimate false positive rate (spurious close when resting).

        Args:
            open_threshold: Proposed open threshold

        Returns:
            Fraction of resting samples that exceed threshold
        """
        return np.sum(self.rms_resting > open_threshold) / len(self.rms_resting)

    def false_negative_rate(
        self,
        close_threshold: float
    ) -> float:
        """
        Estimate false negative rate (fail to detect contraction).

        Args:
            close_threshold: Proposed close threshold

        Returns:
            Fraction of active samples that don't exceed threshold
        """
        return np.sum(self.rms_active < close_threshold) / len(self.rms_active)

    def find_optimal_thresholds(
        self,
        target_fpr: float = 0.05,
        target_fnr: float = 0.05
    ) -> Tuple[float, float]:
        """
        Find thresholds that balance false positive and negative rates.

        Args:
            target_fpr: Target false positive rate
            target_fnr: Target false negative rate

        Returns:
            Tuple of (open_threshold, close_threshold)
        """
        # Binary search for open threshold (maximize under target FPR)
        sorted_resting = np.sort(self.rms_resting)
        idx_fpr = int((1 - target_fpr) * len(sorted_resting))
        open_thresh = sorted_resting[min(idx_fpr, len(sorted_resting) - 1)]

        # Binary search for close threshold (minimize above target FNR)
        sorted_active = np.sort(self.rms_active)
        idx_fnr = int(target_fnr * len(sorted_active))
        close_thresh = sorted_active[min(idx_fnr, len(sorted_active) - 1)]

        return float(open_thresh), float(close_thresh)
