import type { AircraftConfig } from '../types';

/**
 * Dassault Mirage III. Tailless delta with half-cone side inlets -- the shape
 * Dassault then reused, with variations, for three decades.
 */
export const MIRAGE3: AircraftConfig = {
  id: 'mirage-3',
  name: 'Mirage III',
  designation: 'Mirage III',
  exhibitNo: '006',
  chapter: 2,
  spec: {
    firstFlight: 1956,
    machMax: 2.2,
    engines: { count: 1, type: 'afterburning-turbojet' },
    crew: 1,
    role: 'Interceptor and attack',
    country: 'FR',
    generation: '2',
    lengthM: 15.03,
    spanM: 8.22,
    heightM: 4.5,
    status: 'historic',
  },
  copy: {
    category: 'SINGLE-ENGINE TAILLESS DELTA',
    subtitle: [
      'No tailplane at all: the delta does lift and control',
      'together, and accepts a long takeoff run as the price.',
    ],
    annotations: [
      {
        n: '01',
        title: 'Nothing behind the wing',
        body: 'Elevons on the delta trailing edge handle pitch and roll together. It saves weight and drag, but pitching up also dumps lift, so approach speeds stay high.',
      },
      {
        n: '02',
        title: 'Half cones at the hips',
        body: 'Each inlet carries a half-cone shock body that translates with speed. The splitter plate behind it keeps the sluggish boundary-layer air off the fuselage and out of the engine.',
      },
      {
        n: '03',
        title: 'A shape reused',
        body: 'The delta planform carried forward into the Mirage 5, the Mirage 2000 and, with canards added, into the Rafale. Few airframes have had a longer afterlife.',
      },
    ],
  },
  palette: {
    skin: '#b1b8bf',
    skinLight: '#ccd2d7',
    skinDark: '#858c94',
    skinShade: '#9aa1a8',
    frame: '#2f343a',
    glass: '#a6d6e8',
    cockpit: '#2b3036',
    seat: '#3a4046',
    hud: '#ffd36b',
    metal: '#99a0a6',
    nozzle: '#6c6864',
    exhaust: '#6b3417',
    accent: '#002395',
  },
  geometry: {
    // The broad delta puts this one over the voxel budget under the planform
    // rule, so the resolution is set directly.
    targetLengthVoxels: 130,
    bbox: { span: 8.4, height: 3.8 },
    fuselage: {
      length: 15.03,
      radomeTo: 0.06,
      noseTo: 0.26,
      stations: [
        { t: 0, w: 0.06, h: 0.06, y: 0.06, e: 2 },
        { t: 0.04, w: 0.24, h: 0.24, y: 0.05, e: 2 },
        { t: 0.12, w: 0.44, h: 0.44, y: 0.02, e: 2 },
        { t: 0.24, w: 0.58, h: 0.58, y: -0.02, e: 2.1 },
        { t: 0.4, w: 0.68, h: 0.68, y: -0.04, e: 2.2 },
        { t: 0.56, w: 0.7, h: 0.72, y: -0.04, e: 2.2 },
        { t: 0.72, w: 0.66, h: 0.7, y: -0.02, e: 2.2 },
        { t: 0.88, w: 0.58, h: 0.62, y: 0.0, e: 2.1 },
        { t: 1, w: 0.5, h: 0.54, y: 0.02, e: 2 },
      ],
    },
    wing: {
      kind: 'delta',
      span: 8.22,
      rootOffset: 0.62,
      rootChord: 7.8,
      tipChord: 0.4,
      sweep: 60.5,
      dihedral: 0,
      thickness: 0.3,
      atZ: 5.5,
      atY: -0.2,
      tipThicknessRatio: 0.4,
    },
    tailV: {
      span: 2.2,
      rootChord: 4.2,
      tipChord: 1.4,
      sweep: 58,
      thickness: 0.24,
      atZ: 9.7,
      atY: 0.5,
    },
    intakes: [
      {
        kind: 'side-half-cone',
        atZ: 4.9,
        length: 2.2,
        halfWidth: 0.36,
        height: 0.88,
        atY: -0.04,
        offsetX: 0.86,
        duct: true,
        splitter: 0.12,
        shockCone: { length: 1.6, radius: 0.28 },
        sDuct: { toY: -0.04, toX: 0 },
      },
    ],
    nozzle: {
      kind: 'round',
      atZ: 14.95,
      radius: 0.5,
      atY: 0.02,
      length: 1.5,
      engineFromZ: 9.4,
      engineRadius: 0.48,
    },
    canopy: {
      fromZ: 3.1,
      toZ: 5.3,
      baseY: 0.52,
      topY: 1.2,
      halfWidth: 0.42,
      tier: 'analog',
      framed: true,
      seats: 1,
    },
    blocks: [
      {
        shape: 'box',
        at: [0, 0.06, -0.3],
        size: [0.06, 0.06, 0.7],
        part: 'probe',
        palette: 'frame',
      },
    ],
    stores: [
      // Weapons-mode load, hidden until weapons mode: Two underwing tanks and a centreline missile.
      // Generic shapes typical of the era; no particular types are claimed.
      { kind: 'tank', at: [2, -0.74, 0], chord: 0.42, length: 3.4, radius: 0.27, fins: 0, mirror: true, load: true, pylon: { height: 0.3, chord: 1.4 } },
      { kind: 'missile', at: [0, -1.01, 8.6], length: 3.2, radius: 0.13, mirror: false, load: true, pylon: { height: 0.2, chord: 1.4 } },
    ],
    markings: {
      radius: 0.72,
      wing: { x: 2.2, chord: 0.3 },
      fuselageZ: 4.2,
    },
  },
};
