# Hardware Documentation

## Signal Chain Design Reference

This directory contains hardware design specifications and reference materials for the EMG-controlled robotic hand.

### Analog Front-End (AFE)

**Stages:**
1. **Instrumentation Amplifier** (INA333) – 20.6× gain, high CMRR
2. **High-Pass Filter** (19.4 Hz) – Remove DC and motion artifact
3. **Second Gain Stage** (48×) – Additional amplification
4. **Low-Pass Filter** (442 Hz) – Anti-aliasing, noise rejection
5. **Precision Rectifier** – Extract signal envelope
6. **Envelope Smoothing** (16 Hz) – Final low-pass

**Total DC-coupled gain:** ~990×
- Input: 1–5 mV (EMG)
- Output: 1–5 V (ADC input range)

### PCB Layout & Fabrication

**Files:**
- `emg_afe.kicad_sch` – Schematic in KiCad format
- `emg_afe.kicad_pcb` – PCB layout
- `bom.csv` – Bill of materials with part numbers

**Fabrication notes:**
- 2-layer PCB, standard 1.6 mm thickness
- Ground plane on Layer 2 for noise immunity
- Kelvin connection on instrumentation amp outputs
- Separate analog and digital ground planes (single-point star at input)
- Track width: 0.25 mm minimum
- Clearance: 0.2 mm minimum

**Recommended vendor:** JLCPCB (turnkey assembly available for ICs)

### CAD Models

**Files:**
- `hollow_forearm.step` – Forearm housing (servo-access side)
- `mounting_bosses.step` – Internal servo mounting features
- `cable_channel.step` – Tendon routing channel

**Printing specifications:**
- Material: PLA or PETG (resin optional for higher detail)
- Wall thickness: 2–2.5 mm on load-bearing sections
- Support: Generate supports for internal bosses; remove carefully
- Print time: ~8–12 hours
- Weight: ~35–40 g

### Servo Specifications

**Motor:** MG90S micro servo
- Voltage: 4.8–6 V
- Speed: 60°/0.12s (unloaded)
- Torque: 1.8 kg·cm @ 4.8 V
- Connectors: Standard 3-pin Futaba

**Mounting:**
- One servo per finger (5 total)
- Mounted on internal bosses in forearm housing
- Pulley radius: ~8 mm (standard servo horn with M3 coupling)
- Travel: 90° (0 → fully open; 90° → fully closed)

### Electrode Configuration

**Type:** Ag/AgCl surface electrodes (ECG-style)
- **Signal electrodes:** 2 (differential pair, placed over flexor digitorum muscle belly)
- **Reference electrode:** 1 (placed on bony landmark, driven for noise cancellation)

**Placement:**
- Electrodes spaced ~20 mm apart along forearm axis
- Slightly offset medial/lateral to capture different motor units
- Prepared with light skin abrasion (alcohol prep pad) for <5 kΩ impedance

**Connector:** 3-lead ECG snap connectors (standard)

### Noise Mitigation Strategies

1. **Driven reference electrode** – Invert and scale common-mode signal, feed back to reference electrode via 1 MΩ safety resistor
2. **Ground plane** – Solid ground on PCB Layer 2
3. **Star-point grounding** – All analog/digital grounds meet at single point at signal input
4. **Shielded cable** – Twisted pair for electrode leads; shield grounded at AFE input only
5. **Decoupling capacitors** – 100 nF at each op-amp supply; 10 µF bulk at board edge
6. **Supply filtering** – LDO regulator preferred; ripple <50 mV RMS

### Assembly Checklist

- [ ] Verify all part values against schematic before soldering
- [ ] Solder passive components first (resistors, capacitors)
- [ ] Inspect solder joints (no bridges, good wetting)
- [ ] Mount ICs; use IC sockets if available
- [ ] Verify power supply polarity at connector
- [ ] Check for continuity: all nets listed in netlist
- [ ] Functional test with known good signal at ADC input
- [ ] Measure gain at each stage with function generator (20 mV input sine)
- [ ] Measure frequency response (20 Hz – 500 Hz, -3 dB points)

### Testing & Troubleshooting

**Common issues:**
- **No output:** Check power supply (3.3 V at pin 8 of each op-amp)
- **High offset voltage:** Calibration capacitors may need adjustment; verify component values
- **Noise/oscillation:** Check for parasitic feedback; ensure short ground connections at Kelvin inputs
- **Gain mismatch between stages:** Verify gain-setting resistor values

**Test signals:**
- Use `scripts/generate_test_signal.py` to create known reference waveforms
- Load into oscilloscope or capture with ESP32 ADC for offline analysis

### References

- **TI Analog Engineer's Circuit Cookbook: Amplifiers**  
  https://www.ti.com/lit/pdf/sboa221

- **Analog Devices AD8232 (Reference ECG Front-End)**  
  https://www.analog.com/media/en/technical-documentation/data-sheets/ad8232.pdf

- **INA333 Instrumentation Amplifier**  
  https://www.ti.com/product/INA333

- **TL072 Operational Amplifier**  
  https://www.ti.com/product/TL072

- **KiCad Documentation**  
  https://docs.kicad.org/

---

**Last updated:** 2026-08-28
