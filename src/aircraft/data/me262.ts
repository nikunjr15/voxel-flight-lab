import type { AircraftConfig } from '../types';

/**
 * Messerschmitt Me 262 A-1a. Triangular fuselage section, mildly swept wing
 * and two engines slung in pods under it -- the first jet fighter to reach
 * operational service.
 */
export const ME262: AircraftConfig = {
  id: 'me-262',
  name: 'Me 262 Schwalbe',
  designation: 'Me 262',
  exhibitNo: '001',
  chapter: 1,
  spec: {
    firstFlight: 1942,
    topSpeedKmh: 870,
    engines: { count: 2, type: 'turbojet' },
    crew: 1,
    role: 'Fighter and fighter-bomber',
    country: 'DE',
    generation: '1',
    lengthM: 10.6,
    spanM: 12.6,
    heightM: 3.5,
    status: 'historic',
  },
  copy: {
    category: 'TWIN-ENGINE JET FIGHTER',
    subtitle: [
      'The first jet fighter to fly in anger, built around two',
      'engines too unreliable to let it change the war.',
    ],
    annotations: [
      {
        n: '01',
        title: 'Why the wing is swept',
        body: 'The eighteen degrees of sweep were not for speed. The engines came out heavier than planned, and angling the wing back moved lift aft to catch up with the centre of gravity.',
      },
      {
        n: '02',
        title: 'Engines in pods',
        body: 'Hanging the engines under the wing kept them clear of the fuselage and made them easy to change, which mattered: the Jumo 004 ran for about ten hours before it needed replacing.',
      },
      {
        n: '03',
        title: 'Triangular section',
        body: 'The fuselage tapers to a keel rather than a rounded belly. It gave room for fuel tanks above and below the pilot and kept the frontal area down.',
      },
    ],
  },
  palette: {
    skin: '#78806f',
    skinLight: '#949b8b',
    skinDark: '#4e564c',
    skinShade: '#636b5c',
    frame: '#2c302b',
    glass: '#a9cedd',
    cockpit: '#2b2f2a',
    seat: '#3a3f37',
    hud: '#ffd36b',
    metal: '#8d9198',
    nozzle: '#5f5b57',
    exhaust: '#6b3417',
    accent: '#c8102e',
  },
  geometry: {
    bbox: { span: 12.8, height: 3.5 },
    fuselage: {
      length: 10.6,
      radomeTo: 0.05,
      noseTo: 0.26,
      stations: [
        { t: 0, w: 0.08, h: 0.1, y: 0.06, e: 2.2, tri: 0.2 },
        { t: 0.05, w: 0.3, h: 0.38, y: 0.04, e: 2.3, tri: 0.35 },
        { t: 0.14, w: 0.42, h: 0.58, y: 0.0, e: 2.4, tri: 0.5 },
        { t: 0.26, w: 0.48, h: 0.68, y: -0.02, e: 2.5, tri: 0.58 },
        { t: 0.42, w: 0.5, h: 0.72, y: -0.02, e: 2.5, tri: 0.6 },
        { t: 0.58, w: 0.47, h: 0.68, y: 0.0, e: 2.5, tri: 0.55 },
        { t: 0.75, w: 0.38, h: 0.56, y: 0.04, e: 2.4, tri: 0.45 },
        { t: 0.9, w: 0.27, h: 0.4, y: 0.1, e: 2.3, tri: 0.3 },
        { t: 1, w: 0.16, h: 0.26, y: 0.14, e: 2.2, tri: 0.2 },
      ],
    },
    wing: {
      kind: 'swept',
      span: 12.6,
      // The triangular section is only about 0.32 m half-wide at wing height,
      // so a wider root inset leaves a visible seam at the join.
      rootOffset: 0.26,
      rootChord: 3.1,
      tipChord: 1.15,
      sweep: 18.5,
      dihedral: 2,
      thickness: 0.3,
      atZ: 3.85,
      atY: -0.18,
      roundTip: true,
      tipThicknessRatio: 0.55,
    },
    tailH: {
      span: 3.8,
      rootOffset: 0.22,
      rootChord: 1.35,
      tipChord: 0.6,
      sweep: 12,
      dihedral: 2,
      thickness: 0.14,
      atZ: 8.9,
      atY: 0.3,
    },
    tailV: {
      span: 1.55,
      rootChord: 2.3,
      tipChord: 0.9,
      sweep: 34,
      thickness: 0.2,
      atZ: 7.9,
      atY: 0.42,
      roundTip: true,
    },
    intakes: [],
    nacelles: [
      {
        // Slung clear under the wing and well ahead of the local leading
        // edge, which on the real aircraft is about 1.8 m of pod in front.
        at: [2.15, -0.78, 4.55],
        length: 4.0,
        radius: 0.45,
        mirror: true,
        pylon: 0.2,
        exhaustRadius: 0.31,
      },
    ],
    canopy: {
      fromZ: 2.45,
      toZ: 4.15,
      baseY: 0.5,
      topY: 1.02,
      halfWidth: 0.38,
      tier: 'analog',
      framed: true,
      seats: 1,
    },
    blocks: [
      {
        shape: 'box',
        at: [0, -0.15, 0.55],
        size: [0.5, 0.22, 1.1],
        part: 'nose',
        palette: 'skinDark',
      },
    ],
    markings: {
      radius: 0.8,
      wing: { x: 3.4, chord: 0.45 },
      fuselageZ: 7.1,
    },
  },
};
