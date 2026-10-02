import type { AircraftConfig } from '../types';

/**
 * NGAD. The United States' sixth-generation crewed fighter, of which almost
 * nothing is public: no dimensions, no performance, no confirmed planform.
 * This is a stylised tailless interpretation drawn from official concept
 * artwork and from what the programme has said about its priorities, at an
 * assumed size. It is labelled a concept everywhere it appears.
 */
export const NGAD: AircraftConfig = {
  id: 'ngad',
  name: 'NGAD',
  designation: 'NGAD',
  exhibitNo: '026',
  chapter: 7,
  spec: {
    engines: { count: 2, type: 'turbofan' },
    crew: 1,
    role: 'Air dominance fighter',
    country: 'US',
    generation: '6-concept',
    status: 'concept',
  },
  copy: {
    category: 'TAILLESS SIXTH-GENERATION CONCEPT',
    subtitle: [
      'A crewed aircraft designed as the centre of a formation',
      'rather than as the whole of it.',
    ],
    annotations: [
      {
        n: '01',
        title: 'A family, not an aeroplane',
        body: 'The programme is described as a crewed fighter plus uncrewed aircraft that fly with it, plus the engines, sensors and network as separate but co-designed pieces. The jet is the part that is easiest to draw and probably the least novel.',
      },
      {
        n: '02',
        title: 'Range as the driving requirement',
        body: 'Operating across the Pacific makes distance the first constraint and manoeuvre a long way down the list. That argues for a large, clean, tailless aircraft with a great deal of internal fuel.',
      },
      {
        n: '03',
        title: 'Adaptive engines',
        body: 'An engine able to change its bypass ratio in flight can run efficiently when cruising and hot when pushed. It also gives the cooling capacity that the electrical load of a sixth-generation aircraft demands.',
      },
      {
        n: '04',
        title: 'Everything here is an interpretation',
        body: 'No official shape or figure has been released. Nothing in this model should be read as a disclosure, and no performance numbers are quoted because none are known.',
      },
    ],
  },
  palette: {
    skin: '#5d646b',
    skinLight: '#737a81',
    skinDark: '#444b52',
    skinShade: '#50575e',
    frame: '#242930',
    glass: '#b9a46a',
    cockpit: '#20252b',
    seat: '#30363c',
    hud: '#7cf0c4',
    metal: '#878d93',
    nozzle: '#585552',
    exhaust: '#6b3417',
    accent: '#2a3b78',
  },
  geometry: {
    bbox: { span: 16.2, height: 4.0 },
    fuselage: {
      length: 22.5,
      radomeTo: 0.05,
      noseTo: 0.22,
      stations: [
        { t: 0, w: 0.09, h: 0.07, y: 0.0, e: 2 },
        { t: 0.05, w: 0.5, h: 0.28, y: -0.02, e: 2.8, chine: 0.9, chineY: 0.38, chineTop: 0.22, chineBottom: 0.4 },
        { t: 0.14, w: 0.96, h: 0.46, y: -0.06, e: 3.4, chine: 1, chineY: 0.38, chineTop: 0.24, chineBottom: 0.42 },
        { t: 0.26, w: 1.32, h: 0.58, y: -0.1, e: 3.8, chine: 1, chineY: 0.4, chineTop: 0.32, chineBottom: 0.48 },
        // Very flat and very wide: a lifting body with a cockpit let into it.
        { t: 0.4, w: 1.6, h: 0.64, y: -0.14, e: 4.2, chine: 1, chineY: 0.42, chineTop: 0.42, chineBottom: 0.54 },
        { t: 0.56, w: 1.68, h: 0.64, y: -0.14, e: 4.4, chine: 1, chineY: 0.44, chineTop: 0.5, chineBottom: 0.6 },
        { t: 0.72, w: 1.6, h: 0.6, y: -0.14, e: 4.4, chine: 1, chineY: 0.45, chineTop: 0.6, chineBottom: 0.68 },
        { t: 0.88, w: 1.36, h: 0.54, y: -0.12, e: 4.2, chine: 0.8, chineY: 0.47, chineTop: 0.72, chineBottom: 0.78 },
        { t: 1, w: 1.14, h: 0.46, y: -0.1, e: 4, chine: 0.6 },
      ],
    },
    wing: {
      // Cranked arrow: a long, highly swept inboard panel for volume and a
      // less swept outer panel for the cruise, with no tail surfaces at all.
      kind: 'cranked-delta',
      span: 16.2,
      rootOffset: 1.66,
      rootChord: 14.4,
      tipChord: 1.2,
      sweep: 61,
      kink: { at: 0.62, chord: 4.2, sweep: 33 },
      dihedral: 0,
      thickness: 0.34,
      atZ: 6.6,
      atY: -0.16,
      tipThicknessRatio: 0.34,
    },
    intakes: [
      {
        // Dorsal: on an aircraft that expects to be looked at from below, the
        // inlets go on top where the body hides them.
        kind: 'dorsal',
        atZ: 6.2,
        length: 3.4,
        halfWidth: 0.6,
        height: 0.5,
        atY: 0.4,
        offsetX: 1.2,
        duct: true,
        sDuct: { toY: -0.06, toX: 0.9 },
      },
    ],
    nozzle: {
      kind: 'vectoring-2d',
      atZ: 22.4,
      radius: 0.52,
      atY: -0.14,
      separation: 0.96,
      length: 2.0,
      engineFromZ: 14.4,
      engineRadius: 0.52,
      serrations: 8,
    },
    canopy: {
      // Low and faired almost flush: there is no spine to blend into.
      fromZ: 3.4,
      toZ: 7.0,
      baseY: 0.3,
      topY: 1.0,
      halfWidth: 0.46,
      tier: 'hmd',
      seats: 1,
    },
    bays: [
      {
        fromZ: 8.4,
        toZ: 14.6,
        halfWidth: 1.1,
        atY: -0.28,
        depth: 0.46,
        doorOpen: 0,
      },
    ],
    markings: {
      radius: 0.95,
      wing: { x: 4.2, chord: 0.5 },
      fuselageZ: 15.0,
    },
  },
};
