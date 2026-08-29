// Copy for the clickable parts of the hand.
//
// Printed parts describe the real InMoov geometry in hardware/Right_Hand_Parts.
// Bought parts (servos, boards) describe the components in the bill of
// materials. Every figure traces to README.md or hardware/pcb/bom.csv.

export const HAND_INFO = {
  shell: {
    kind: 'Printed · PLA',
    title: 'Forearm shell',
    body: 'The forearm is a barrel printed in four half-shells across two sections, closed by an end cap. Roughly 350 grams of PLA at about 2 mm wall thickness.',
    why: 'Everything that drives the hand lives in here. Putting the motors in the forearm rather than the fingers is how the human hand solves the same problem — the muscles that curl your fingers sit in your forearm, not your palm.',
    facts: [['Sections', '2'], ['Half-shells', '4'], ['Wall', '≈ 2 mm'], ['Material', 'PLA']],
  },
  wrist: {
    kind: 'Printed · PLA',
    title: 'Wrist plates',
    body: 'Two stacked plates carry the wrist joint and anchor the tendon routing as it crosses from the forearm into the palm.',
    why: 'Every tendon changes direction here. The plates hold that turn at a fixed radius so the line length stays constant as the wrist moves, which keeps finger position independent of wrist angle.',
    facts: [['Parts', '2'], ['Function', 'Joint + routing']],
  },
  palm: {
    kind: 'Printed · PLA',
    title: 'Palm assembly',
    body: 'A base plate and a top cover. The tendon channels are routed in the cavity between them, one line per finger.',
    why: 'Splitting the palm into two printed halves is what makes the channels possible — you cannot print an enclosed curved channel in one piece without supports inside it.',
    facts: [['Parts', '2'], ['Channels', '5'], ['Span', '95 × 108 mm']],
  },
  digit: {
    kind: 'Printed · PLA',
    title: 'Finger',
    body: 'Three phalanges and their joint pieces, printed flat as a plate of loose parts and assembled with bolts. Braided line runs up the palmar side; elastic cord returns the finger when the line goes slack.',
    why: 'Tendon drive means one servo per finger and no motor in the digit itself. The finger stays slim and light, and a jam bends the line rather than stripping a gearbox.',
    facts: [['Phalanges', '3'], ['Actuation', 'Braided line'], ['Return', 'Elastic cord']],
  },
  cover: {
    kind: 'Printed · PLA',
    title: 'Finger cover',
    body: 'A shell that closes the top of each digit over the tendon channel and the joint hardware.',
    why: 'It keeps the line from jumping its channel under load, and gives the finger a continuous surface to press against an object rather than an open cavity.',
    facts: [['Per hand', '5'], ['Fit', 'Snap over knuckle']],
  },
  bolts: {
    kind: 'Printed · PLA',
    title: 'Bolts and spacers',
    body: 'Printed pins and sleeves that pin every finger joint and set the spacing between the palm plates.',
    why: 'Printing the fasteners rather than buying them keeps the joint diameters exactly matched to the printed holes, which is the difference between a finger that pivots freely and one that binds.',
    facts: [['Joints pinned', '15'], ['Material', 'PLA']],
  },
  bracket: {
    kind: 'Printed · PLA',
    title: 'Controller bracket',
    body: 'A frame that holds the controller board inside the forearm, below the servo bank.',
    why: 'Fixing the board mechanically keeps the electrode leads still. At a gain of 990 any cable movement shows up in the signal as motion artifact.',
    facts: [['Mounts', 'ESP32-S3'], ['Location', 'Lower forearm']],
  },
  mg90s: {
    kind: 'Bought · Actuation',
    title: 'MG90S micro servo',
    body: 'Metal-geared micro servo, one per finger, mounted in a staggered bank to fit the taper of the forearm. Each pulls a braided line routed through the wrist to one fingertip.',
    why: 'Metal gears rather than nylon because a finger stalling against an object is routine, not exceptional. PWM travel limits are clamped in firmware so a jammed finger cannot drive the servo into a stall.',
    facts: [['Count', '5'], ['Size', '23 × 12 × 29 mm'], ['Control', '50 Hz PWM'], ['Cost', '$21 for 5']],
  },
  pcb: {
    kind: 'Bought · Analog',
    title: 'Analog front-end board',
    body: 'A custom two-layer board carrying the whole six-stage front end: instrumentation amplifier, two active filters, a second gain stage, a precision rectifier and the envelope smoother.',
    why: 'At a cascade gain of 990 the layout is a circuit element. A ground plane keeps return currents short, and separate analog and digital grounds joined at exactly one point prevent a loop that would act as an antenna.',
    facts: [['Size', '80 × 60 mm'], ['Layers', '2'], ['Components', '≈ 40'], ['Cost', '$20–25']],
  },
  esp32: {
    kind: 'Bought · Compute',
    title: 'ESP32-S3',
    body: 'Samples the envelope above 900 Hz on a 12-bit ADC, applies a moving average, compares against a calibrated threshold, and drives five PWM channels.',
    why: 'The analog chain reduces a microvolt signal to a clean voltage proportional to effort, but deciding when that counts as intent is a software problem that needs tuning per person and per session. Onboard radio is what makes the hand wireless.',
    facts: [['ADC', '12-bit SAR'], ['Sampling', '> 900 Hz'], ['PWM', '5 channels'], ['Radio', 'Wi-Fi + BLE']],
  },
};
