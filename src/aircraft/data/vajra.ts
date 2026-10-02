import type { AircraftConfig } from '../types';

/**
 * VAJRA. This aircraft is fictional. It is not a programme, a proposal or a
 * leak: it is the museum's own design, built to put every idea in chapter 7 on
 * one airframe so they can be looked at together.
 *
 * Nothing about it should be read as a claim. All of its numbers are stated as
 * design intent rather than measurement, and the ones that would only be known
 * from flying it are absent.
 */
export const VAJRA: AircraftConfig = {
  id: 'vajra',
  name: 'VAJRA',
  designation: 'VAJRA',
  exhibitNo: '027',
  chapter: 7,
  spec: {
    engines: { count: 2, type: 'turbofan' },
    crew: 1,
    role: 'Air dominance concept',
    country: 'IN',
    generation: '6-concept',
    status: 'concept',
  },
  copy: {
    category: 'FICTIONAL SIXTH-GENERATION CONCEPT',
    subtitle: [
      'Not a programme and not a proposal: the museum drawing',
      'one airframe to hold every idea in this chapter.',
    ],
    annotations: [
      {
        n: '01',
        title: 'Invented, and saying so',
        body: 'Every other aircraft here is real and drawn from the public record. This one is not. It exists so the chapter has something it is allowed to be specific about, and it carries no performance figures because there is nothing to measure.',
      },
      {
        n: '02',
        title: 'Tailless, because the fins went first',
        body: 'No vertical surfaces and no tailplane. Yaw comes from split ailerons opening as drag rudders at the wingtips, and from vectoring the exhaust. The flight-control laws are the aircraft; the shape is what is left once they exist.',
      },
      {
        n: '03',
        title: 'A lambda wing',
        body: 'A sharply swept inner panel for volume and span loading, a shallower outer panel for the cruise, and a trailing edge broken into segments that each do more than one job. Every edge on the aircraft runs parallel to one of two lines.',
      },
      {
        n: '04',
        title: 'Shielded everything',
        body: 'Inlets on the upper surface, exhausts buried above the trailing edge, weapons inside. An aircraft designed on the assumption that whatever is hunting it is underneath it.',
      },
    ],
  },
  palette: {
    skin: '#5a6268',
    skinLight: '#6f777e',
    skinDark: '#41484e',
    skinShade: '#4d545a',
    frame: '#23282e',
    glass: '#c7a558',
    cockpit: '#20252b',
    seat: '#30363c',
    hud: '#7cf0c4',
    metal: '#868c92',
    nozzle: '#565350',
    exhaust: '#6b3417',
    accent: '#ff9933',
  },
  geometry: {
    bbox: { span: 16.8, height: 3.8 },
    fuselage: {
      length: 21.6,
      radomeTo: 0.05,
      noseTo: 0.22,
      stations: [
        { t: 0, w: 0.1, h: 0.07, y: -0.02, e: 2 },
        { t: 0.05, w: 0.54, h: 0.26, y: -0.04, e: 2.8, chine: 1, chineY: 0.36, chineTop: 0.2, chineBottom: 0.38 },
        { t: 0.14, w: 1.0, h: 0.42, y: -0.08, e: 3.4, chine: 1, chineY: 0.36, chineTop: 0.22, chineBottom: 0.4 },
        { t: 0.26, w: 1.4, h: 0.54, y: -0.12, e: 4, chine: 1, chineY: 0.38, chineTop: 0.3, chineBottom: 0.46 },
        { t: 0.4, w: 1.72, h: 0.6, y: -0.16, e: 4.4, chine: 1, chineY: 0.4, chineTop: 0.4, chineBottom: 0.52 },
        { t: 0.56, w: 1.8, h: 0.6, y: -0.16, e: 4.6, chine: 1, chineY: 0.42, chineTop: 0.48, chineBottom: 0.58 },
        { t: 0.72, w: 1.72, h: 0.56, y: -0.16, e: 4.6, chine: 1, chineY: 0.44, chineTop: 0.58, chineBottom: 0.66 },
        { t: 0.88, w: 1.46, h: 0.5, y: -0.14, e: 4.4, chine: 1, chineY: 0.46, chineTop: 0.72, chineBottom: 0.78 },
        { t: 1, w: 1.2, h: 0.44, y: -0.12, e: 4.2, chine: 0.8 },
      ],
    },
    wing: {
      kind: 'cranked-delta',
      span: 16.8,
      rootOffset: 1.78,
      rootChord: 13.0,
      tipChord: 3.2,
      sweep: 56,
      // The lambda break. The outer panel runs on the second of the two
      // angles the whole airframe is drawn to.
      kink: { at: 0.45, chord: 6.2, sweep: 40 },
      dihedral: 0,
      thickness: 0.34,
      atZ: 6.2,
      atY: -0.18,
      tipThicknessRatio: 0.32,
    },
    intakes: [
      {
        kind: 'dorsal',
        atZ: 5.8,
        length: 3.6,
        halfWidth: 0.62,
        height: 0.46,
        atY: 0.34,
        offsetX: 1.3,
        duct: true,
        sDuct: { toY: -0.08, toX: 0.95 },
      },
    ],
    nozzle: {
      kind: 'vectoring-2d',
      atZ: 21.4,
      radius: 0.52,
      atY: -0.1,
      separation: 1.0,
      length: 2.0,
      engineFromZ: 13.8,
      engineRadius: 0.52,
      serrations: 8,
      vector: 8,
    },
    canopy: {
      fromZ: 3.0,
      toZ: 6.6,
      baseY: 0.22,
      topY: 0.9,
      halfWidth: 0.46,
      tier: 'hmd',
      seats: 1,
    },
    bays: [
      {
        fromZ: 7.6,
        toZ: 14.0,
        halfWidth: 1.14,
        atY: -0.28,
        depth: 0.44,
        doorOpen: 0,
      },
    ],
    markings: {
      radius: 1.0,
      wing: { x: 4.4, chord: 0.5 },
      fuselageZ: 14.4,
    },
  },
};
