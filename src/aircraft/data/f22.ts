import type { AircraftConfig } from '../types';

/**
 * Lockheed Martin F-22A Raptor. The first aircraft in the roster shaped for
 * radar before anything else: flat planes, hard chine lines, and every
 * planform edge set parallel to one of two angles so reflections go to the
 * same few places instead of everywhere.
 *
 * Maximum speed is left out. The published figure is "Mach 2 class", which is
 * a classification rather than a number.
 */
export const F22: AircraftConfig = {
  id: 'f-22',
  name: 'F-22 Raptor',
  designation: 'F-22A',
  exhibitNo: '020',
  chapter: 6,
  spec: {
    firstFlight: 1997,
    engines: { count: 2, type: 'afterburning-turbofan' },
    crew: 1,
    role: 'Air superiority fighter',
    country: 'US',
    generation: '5',
    lengthM: 18.92,
    spanM: 13.56,
    heightM: 5.08,
    status: 'in-service',
  },
  copy: {
    category: 'TWIN-ENGINE STEALTH AIR SUPERIORITY FIGHTER',
    subtitle: [
      'Shaped so radar energy leaves in a few known directions,',
      'then given the thrust to outfly whatever still finds it.',
    ],
    annotations: [
      {
        n: '01',
        title: 'Every edge on one of two angles',
        body: 'Wing leading edge, tailplane leading edge, intake lip and bay doors are all set to the same sweep, and the trailing edges to another. Reflections collect into a few sharp spikes that an aircraft can be flown around, instead of spreading evenly in all directions.',
      },
      {
        n: '02',
        title: 'Nothing hangs outside',
        body: 'Missiles live in a belly bay and two cheek bays. Carrying them internally costs volume and weight, and it is the only way to keep the shaping the airframe was designed around.',
      },
      {
        n: '03',
        title: 'Supercruise',
        body: 'Sustained supersonic flight without afterburner. It is a fuel and heat argument as much as a speed one: an aircraft that does not need reheat to go fast stays quiet in the infrared and keeps its range.',
      },
      {
        n: '04',
        title: 'Flat nozzles that vector',
        body: 'Two-dimensional nozzles pitch up and down and spread the exhaust into a flat sheet. The sheet cools faster than a round plume, and the deflection gives pitch authority the tailplanes alone would not have.',
      },
    ],
  },
  palette: {
    skin: '#6f757b',
    skinLight: '#878d93',
    skinDark: '#52585e',
    skinShade: '#61676d',
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
    bbox: { span: 13.8, height: 5.4 },
    fuselage: {
      length: 18.92,
      radomeTo: 0.06,
      noseTo: 0.26,
      stations: [
        { t: 0, w: 0.08, h: 0.07, y: 0.06, e: 2 },
        // The chine starts almost at the radome and runs most of the length.
        // It is faired out again over the tail so the boom does not step.
        { t: 0.05, w: 0.42, h: 0.26, y: 0.04, e: 2.4, chine: 0.7, chineY: 0.4, chineTop: 0.3, chineBottom: 0.45 },
        { t: 0.14, w: 0.78, h: 0.46, y: 0.0, e: 3, chine: 1, chineY: 0.4, chineTop: 0.3, chineBottom: 0.45 },
        { t: 0.26, w: 0.98, h: 0.62, y: -0.04, e: 3.4, chine: 1, chineY: 0.42, chineTop: 0.34, chineBottom: 0.5 },
        { t: 0.4, w: 1.12, h: 0.72, y: -0.06, e: 3.6, chine: 1, chineY: 0.45, chineTop: 0.4, chineBottom: 0.55 },
        { t: 0.55, w: 1.16, h: 0.74, y: -0.06, e: 3.8, chine: 1, chineY: 0.46, chineTop: 0.46, chineBottom: 0.6 },
        { t: 0.7, w: 1.14, h: 0.72, y: -0.06, e: 3.8, chine: 0.85, chineY: 0.47, chineTop: 0.52, chineBottom: 0.64 },
        { t: 0.85, w: 1.08, h: 0.66, y: -0.05, e: 3.6, chine: 0.5, chineY: 0.48, chineTop: 0.6, chineBottom: 0.7 },
        { t: 1, w: 0.96, h: 0.58, y: -0.04, e: 3.4, chine: 0.2, chineY: 0.5, chineTop: 0.7, chineBottom: 0.78 },
      ],
    },
    wing: {
      // Diamond planform: 42 degrees on the leading edge, and a trailing edge
      // swept forward at 17 so the two angles are the only ones on the
      // aircraft. Tip chord is picked to land the trailing edge on that 17.
      kind: 'trapezoid',
      span: 13.56,
      rootOffset: 1.08,
      rootChord: 8.0,
      tipChord: 1.05,
      sweep: 42,
      dihedral: 0,
      thickness: 0.3,
      atZ: 6.9,
      atY: 0.0,
      tipThicknessRatio: 0.4,
    },
    tailH: {
      // Same leading-edge angle as the wing, same trailing-edge angle.
      span: 8.6,
      rootOffset: 1.4,
      rootChord: 4.4,
      tipChord: 0.9,
      sweep: 42,
      dihedral: 0,
      thickness: 0.2,
      atZ: 13.6,
      atY: -0.02,
    },
    tailVTwin: {
      span: 2.9,
      rootChord: 3.7,
      tipChord: 1.1,
      sweep: 23,
      // Canted well outboard: a vertical fin is a flat plate pointing straight
      // back at anything looking from the side.
      cant: 28,
      separation: 1.45,
      thickness: 0.3,
      atZ: 12.2,
      atY: 0.34,
    },
    fairings: [
      {
        // Engine trunk from the inlet to the nozzle, square in section so the
        // flank stays planar rather than rolling into the wing.
        at: [1.12, -0.08],
        fromZ: 5.5,
        toZ: 18.8,
        front: [0.42, 0.58],
        back: [0.46, 0.5],
        mirror: true,
        exponent: 4.4,
      },
    ],
    intakes: [
      {
        // Caret inlet: the lip is a single swept plane, set under the chine so
        // the forebody shields it.
        kind: 'caret',
        atZ: 5.5,
        length: 2.6,
        halfWidth: 0.36,
        height: 0.92,
        atY: -0.12,
        offsetX: 1.14,
        duct: true,
        sDuct: { toY: -0.04, toX: 0.9 },
      },
    ],
    nozzle: {
      kind: 'vectoring-2d',
      atZ: 18.9,
      radius: 0.46,
      atY: -0.04,
      separation: 0.62,
      length: 1.6,
      engineFromZ: 12.0,
      engineRadius: 0.46,
      serrations: 6,
      vector: 10,
    },
    canopy: {
      // One piece, no bow frame: a frame across the front is a strong
      // reflector, and the real canopy has none.
      fromZ: 3.1,
      toZ: 6.4,
      baseY: 0.5,
      topY: 1.36,
      halfWidth: 0.46,
      tier: 'hmd',
      seats: 1,
    },
    bays: [
      {
        // Main belly bay, closed. Stealth default across chapter 6: nothing is
        // carried outside, so no pylons and no stores.
        fromZ: 7.4,
        toZ: 11.8,
        halfWidth: 0.86,
        atY: -0.28,
        depth: 0.48,
        doorOpen: 0,
      },
    ],
    blocks: [
      {
        // Infrared sensor fairing ahead of the windscreen.
        shape: 'box',
        at: [0, 0.16, 2.5],
        size: [0.5, 0.14, 0.9],
        part: 'nose',
        palette: 'skinDark',
      },
    ],
    markings: {
      radius: 0.78,
      wing: { x: 3.4, chord: 0.42 },
      fuselageZ: 13.6,
    },
  },
};
