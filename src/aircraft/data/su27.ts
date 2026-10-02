import type { AircraftConfig } from '../types';

/**
 * Sukhoi Su-27. A blended body where wing and fuselage are one surface, with
 * the engines carried in widely spaced nacelles and a tunnel between them.
 */
export const SU27: AircraftConfig = {
  id: 'su-27',
  name: 'Su-27 Flanker',
  designation: 'Su-27',
  exhibitNo: '012',
  chapter: 4,
  spec: {
    firstFlight: 1977,
    machMax: 2.35,
    engines: { count: 2, type: 'afterburning-turbofan' },
    crew: 1,
    role: 'Air superiority fighter',
    country: 'SU',
    generation: '4',
    lengthM: 21.9,
    spanM: 14.7,
    heightM: 5.92,
    status: 'in-service',
  },
  copy: {
    category: 'TWIN-ENGINE AIR SUPERIORITY FIGHTER',
    subtitle: [
      'Wing and fuselage blended into one lifting surface, with',
      'the engines moved out to leave the middle free.',
    ],
    annotations: [
      {
        n: '01',
        title: 'The body lifts',
        body: 'There is no clear line where the fuselage stops and the wing starts. The centre section carries lift of its own, which is how an aircraft this large stays agile.',
      },
      {
        n: '02',
        title: 'Engines set apart',
        body: 'Two nacelles slung well outboard leave a tunnel down the middle. It makes room for fuel and weapons, and it keeps each intake in clean air.',
      },
      {
        n: '03',
        title: 'Leading-edge extensions',
        body: 'The long forward root extensions shed vortices that stay attached far past the normal stall, keeping the wing flying at angles where a conventional one has given up.',
      },
    ],
  },
  palette: {
    skin: '#8d99a6',
    skinLight: '#a8b3be',
    skinDark: '#626e7a',
    skinShade: '#78838f',
    frame: '#2d3238',
    glass: '#a6d6e8',
    cockpit: '#2b3036',
    seat: '#3a4046',
    hud: '#7cf0c4',
    metal: '#949aa0',
    nozzle: '#6c6864',
    exhaust: '#6b3417',
    store: '#6f7a84',
    pylon: '#59636c',
    accent: '#c21b17',
  },
  geometry: {
    bbox: { span: 15.0, height: 5.4 },
    fuselage: {
      length: 21.9,
      radomeTo: 0.09,
      noseTo: 0.28,
      stations: [
        { t: 0, w: 0.08, h: 0.08, y: 0.08, e: 2 },
        { t: 0.04, w: 0.36, h: 0.32, y: 0.08, e: 2 },
        { t: 0.12, w: 0.66, h: 0.54, y: 0.04, e: 2.1 },
        { t: 0.22, w: 0.84, h: 0.64, y: 0.0, e: 2.3 },
        { t: 0.34, w: 0.94, h: 0.68, y: -0.06, e: 2.8 },
        { t: 0.48, w: 0.98, h: 0.64, y: -0.12, e: 3.2 },
        { t: 0.62, w: 0.9, h: 0.58, y: -0.14, e: 3.2 },
        // Aft of the wing the centre body narrows hard, leaving the nacelles
        // standing apart with a tunnel between them and a long tail sting
        // running back past the nozzles. That gap is the Flanker's signature
        // in plan view.
        { t: 0.73, w: 0.6, h: 0.48, y: -0.12, e: 2.8 },
        { t: 0.82, w: 0.34, h: 0.36, y: -0.08, e: 2.4 },
        { t: 0.92, w: 0.27, h: 0.3, y: -0.06, e: 2.3 },
        { t: 1, w: 0.22, h: 0.25, y: -0.04, e: 2.2 },
      ],
      spine: { from: 7.6, to: 15.4, halfWidth: 0.5, height: 0.22 },
    },
    // Long ogival root extension, from beside the cockpit into the wing
    // leading edge.
    lerx: { fromZ: 3.8, toZ: 9.4, maxHalfWidth: 1.6, atY: 0.04, thickness: 0.36 },
    wing: {
      kind: 'cranked-delta',
      span: 14.7,
      rootOffset: 1.1,
      rootChord: 6.6,
      tipChord: 1.2,
      sweep: 42,
      dihedral: 0,
      thickness: 0.3,
      atZ: 9.4,
      atY: -0.04,
      tipThicknessRatio: 0.45,
    },
    tailH: {
      span: 9.8,
      rootOffset: 1.2,
      rootChord: 3.0,
      tipChord: 1.0,
      sweep: 48,
      dihedral: 0,
      thickness: 0.18,
      atZ: 16.6,
      atY: -0.1,
    },
    tailVTwin: {
      span: 3.0,
      rootChord: 4.2,
      tipChord: 1.5,
      sweep: 48,
      cant: 4,
      separation: 1.34,
      thickness: 0.22,
      atZ: 14.4,
      atY: 0.3,
    },
    ventral: {
      span: 0.8,
      rootChord: 2.0,
      tipChord: 0.9,
      sweep: 48,
      separation: 1.3,
      cant: 10,
      thickness: 0.14,
      atZ: 17.0,
      atY: -0.6,
      palette: 'skinDark',
    },
    fairings: [
      {
        // Engine nacelle, slung well outboard. With the centre body narrowed
        // aft, the pair stand clear of it and of each other.
        at: [1.32, -0.34],
        fromZ: 7.4,
        toZ: 20.8,
        front: [0.52, 0.52],
        back: [0.56, 0.56],
        mirror: true,
        exponent: 2.4,
      },
    ],
    intakes: [
      {
        kind: 'side-rect',
        atZ: 7.4,
        length: 2.8,
        halfWidth: 0.42,
        height: 0.88,
        atY: -0.42,
        offsetX: 1.32,
        duct: true,
        splitter: 0.12,
        sDuct: { toY: -0.34, toX: 1.32 },
      },
    ],
    nozzle: {
      kind: 'twin-round',
      atZ: 20.7,
      radius: 0.56,
      atY: -0.34,
      separation: 1.32,
      length: 1.8,
      engineFromZ: 14.0,
      engineRadius: 0.5,
    },
    canopy: {
      fromZ: 3.9,
      toZ: 7.0,
      baseY: 0.52,
      topY: 1.44,
      halfWidth: 0.48,
      tier: 'mfd',
      seats: 1,
    },
    stores: [
      { kind: 'rail', at: [7.16, 0.02, 0], chord: 0.5, length: 2.3, radius: 0.11, mirror: true },
    ],
    markings: {
      radius: 0.78,
      wing: { x: 3.6, chord: 0.4 },
      fuselageZ: 16.8,
    },
  },
};
