# EMG-Controlled Robotic Hand

A custom-built electromyography (EMG) controlled robotic hand that reads muscle electrical signals from the forearm, processes them in real time, and drives a servo-actuated mechanical hand. The system demonstrates end-to-end analog instrumentation design, signal conditioning, embedded firmware, and mechanical engineering.

## Overview

**How it works:**
1. Three Ag/AgCl surface electrodes pick up electromyographic signals (20µV–5mV, 20–450 Hz) from the flexor muscles of the forearm during voluntary muscle contraction
2. A custom analog front-end amplifies (×990 gain), filters, and rectifies the signal to extract muscle activation intensity
3. An ESP32-S3 microcontroller digitizes the processed signal and detects muscle activation via threshold-based gesture triggering
4. Five servo motors, one per finger, translate detected gestures into mechanical finger motion via braided-line tendons

**Result:** Wearing the EMG electrode array and operating the robotic hand wirelessly allows the wearer to open/close all five fingers through natural forearm muscle contraction alone.

---

## Mechanical Design

**Hand base:** Original InMoov hand and forearm design (open-source, Gaël Langevin, 2012)
- 5 independently actuated fingers via forearm-mounted MG90S servos
- Tendon-driven actuation using braided fishing line with elastic return
- Custom hollow forearm housing: 3D-printed shell with ~2–2.5 mm wall thickness, open servo-access side, internal mounting bosses, and cable channels

**Actuation:** 5× MG90S micro servos, one per finger

---

## Electrical & Signal Conditioning

**Analog front-end architecture:**

| Stage | Component(s) | Function | Gain / Spec |
|-------|---|---|---|
| **1** | INA333 instrumentation amp (RG = 5.1kΩ) | Initial amplification; high CMRR | ×20.6 |
| **2** | Active high-pass filter (R = 82kΩ, C = 100nF) | Remove DC drift and motion artifact | fH ≈ 19.4 Hz |
| **3** | Op-amp non-inverting amplifier (Rf = 47kΩ, Rin = 1kΩ) | Second gain stage | ×48 |
| **4** | Active low-pass filter (R = 36kΩ, C = 10nF) | Prevent aliasing; suppress high-frequency noise | fL ≈ 442 Hz |
| **5** | Precision feedback rectifier (2× 1N4148 diodes) | Extract envelope (RMS proxy) | Precision AC→DC |
| **6** | Passive RC smoothing (R = 10kΩ, C = 1µF) | Final low-pass smoothing | fL ≈ 16 Hz |

**Total cascade gain:** ~990× (amplified signal = 1–5 V output for 1–5 mV input)

**Noise mitigation:** Driven reference electrode using common-mode averaging and inversion with 1 MΩ safety resistor

**Digitization:** ESP32-S3 onboard SAR ADC (12-bit, >900 Hz sampling) above Nyquist for 450 Hz bandlimited signal

**Electrodes:** 3-lead Ag/AgCl surface electrodes (2 differential signal, 1 reference); standard ECG snap connectors

---

## Bill of Materials

| Category | Item | Spec | Qty | Approx Cost |
|---|---|---|---|---|
| **Analog** | Instrumentation amp | INA333AIDGKR (MSOP-8) | 2 | $16 |
| | Dual op-amp | TL072 or MCP6002 | 3 | $6 |
| | Rectifier diodes | 1N4148 | 4 | included |
| | Resistors, capacitors | 5% film caps, 1/4W | assorted | $5 |
| **Sensing** | Gel electrodes | Ag/AgCl, ECG-style | 30-pack | $10 |
| | Lead cable | 3-lead ECG snap | 1 | $7 |
| **Compute** | Microcontroller | ESP32-S3 dev board | 1 | owned |
| **Actuation** | Servos | MG90S micro | 5 | $21 |
| | Braided fishing line | 50 lb test | 1 spool | $8 |
| | Hardware | M3 bolts, elastic cord | assorted | included |
| **Fabrication** | PCB | 5× custom boards, JLCPCB | 1 order | $20–25 |
| | 3D printing | ~350–400 g hollow forearm | 1 job | $35–40 |
| | **Total** | | | **~$120–127** |

---

## Hardware Layout

```
hardware/
├── pcb/                 # KiCad schematics and PCB layouts
│   ├── emg_afe.kicad_sch      # Instrumentation amplifier chain
│   ├── emg_afe.kicad_pcb      # PCB layout
│   └── bom.csv                # Bill of materials
├── cad/                 # 3D design for forearm housing modification
│   ├── hollow_forearm.step    # Servo-access side design
│   ├── mounting_bosses.step   # Internal servo mounting features
│   └── cable_channel.step     # Tendon routing
└── docs/                # Datasheets and reference materials
    ├── INA333_datasheet.pdf
    ├── TL072_datasheet.pdf
    ├── ESP32-S3_technical_manual.pdf
    ├── MG90S_servo_specs.pdf
    └── InMoov_original_design_reference.pdf
```

---

## Firmware & Software

**Microcontroller:** ESP32-S3 with Arduino-compatible firmware

