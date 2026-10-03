import type { AircraftConfig } from '../types';

/**
 * Mikoyan MiG-29. The Su-27's smaller stablemate: same blended layout and
 * twin canted fins, with intakes that close on the ground against debris.
 */
export const MIG29: AircraftConfig = {
  id: 'mig-29',
  name: 'MiG-29 Fulcrum',
  designation: 'MiG-29',
  exhibitNo: '013',
  chapter: 4,
  spec: {
    firstFlight: 1977,
    machMax: 2.25,
    engines: { count: 2, type: 'afterburning-turbofan' },
    crew: 1,
    role: 'Multirole fighter',
    country: 'SU',
    generation: '4',
    lengthM: 17.37,
    spanM: 11.4,
    heightM: 4.73,
    status: 'in-service',
  },
  copy: {
    category: 'TWIN-ENGINE MULTIROLE FIGHTER',
    subtitle: [
      'Built to fly from rough strips, with intakes that shut',
      'themselves on the ground and breathe through the top instead.',
    ],
    annotations: [
      {
        n: '01',
        title: 'Doors over the inlets',
        body: 'On takeoff and landing the main intakes close and the engines draw through louvres on top of the wing roots. It lets the aircraft work from damaged or unpaved runways without swallowing debris.',
      },
      {
        n: '02',
        title: 'A helmet sight, early',
        body: 'Paired with a high off-boresight missile, the pilot could cue a shot by looking at the target. Western air forces took years to field an equivalent.',
      },
      {
        n: '03',
        title: 'Short legs',
        body: 'Internal fuel is modest, which was accepted for a fighter meant to defend its own airfield rather than range deep. It has constrained every export operator since.',
      },
    ],
  },
  palette: {
    skin: '#93a0ab',
    skinLight: '#aeb9c2',
    skinDark: '#687682',
    skinShade: '#7e8b96',
    frame: '#2d3238',
    glass: '#a6d6e8',
    cockpit: '#2b3036',
    seat: '#3a4046',
    hud: '#7cf0c4',
    metal: '#949aa0',
    nozzle: '#6c6864',
    exhaust: '#6b3417',
    accent: '#c21b17',
  },
  geometry: {
    bbox: { span: 11.6, height: 4.4 },
    fuselage: {
      length: 17.37,
      radomeTo: 0.08,
      noseTo: 0.28,
      stations: [
        { t: 0, w: 0.07, h: 0.07, y: 0.08, e: 2 },
        { t: 0.04, w: 0.3, h: 0.28, y: 0.08, e: 2 },
        { t: 0.12, w: 0.52, h: 0.46, y: 0.04, e: 2.1 },
        { t: 0.22, w: 0.66, h: 0.56, y: 0.0, e: 2.3 },
        { t: 0.34, w: 0.76, h: 0.6, y: -0.04, e: 2.7 },
        { t: 0.48, w: 0.8, h: 0.58, y: -0.08, e: 3.0 },
        { t: 0.62, w: 0.74, h: 0.54, y: -0.1, e: 3.0 },
        // Same narrowing as the Flanker, over a shorter tail: the nacelles
        // stand apart but the sting is stubby.
        { t: 0.74, w: 0.5, h: 0.44, y: -0.08, e: 2.7 },
        { t: 0.85, w: 0.3, h: 0.32, y: -0.06, e: 2.4 },
        { t: 1, w: 0.22, h: 0.24, y: -0.04, e: 2.2 },
      ],
      spine: { from: 6.2, to: 12.4, halfWidth: 0.42, height: 0.2 },
    },
    // Large relative to the airframe, which is what makes the MiG-29 read as
    // a compact Flanker rather than a smaller one.
    lerx: { fromZ: 2.9, toZ: 7.4, maxHalfWidth: 1.34, atY: 0.06, thickness: 0.3 },
    wing: {
      kind: 'cranked-delta',
      span: 11.4,
      rootOffset: 0.95,
      rootChord: 5.2,
      tipChord: 1.1,
      sweep: 42,
      dihedral: -2,
      thickness: 0.26,
      atZ: 7.4,
      atY: 0.0,
      tipThicknessRatio: 0.45,
    },
    tailH: {
      span: 7.8,
      rootOffset: 0.95,
      rootChord: 2.4,
      tipChord: 0.9,
      sweep: 48,
      dihedral: -2,
      thickness: 0.16,
      atZ: 13.2,
      atY: -0.06,
    },
    tailVTwin: {
      span: 2.5,
      rootChord: 3.4,
      tipChord: 1.3,
      sweep: 48,
      cant: 7,
      separation: 1.08,
      thickness: 0.2,
      atZ: 11.4,
      atY: 0.26,
    },
    fairings: [
      {
        at: [1.06, -0.3],
        fromZ: 5.8,
        toZ: 16.6,
        front: [0.44, 0.46],
        back: [0.47, 0.48],
        mirror: true,
        exponent: 2.4,
      },
    ],
    intakes: [
      {
        kind: 'side-rect',
        atZ: 5.8,
        length: 2.4,
        halfWidth: 0.34,
        height: 0.74,
        atY: -0.38,
        offsetX: 1.06,
        duct: true,
        splitter: 0.12,
        sDuct: { toY: -0.3, toX: 1.06 },
      },
    ],
    nozzle: {
      kind: 'twin-round',
      atZ: 16.5,
      radius: 0.47,
      atY: -0.3,
      separation: 1.06,
      length: 1.5,
      engineFromZ: 11.4,
      engineRadius: 0.42,
    },
    canopy: {
      fromZ: 3.3,
      toZ: 6.0,
      baseY: 0.48,
      topY: 1.26,
      halfWidth: 0.44,
      tier: 'mfd',
      seats: 1,
    },
    stores: [
      // Weapons-mode load, hidden until weapons mode: Missiles on three pylons under each wing, and a tank between the engine nacelles.
      // Generic shapes typical of the era; no particular types are claimed.
      { kind: 'missile', at: [2.6, -0.54, 0], chord: 0.45, length: 4, radius: 0.1, mirror: true, load: true, pylon: { height: 0.3, chord: 1.3 } },
      { kind: 'missile', at: [3.9, -0.52, 0], chord: 0.5, length: 2.9, radius: 0.085, mirror: true, load: true, pylon: { height: 0.25, chord: 1 } },
      { kind: 'missile', at: [4.9, -0.56, 0], chord: 0.5, length: 2.9, radius: 0.085, mirror: true, load: true, pylon: { height: 0.25, chord: 1 } },
      { kind: 'tank', at: [0, -0.98, 9.5], length: 3.6, radius: 0.33, fins: 0, load: true, pylon: { height: 0.15, chord: 1.6 } },
      { kind: 'rail', at: [5.56, 0.02, 0], chord: 0.5, length: 1.8, radius: 0.1, mirror: true },
    ],
    markings: {
      radius: 0.66,
      wing: { x: 2.8, chord: 0.4 },
      fuselageZ: 13.4,
    },
  },
};
