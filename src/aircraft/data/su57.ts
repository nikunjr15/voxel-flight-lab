import type { AircraftConfig } from '../types';

/**
 * Sukhoi Su-57. A Flanker argument carried forward: the same wide, flat body
 * with the engines held far apart and a tunnel between them, now with faceted
 * shaping over the forward fuselage and movable surfaces let into the root
 * extensions.
 *
 * Dimensions are the commonly published approximations; Russia has not issued
 * an official set. Maximum speed is left out for the same reason.
 */
export const SU57: AircraftConfig = {
  id: 'su-57',
  name: 'Su-57',
  designation: 'Su-57',
  exhibitNo: '022',
  chapter: 6,
  spec: {
    firstFlight: 2010,
    engines: { count: 2, type: 'afterburning-turbofan' },
    crew: 1,
    role: 'Multirole stealth fighter',
    country: 'RU',
    generation: '5',
    lengthM: 20.1,
    spanM: 14.1,
    heightM: 4.6,
    status: 'in-service',
  },
  copy: {
    category: 'TWIN-ENGINE STEALTH MULTIROLE FIGHTER',
    subtitle: [
      'A Flanker reshaped for radar rather than redrawn from nothing,',
      'and still built around manoeuvre first.',
    ],
    annotations: [
      {
        n: '01',
        title: 'Movable root extensions',
        body: 'The leading edge of each root extension is a hinged surface. Deflected, it changes the strength of the vortex running back over the wing, which is pitch control from a part of the aircraft that is not a tailplane.',
      },
      {
        n: '02',
        title: 'Engines held apart',
        body: 'The nacelles sit wide, with a tunnel of lifting body between them, exactly as on the Su-27. It leaves room for weapons bays on the centreline and keeps the two engines from being one target.',
      },
      {
        n: '03',
        title: 'A different balance of priorities',
        body: 'Round nozzles and visible structure put less weight on low observability than the American designs do, and more on sustained agility and sensor reach. It is a deliberate position, not an incomplete copy.',
      },
    ],
  },
  palette: {
    skin: '#7a828a',
    skinLight: '#919aa2',
    skinDark: '#5c646c',
    skinShade: '#6b737b',
    frame: '#2b3036',
    glass: '#b9a46a',
    cockpit: '#242930',
    seat: '#343a40',
    hud: '#7cf0c4',
    metal: '#8d9298',
    nozzle: '#625e5a',
    exhaust: '#6b3417',
    accent: '#1b3a8c',
  },
  geometry: {
    bbox: { span: 14.4, height: 5.0 },
    fuselage: {
      length: 20.1,
      radomeTo: 0.06,
      noseTo: 0.26,
      stations: [
        { t: 0, w: 0.08, h: 0.07, y: 0.02, e: 2 },
        { t: 0.05, w: 0.44, h: 0.26, y: 0.0, e: 2.6, chine: 0.8, chineY: 0.42, chineTop: 0.26, chineBottom: 0.42 },
        { t: 0.14, w: 0.84, h: 0.44, y: -0.04, e: 3, chine: 1, chineY: 0.42, chineTop: 0.28, chineBottom: 0.46 },
        { t: 0.26, w: 1.1, h: 0.56, y: -0.08, e: 3.4, chine: 0.9, chineY: 0.44, chineTop: 0.36, chineBottom: 0.54 },
        // Wide and shallow through the middle: the body is part of the wing.
        { t: 0.4, w: 1.34, h: 0.6, y: -0.12, e: 3.8, chine: 0.6, chineY: 0.46, chineTop: 0.48, chineBottom: 0.62 },
        { t: 0.56, w: 1.4, h: 0.58, y: -0.14, e: 4, chine: 0.35 },
        { t: 0.72, w: 1.3, h: 0.54, y: -0.14, e: 4, chine: 0.2 },
        { t: 0.88, w: 0.9, h: 0.44, y: -0.12, e: 3.4 },
        // Tail stinger between the nozzles, as on the Su-27.
        { t: 1, w: 0.44, h: 0.34, y: -0.1, e: 2.8 },
      ],
      spine: { from: 6.4, to: 12.6, halfWidth: 0.4, height: 0.22 },
    },
    lerx: {
      fromZ: 4.6,
      toZ: 8.0,
      maxHalfWidth: 1.7,
      atY: -0.06,
      thickness: 0.26,
    },
    levcon: {
      // Hinged leading edge of the root extension. Short, very low aspect and
      // set at body height, so it reads as part of the wing rather than as a
      // foreplane.
      span: 4.6,
      rootOffset: 1.0,
      rootChord: 1.5,
      tipChord: 0.7,
      sweep: 52,
      dihedral: 0,
      thickness: 0.18,
      atZ: 4.5,
      atY: -0.02,
      palette: 'skinDark',
    },
    wing: {
      kind: 'trapezoid',
      span: 14.1,
      rootOffset: 1.5,
      rootChord: 7.4,
      tipChord: 1.3,
      sweep: 48,
      dihedral: 0,
      thickness: 0.32,
      atZ: 7.6,
      atY: -0.08,
      tipThicknessRatio: 0.4,
    },
    tailH: {
      // All-moving, on the same leading-edge angle as the wing.
      span: 10.2,
      rootOffset: 2.1,
      rootChord: 3.2,
      tipChord: 0.8,
      sweep: 48,
      dihedral: 0,
      thickness: 0.2,
      atZ: 14.4,
      atY: -0.1,
    },
    tailVTwin: {
      // All-moving fins, canted well out.
      span: 2.3,
      rootChord: 2.6,
      tipChord: 0.9,
      sweep: 36,
      cant: 26,
      separation: 1.9,
      thickness: 0.2,
      atZ: 13.0,
      atY: 0.2,
    },
    ventral: {
      span: 1.0,
      rootChord: 1.8,
      tipChord: 0.7,
      sweep: 40,
      cant: 20,
      separation: 1.9,
      thickness: 0.16,
      atZ: 15.4,
      atY: -0.4,
    },
    fairings: [
      {
        // Nacelle trunk. Held wide so the tunnel between the two is visible
        // from below, which is a large part of how a Flanker family reads.
        at: [1.5, -0.14],
        fromZ: 5.6,
        toZ: 19.8,
        front: [0.6, 0.5],
        back: [0.56, 0.48],
        mirror: true,
        exponent: 3.2,
      },
    ],
    intakes: [
      {
        kind: 'caret',
        atZ: 5.6,
        length: 2.8,
        halfWidth: 0.52,
        height: 0.78,
        atY: -0.24,
        offsetX: 1.5,
        duct: true,
        sDuct: { toY: -0.14, toX: 1.4 },
      },
    ],
    nozzle: {
      kind: 'twin-round',
      atZ: 20.0,
      radius: 0.5,
      atY: -0.12,
      separation: 1.5,
      length: 1.8,
      engineFromZ: 13.0,
      engineRadius: 0.48,
      serrations: 10,
      vector: 14,
    },
    canopy: {
      fromZ: 3.4,
      toZ: 6.9,
      baseY: 0.34,
      topY: 1.22,
      halfWidth: 0.46,
      tier: 'hmd',
      seats: 1,
    },
    bays: [
      {
        fromZ: 7.8,
        toZ: 12.6,
        halfWidth: 0.9,
        atY: -0.24,
        depth: 0.44,
        doorOpen: 0,
      },
    ],
    blocks: [
      {
        shape: 'box',
        at: [0, 0.12, 2.9],
        size: [0.46, 0.16, 0.8],
        part: 'nose',
        palette: 'skinDark',
      },
    ],
    markings: {
      radius: 0.86,
      wing: { x: 3.9, chord: 0.42 },
      fuselageZ: 14.6,
    },
  },
};