**Signal processing pipeline:**
- Real-time ADC sampling (>900 Hz)
- Moving-average digital filtering
- Threshold-based gesture detection
- PWM servo control via ESP32Servo library

**Development tools:**
- Arduino IDE with ESP32-S3 board support
- Python 3 with NumPy/Matplotlib for offline signal analysis

**Firmware structure:**
```
firmware/
├── emg_hand/
│   ├── emg_hand.ino             # Main sketch
│   ├── adc_sampling.h           # ADC initialization and sampling loop
│   ├── signal_processing.h      # Moving average, threshold detection
│   ├── servo_control.h          # PWM and finger actuation logic
│   └── calibration.h            # Electrode impedance and gain calibration
└── tests/
    └── mock_data_test.cpp       # Unit tests with simulated signals
```

---

## Repository Structure

```
EMG-Robotic-Hand/
├── README.md                    # This file
├── LICENSE
├── src/
│   └── emg_hand/                # Python signal analysis and tools
│       ├── __init__.py
│       ├── signal_analyzer.py   # EMG signal processing utilities
│       └── calibration_tools.py
├── firmware/
│   └── emg_hand/                # Arduino/ESP32 firmware
│       ├── emg_hand.ino
│       ├── adc_sampling.h
│       ├── signal_processing.h
│       ├── servo_control.h
│       └── calibration.h
├── hardware/
│   ├── pcb/                     # KiCad design files
│   ├── cad/                     # 3D models and mechanical design
│   └── docs/                    # Datasheets and reference docs
├── tests/                       # Test suite
│   ├── test_signal_processing.py
│   └── mock_data_test.cpp
├── scripts/                     # Utility scripts
│   ├── generate_test_signal.py  # Synthetic EMG for development
│   └── calibrate_thresholds.py  # Threshold tuning
├── data/                        # Recorded signals and calibration data
└── .gitignore
```

---

## Key Design Decisions

**Why the original InMoov hand over the newer i2 variant:**
- Forearm-mounted servo configuration matches the custom hollow forearm housing
- Compatible with budget-friendly MG90S servos (~$4 each)
- The i2 variant requires larger, costlier servos and has unresolved community compatibility issues
- Larger build community and more mature documentation

**Why active filtering (op-amp stages) over passive or digital-only:**
- Active high-pass: removes DC drift and motion artifact before digitization
- Active low-pass: prevents ADC aliasing at the analog level (precision rectification requires it)
- Envelope smoothing: low-pass at 16 Hz extracts gesture timing without detecting muscle tremor

**Why a driven reference electrode:**
- Common-mode noise (power-line 60 Hz, equipment noise) couples equally to both signal and reference
- Subtracting a scaled and inverted common-mode signal from the reference electrode reduces CMRR-residual noise
- 1 MΩ safety resistor prevents fault currents if reference lead shorts

---

## Getting Started

**Breadboard prototype (Phase 3):**
1. Assemble analog front-end on breadboard following the schematic in `hardware/pcb/`
2. Test with generated sine-wave signals and recorded EMG datasets
3. Use `scripts/generate_test_signal.py` to create synthetic muscle activation patterns

**PCB fabrication (Phase 6):**
1. Import KiCad files from `hardware/pcb/` into JLCPCB or equivalent
2. Review gerbers and BOM; order with standard lead time

**Firmware deployment:**
1. Install Arduino IDE and ESP32-S3 board support
2. Load `firmware/emg_hand/emg_hand.ino`
3. Configure ADC pin assignments and calibration constants in `calibration.h`
4. Upload and test via serial console

**Mechanical assembly:**
1. Print the modified forearm housing from `hardware/cad/hollow_forearm.step`
2. Mount servos on internal bosses; route tendons through cable channels
3. Attach servo arms to finger linkages

---

## Safety & Comfort

- **Electrode impedance:** Measure before use; insufficient contact requires electrode replacement or skin prep (gentle abrasion with alcohol prep pad)
- **Servo saturation:** PWM limits prevent over-torque; adjust in `servo_control.h` if fingers jam
- **Muscle fatigue:** EMG signals attenuate during sustained contraction; real-time gain adaptation is a future enhancement
- **Biocompatibility:** Use medical-grade gel electrodes; discontinue immediately if skin irritation occurs

---

## Technical References

- **Biopotential Amplifier Design:**  
  TI Analog Engineer's Circuit Cookbook: Amplifiers  
  https://www.ti.com/lit/pdf/sboa221

- **Reference ECG Front-End (AD8232):**  
  Analog Devices Datasheet  
  https://www.analog.com/media/en/technical-documentation/data-sheets/ad8232.pdf

- **PCB Design:**  
  KiCad Documentation — https://docs.kicad.org/

- **Filter Design:**  
  TI WEBENCH Filter Designer — https://www.ti.com/design-resources/design-tools-simulation/webench-filter-designer.html

- **Mechanical Base:**  
  InMoov Hand and Forearm (Original) — https://inmoov.fr/hand-and-forarm/

---

## License

[See LICENSE file]

## Author

Anirudh G., M468 Independent Study, Semester 1
