#!/usr/bin/env python3
"""
Generate synthetic EMG test signals for development and testing.

Outputs CSV files suitable for offline signal analysis and algorithm validation.
"""

import argparse
import csv
import sys
import numpy as np
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from emg_hand import signal_analyzer


def main():
    parser = argparse.ArgumentParser(
        description="Generate synthetic EMG test signals"
    )
    parser.add_argument(
        "--duration",
        type=float,
        default=10.0,
        help="Signal duration (seconds)"
    )
    parser.add_argument(
        "--fs",
        type=float,
        default=1000.0,
        help="Sampling frequency (Hz)"
    )
    parser.add_argument(
        "--muscle-freq",
        type=float,
        default=50.0,
        help="Muscle activity frequency (Hz)"
    )
    parser.add_argument(
        "--noise-level",
        type=float,
        default=0.1,
        help="Noise standard deviation (fraction of signal)"
    )
    parser.add_argument(
        "--output",
        type=str,
        default="data/synthetic_emg.csv",
        help="Output CSV file path"
    )
    parser.add_argument(
        "--plot",
        action="store_true",
        help="Display plot after generation"
    )

    args = parser.parse_args()

    # Generate synthetic signal
    t, raw_signal = signal_analyzer.generate_synthetic_emg(
        duration=args.duration,
        fs=args.fs,
        muscle_signal_freq=args.muscle_freq,
        noise_level=args.noise_level
    )

    # Process through standard pipeline
    analyzer = signal_analyzer.EMGAnalyzer(fs=args.fs)
    envelope, rms_vals = analyzer.process_pipeline(
        raw_signal,
        apply_bandpass=True,
        apply_rectify=True,
        apply_smoothing=True
    )

    # Write CSV
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['time_s', 'raw_adc', 'envelope', 'rms'])
        for i in range(len(t)):
            writer.writerow([
                f"{t[i]:.4f}",
                f"{raw_signal[i]:.4f}",
                f"{envelope[i]:.4f}",
                f"{rms_vals[min(i, len(rms_vals)-1)]:.4f}"
            ])

    print(f"[OK] Generated {len(t)} samples to {output_path}")
    print(f"     Duration: {args.duration} s")
    print(f"     Sampling rate: {args.fs} Hz")
    print(f"     Signal range: [{np.min(raw_signal):.4f}, {np.max(raw_signal):.4f}]")
    print(f"     RMS range: [{np.min(rms_vals):.4f}, {np.max(rms_vals):.4f}]")

    if args.plot:
        try:
            import matplotlib.pyplot as plt

            fig, axes = plt.subplots(3, 1, figsize=(12, 8))

            axes[0].plot(t, raw_signal, 'b-', alpha=0.7)
            axes[0].set_ylabel('Raw Signal (ADC units)')
            axes[0].set_title('Synthetic EMG Signal')
            axes[0].grid(True, alpha=0.3)

            axes[1].plot(t, envelope, 'g-', alpha=0.7)
            axes[1].set_ylabel('Envelope')
            axes[1].set_title('Processed Signal (After Filtering & Rectification)')
            axes[1].grid(True, alpha=0.3)

            t_rms = t[:len(rms_vals)]
            axes[2].plot(t_rms, rms_vals, 'r-', alpha=0.7)
            axes[2].set_ylabel('RMS Magnitude')
            axes[2].set_xlabel('Time (s)')
            axes[2].set_title('RMS Envelope (Gesture Detection Input)')
            axes[2].grid(True, alpha=0.3)

            plt.tight_layout()
            plt.show()

        except ImportError:
            print("Warning: matplotlib not available; skipping plot")


if __name__ == "__main__":
    main()
