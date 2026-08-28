"""
EMG Robotic Hand - Python signal processing and utilities

Modules:
  signal_analyzer: EMG signal processing, feature extraction, and analysis
  calibration_tools: Threshold tuning and parameter optimization
"""

__version__ = "0.1.0"
__author__ = "Anirudh G."

from . import signal_analyzer
from . import calibration_tools

__all__ = ["signal_analyzer", "calibration_tools"]
