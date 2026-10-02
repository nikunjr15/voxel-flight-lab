import type { AircraftConfig } from '../types';

/**
 * HAL/ADA AMCA. An Indian fifth-generation programme in development; no
 * aircraft has flown, so the model is a stylised interpretation built from
 * published mock-up and model cues, and the spec carries no first-flight date.
 *
 * Length and span are the figures the programme has quoted. Everything else
 * that is not published is left out rather than filled in.
 */
export const AMCA: AircraftConfig = {
  id: 'amca',
  name: 'AMCA',
  designation: 'AMCA',
  exhibitNo: '024',
  chapter: 7,
  spec: {
    engines: { count: 2, type: 'afterburning-turbofan' },
    crew: 1,
    role: 'Multirole stealth fighter',
    country: 'IN',
    generation: '5',
    lengthM: 17.6,
    spanM: 11.1,
    status: 'concept',
  },
  copy: {
    category: 'TWIN-ENGINE STEALTH FIGHTER — IN DEVELOPMENT',
    subtitle: [
      'India designing its own low-observable airframe,',
      'shown here as an interpretation, not a drawing.',
    ],
    annotations: [
      {
        n: '01',
        title: 'What is actually known',
        body: 'A twin-engine shaped airframe with internal carriage, diverterless inlets and canted fins, at roughly the size quoted by the programme. Beyond that the public record is mock-ups and models, which is what this interpretation is built from.',
      },
      {
        n: '02',
        title: 'The step the Tejas did not take',
        body: 'The Tejas proved India could design, certify and field a fighter. Shaping an airframe for radar is a different discipline again: it constrains every line on the aircraft and it cannot be retrofitted.',
      },
      {
        n: '03',
        title: 'Why this is labelled a concept',
        body: 'Nothing here has flown. Treat the shape as a reading of a programme in progress and the numbers as the two the programme has published.',
      },
    ],
  },
  palette: {
    skin: '#71787f',
    skinLight: '#888f96',
    skinDark: '#545b62',
    skinShade: '#636a71',
    frame: '#2b3036',
    glass: '#b9a46a',
    cockpit: '#242930',
    seat: '#343a40',
    hud: '#7cf0c4',
    metal: '#8d9298',
    nozzle: '#625e5a',
    exhaust: '#6b3417',
    accent: '#ff9933',
  },
  geometry: {
    bbox: { span: 11.4, height: 4.8 },
    // Deep, boxy and fully chined: the planform rule puts this one over
    // the voxel budget, so the resolution is set directly.
    targetLengthVoxels: 116,
    fuselage: {
      length: 17.6,
      radomeTo: 0.06,
      noseTo: 0.26,
      stations: [
        { t: 0, w: 0.08, h: 0.07, y: 0.04, e: 2 },
        { t: 0.05, w: 0.42, h: 0.28, y: 0.02, e: 2.4, chine: 0.7, chineY: 0.42, chineTop: 0.3, chineBottom: 0.46 },
        { t: 0.14, w: 0.76, h: 0.48, y: 0.0, e: 3, chine: 1, chineY: 0.42, chineTop: 0.3, chineBottom: 0.46 },
        { t: 0.26, w: 0.98, h: 0.64, y: -0.04, e: 3.4, chine: 1, chineY: 0.44, chineTop: 0.36, chineBottom: 0.52 },
        { t: 0.4, w: 1.12, h: 0.72, y: -0.07, e: 3.6, chine: 1, chineY: 0.46, chineTop: 0.44, chineBottom: 0.58 },
        { t: 0.56, w: 1.14, h: 0.72, y: -0.07, e: 3.8, chine: 0.8, chineY: 0.47, chineTop: 0.52, chineBottom: 0.64 },
        { t: 0.72, w: 1.08, h: 0.68, y: -0.06, e: 3.6, chine: 0.5 },
        { t: 0.88, w: 0.94, h: 0.6, y: -0.05, e: 3.4, chine: 0.3 },
        { t: 1, w: 0.8, h: 0.52, y: -0.04, e: 3.2, chine: 0.1 },
      ],
    },
    wing: {
      kind: 'trapezoid',
      span: 11.1,
      rootOffset: 1.1,
      rootChord: 7.6,
      tipChord: 1.35,
      sweep: 41,
      dihedral: 0,
      thickness: 0.3,
      atZ: 6.4,
      atY: -0.04,
      tipThicknessRatio: 0.4,
    },
    tailH: {
      span: 6.8,
      rootOffset: 1.3,
      rootChord: 2.9,
      tipChord: 0.7,
      sweep: 41,
      dihedral: 0,
      thickness: 0.18,
      atZ: 12.6,
      atY: -0.06,
    },
    tailVTwin: {
      span: 2.4,
      rootChord: 3.0,
      tipChord: 0.9,
      sweep: 28,
      cant: 27,
      separation: 1.25,
      thickness: 0.28,
      atZ: 11.3,
      atY: 0.3,
    },
    fairings: [
      {
        at: [1.1, -0.08],
        fromZ: 5.2,
        toZ: 17.5,
        front: [0.4, 0.56],
        back: [0.44, 0.48],
        mirror: true,
        exponent: 4.2,
      },
    ],
    intakes: [
      {
        kind: 'dsi',
        atZ: 5.2,
        length: 2.4,
        halfWidth: 0.36,
        height: 0.86,
        atY: -0.1,
        offsetX: 1.12,
        duct: true,
        sDuct: { toY: -0.04, toX: 0.86 },
      },
    ],
    nozzle: {
      kind: 'twin-round',
      atZ: 17.6,
      radius: 0.44,
      atY: -0.04,
      separation: 0.66,
      length: 1.5,
      engineFromZ: 11.4,
      engineRadius: 0.42,
      serrations: 10,
    },
    canopy: {
      fromZ: 3.0,
      toZ: 6.0,
      baseY: 0.48,
      topY: 1.32,
      halfWidth: 0.44,
      tier: 'hmd',
      seats: 1,
    },
    bays: [
      {
        fromZ: 6.6,
        toZ: 11.0,
        halfWidth: 0.82,
        atY: -0.3,
        depth: 0.46,
        doorOpen: 0,
      },
    ],
    markings: {
      radius: 0.72,
      wing: { x: 2.9, chord: 0.42 },
      fuselageZ: 12.6,
    },
  },
};
