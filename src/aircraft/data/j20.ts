import type { AircraftConfig } from '../types';

/**
 * Chengdu J-20. A long, large stealth fighter with canards ahead of a delta
 * wing: a combination nobody else in the fifth generation chose.
 *
 * Published length figures vary by close to a metre between sources, and
 * China has released none. The figures here are a conservative reading of the
 * commonly quoted range, and the copy says so. Maximum speed is left out.
 */
export const J20: AircraftConfig = {
  id: 'j-20',
  name: 'J-20',
  designation: 'J-20',
  exhibitNo: '023',
  chapter: 6,
  spec: {
    firstFlight: 2011,
    engines: { count: 2, type: 'afterburning-turbofan' },
    crew: 1,
    role: 'Air superiority fighter',
    country: 'CN',
    generation: '5',
    lengthM: 20.4,
    spanM: 13.5,
    heightM: 4.7,
    status: 'in-service',
  },
  copy: {
    category: 'TWIN-ENGINE STEALTH AIR SUPERIORITY FIGHTER',
    subtitle: [
      'Long-ranged, canard-delta and deliberately large:',
      'a fighter sized for the distances it has to cover.',
    ],
    annotations: [
      {
        n: '01',
        title: 'Canards on a stealth aircraft',
        body: 'Foreplanes add moving edges in front of the radar cross-section every other fifth-generation design worked to keep clean. They were accepted for the lift and the pitch authority a long, heavy airframe needs, and their edges are aligned to the wing to limit the cost.',
      },
      {
        n: '02',
        title: 'Built around range',
        body: 'The length is mostly fuel and bay volume. An aircraft intended to operate a long way out over water is sized by how far it must go before it is useful, not by how tightly it turns.',
      },
      {
        n: '03',
        title: 'Figures that are not published',
        body: 'No official dimensions exist. Quoted lengths differ by close to a metre depending on who measured which photograph. The model here is drawn to the middle of that range and should be read as approximate.',
      },
    ],
  },
  palette: {
    skin: '#6a7076',
    skinLight: '#81878e',
    skinDark: '#4e545a',
    skinShade: '#5c6268',
    frame: '#2b3036',
    glass: '#b9a46a',
    cockpit: '#242930',
    seat: '#343a40',
    hud: '#7cf0c4',
    metal: '#8d9298',
    nozzle: '#625e5a',
    exhaust: '#6b3417',
    accent: '#de2910',
  },
  geometry: {
    bbox: { span: 13.8, height: 5.0 },
    fuselage: {
      length: 20.4,
      radomeTo: 0.05,
      noseTo: 0.24,
      stations: [
        { t: 0, w: 0.08, h: 0.07, y: 0.04, e: 2 },
        { t: 0.05, w: 0.42, h: 0.3, y: 0.02, e: 2.4, chine: 0.7, chineY: 0.42, chineTop: 0.3, chineBottom: 0.46 },
        { t: 0.13, w: 0.74, h: 0.5, y: 0.0, e: 3, chine: 1, chineY: 0.42, chineTop: 0.3, chineBottom: 0.46 },
        { t: 0.24, w: 0.96, h: 0.64, y: -0.04, e: 3.4, chine: 1, chineY: 0.44, chineTop: 0.36, chineBottom: 0.52 },
        { t: 0.38, w: 1.1, h: 0.7, y: -0.08, e: 3.6, chine: 0.9, chineY: 0.46, chineTop: 0.44, chineBottom: 0.58 },
        { t: 0.54, w: 1.16, h: 0.7, y: -0.08, e: 3.8, chine: 0.7, chineY: 0.47, chineTop: 0.5, chineBottom: 0.62 },
        { t: 0.7, w: 1.14, h: 0.68, y: -0.08, e: 3.8, chine: 0.5 },
        { t: 0.86, w: 1.04, h: 0.62, y: -0.06, e: 3.6, chine: 0.3 },
        { t: 1, w: 0.9, h: 0.54, y: -0.04, e: 3.4, chine: 0.1 },
      ],
      spine: { from: 6.6, to: 13.4, halfWidth: 0.36, height: 0.2 },
    },
    canard: {
      // Edges set on the wing's leading-edge angle, which is the only
      // concession the layout makes to its own foreplanes.
      span: 7.6,
      rootOffset: 1.1,
      rootChord: 2.2,
      tipChord: 0.7,
      sweep: 43,
      dihedral: -5,
      thickness: 0.2,
      atZ: 6.4,
      atY: 0.22,
      palette: 'skinDark',
    },
    wing: {
      kind: 'cranked-delta',
      span: 13.5,
      rootOffset: 1.16,
      rootChord: 7.6,
      tipChord: 1.2,
      sweep: 43,
      dihedral: 0,
      thickness: 0.3,
      atZ: 9.4,
      atY: -0.1,
      tipThicknessRatio: 0.4,
    },
    tailVTwin: {
      // All-moving fins, canted outward. No horizontal tail: the canards and
      // the delta do that job.
      span: 2.2,
      rootChord: 2.6,
      tipChord: 0.8,
      sweep: 38,
      cant: 26,
      separation: 1.4,
      thickness: 0.2,
      atZ: 16.0,
      atY: 0.22,
    },
    ventral: {
      span: 1.1,
      rootChord: 1.9,
      tipChord: 0.6,
      sweep: 44,
      cant: 24,
      separation: 1.1,
      thickness: 0.16,
      atZ: 17.4,
      atY: -0.44,
    },
    intakes: [
      {
        kind: 'dsi',
        atZ: 6.0,
        length: 2.8,
        halfWidth: 0.42,
        height: 0.88,
        atY: -0.14,
        offsetX: 1.16,
        duct: true,
        sDuct: { toY: -0.06, toX: 0.6 },
      },
    ],
    nozzle: {
      kind: 'twin-round',
      atZ: 20.3,
      radius: 0.46,
      atY: -0.08,
      separation: 0.74,
      length: 1.7,
      engineFromZ: 13.4,
      engineRadius: 0.44,
      serrations: 10,
    },
    canopy: {
      fromZ: 3.2,
      toZ: 6.6,
      baseY: 0.46,
      topY: 1.32,
      halfWidth: 0.44,
      tier: 'glass',
      seats: 1,
    },
    bays: [
      {
        fromZ: 9.0,
        toZ: 13.4,
        halfWidth: 0.82,
        atY: -0.28,
        depth: 0.46,
        doorOpen: 0,
      },
    ],
    markings: {
      style: 'star',
      radius: 0.8,
      wing: { x: 3.6, chord: 0.44 },
      fuselageZ: 15.4,
    },
  },
};
