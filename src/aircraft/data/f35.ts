import type { AircraftConfig } from '../types';

/**
 * Lockheed Martin F-35A Lightning II. The same shaping language as the F-22 on
 * a single engine, in a body made deliberately deep so three very different
 * versions could be cut from one design.
 */
export const F35: AircraftConfig = {
  id: 'f-35',
  name: 'F-35 Lightning II',
  designation: 'F-35A',
  exhibitNo: '021',
  chapter: 6,
  spec: {
    firstFlight: 2006,
    machMax: 1.6,
    engines: { count: 1, type: 'afterburning-turbofan' },
    crew: 1,
    role: 'Multirole stealth fighter',
    country: 'US',
    generation: '5',
    lengthM: 15.7,
    spanM: 10.7,
    heightM: 4.38,
    status: 'in-service',
  },
  copy: {
    category: 'SINGLE-ENGINE STEALTH MULTIROLE FIGHTER',
    subtitle: [
      'One airframe asked to be three aircraft at once,',
      'and a sensor system that happens to have a jet around it.',
    ],
    annotations: [
      {
        n: '01',
        title: 'Deep because of a version it is not',
        body: 'The A model carries no lift fan, but the fuselage is sized for the B model that does. The whole family reads as stout because one member had to swallow a vertical-lift system behind the cockpit.',
      },
      {
        n: '02',
        title: 'No splitter plate',
        body: 'A diverterless inlet uses a shaped bump and a forward-swept lip to push the sluggish boundary-layer air aside. It removes a moving part, removes a sharp corner, and removes a reflector.',
      },
      {
        n: '03',
        title: 'Fusion first, airframe second',
        body: 'Radar, infra-red, electronic surveillance and the data link are merged into one picture before the pilot sees anything, and shared with every other aircraft in the formation. Most of what this aircraft is for is not visible from outside.',
      },
    ],
  },
  palette: {
    skin: '#767c82',
    skinLight: '#8d939a',
    skinDark: '#585e65',
    skinShade: '#676d74',
    frame: '#2b3036',
    glass: '#b9a46a',
    cockpit: '#242930',
    seat: '#343a40',
    hud: '#7cf0c4',
    metal: '#8d9298',
    nozzle: '#5f5b58',
    exhaust: '#6b3417',
    accent: '#2a3b78',
  },
  geometry: {
    bbox: { span: 11.0, height: 4.8 },
    // Deep, boxy and fully chined: the planform rule puts this one over
    // the voxel budget, so the resolution is set directly.
    targetLengthVoxels: 118,
    fuselage: {
      length: 15.7,
      radomeTo: 0.07,
      noseTo: 0.28,
      stations: [
        { t: 0, w: 0.08, h: 0.08, y: 0.04, e: 2 },
        { t: 0.05, w: 0.4, h: 0.3, y: 0.02, e: 2.4, chine: 0.6, chineY: 0.44, chineTop: 0.34, chineBottom: 0.5 },
        { t: 0.14, w: 0.72, h: 0.54, y: 0.0, e: 3, chine: 1, chineY: 0.44, chineTop: 0.34, chineBottom: 0.5 },
        { t: 0.26, w: 0.92, h: 0.72, y: -0.04, e: 3.2, chine: 1, chineY: 0.46, chineTop: 0.4, chineBottom: 0.56 },
        // Deepest around the point where the B model carries its lift fan.
        { t: 0.4, w: 1.04, h: 0.84, y: -0.06, e: 3.4, chine: 1, chineY: 0.48, chineTop: 0.46, chineBottom: 0.6 },
        { t: 0.56, w: 1.06, h: 0.82, y: -0.06, e: 3.4, chine: 0.9, chineY: 0.48, chineTop: 0.52, chineBottom: 0.64 },
        { t: 0.72, w: 0.98, h: 0.74, y: -0.05, e: 3.2, chine: 0.6, chineY: 0.5, chineTop: 0.6, chineBottom: 0.7 },
        { t: 0.88, w: 0.82, h: 0.64, y: -0.04, e: 3, chine: 0.3, chineY: 0.5, chineTop: 0.7, chineBottom: 0.78 },
        { t: 1, w: 0.68, h: 0.58, y: -0.02, e: 2.8, chine: 0.1 },
      ],
    },
    wing: {
      kind: 'trapezoid',
      span: 10.7,
      rootOffset: 1.0,
      rootChord: 5.6,
      tipChord: 1.25,
      sweep: 34,
      dihedral: 0,
      thickness: 0.3,
      atZ: 5.9,
      atY: -0.06,
      tipThicknessRatio: 0.42,
    },
    tailH: {
      span: 6.9,
      rootOffset: 1.2,
      rootChord: 3.0,
      tipChord: 0.75,
      sweep: 34,
      dihedral: 0,
      thickness: 0.18,
      atZ: 11.6,
      atY: -0.08,
    },
    tailVTwin: {
      span: 2.3,
      rootChord: 2.9,
      tipChord: 0.9,
      sweep: 26,
      cant: 25,
      separation: 1.1,
      thickness: 0.28,
      atZ: 10.3,
      atY: 0.3,
    },
    intakes: [
      {
        kind: 'dsi',
        atZ: 4.3,
        length: 2.2,
        halfWidth: 0.36,
        height: 0.82,
        atY: -0.1,
        offsetX: 1.0,
        duct: true,
        sDuct: { toY: -0.06, toX: 0 },
      },
    ],
    nozzle: {
      // Round, but with sawtooth petals rather than a plain lip.
      kind: 'round',
      atZ: 15.7,
      radius: 0.62,
      atY: -0.04,
      length: 1.7,
      engineFromZ: 9.2,
      engineRadius: 0.58,
      serrations: 12,
    },
    canopy: {
      fromZ: 2.7,
      toZ: 5.3,
      baseY: 0.56,
      topY: 1.4,
      halfWidth: 0.44,
      tier: 'hmd',
      seats: 1,
    },
    bays: [
      {
        fromZ: 5.6,
        toZ: 9.4,
        halfWidth: 0.78,
        atY: -0.32,
        depth: 0.52,
        doorOpen: 0,
      },
    ],
    blocks: [
      {
        // Faceted electro-optical sensor window under the nose.
        shape: 'box',
        at: [0, -0.3, 2.3],
        size: [0.46, 0.3, 0.96],
        part: 'nose',
        palette: 'frame',
      },
    ],
    markings: {
      radius: 0.68,
      wing: { x: 2.7, chord: 0.42 },
      fuselageZ: 11.0,
    },
  },
};
