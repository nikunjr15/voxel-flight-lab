import type { AircraftConfig } from '../types';

/**
 * GCAP. The Global Combat Air Programme: Britain, Italy and Japan building one
 * sixth-generation aircraft between them. Nothing has flown and no dimensions
 * have been released, so the model is a stylised reading of the published
 * concept models -- a large tailless delta -- drawn to an assumed size.
 *
 * No national insignia: the programme has three partners and no aircraft, so
 * there is nothing to paint that would be true.
 */
export const GCAP: AircraftConfig = {
  id: 'gcap',
  name: 'GCAP',
  designation: 'GCAP',
  exhibitNo: '025',
  chapter: 7,
  spec: {
    engines: { count: 2, type: 'afterburning-turbofan' },
    crew: 1,
    role: 'Air dominance fighter',
    country: 'UK',
    generation: '6-concept',
    status: 'concept',
  },
  copy: {
    category: 'TAILLESS SIXTH-GENERATION CONCEPT',
    subtitle: [
      'Three countries, one airframe, and no fins at all:',
      'control handed from surfaces to software.',
    ],
    annotations: [
      {
        n: '01',
        title: 'No vertical tail',
        body: 'A fin is the single largest reflector on a conventional fighter and the first thing a sixth-generation layout gives up. Yaw control moves to split surfaces in the wing and to the engines, and the flight-control computer does work no pilot could.',
      },
      {
        n: '02',
        title: 'Large on purpose',
        body: 'Concept models show an aircraft noticeably bigger than a Typhoon. Range, internal volume, cooling for the sensors and electrical power for whatever comes next all argue for size.',
      },
      {
        n: '03',
        title: 'What is being designed is not only the jet',
        body: 'The programme treats the crewed aircraft as one node: uncrewed partners, sensors and the network are specified together. That is most of what separates the sixth generation from the fifth.',
      },
      {
        n: '04',
        title: 'Why there are no numbers',
        body: 'The partners have published no dimensions and no performance figures. The size here is a modelling assumption so the aircraft can stand next to the others at honest relative scale, and nothing more.',
      },
    ],
  },
  palette: {
    skin: '#636a72',
    skinLight: '#7a8189',
    skinDark: '#484f57',
    skinShade: '#555c64',
    frame: '#272c32',
    glass: '#b9a46a',
    cockpit: '#22272d',
    seat: '#32383e',
    hud: '#7cf0c4',
    metal: '#8a9096',
    nozzle: '#5c5955',
    exhaust: '#6b3417',
    accent: '#012169',
  },
  geometry: {
    bbox: { span: 15.0, height: 4.2 },
    fuselage: {
      length: 21.0,
      radomeTo: 0.05,
      noseTo: 0.24,
      stations: [
        { t: 0, w: 0.08, h: 0.07, y: 0.02, e: 2 },
        { t: 0.05, w: 0.46, h: 0.28, y: 0.0, e: 2.6, chine: 0.8, chineY: 0.4, chineTop: 0.26, chineBottom: 0.42 },
        { t: 0.14, w: 0.88, h: 0.48, y: -0.04, e: 3.2, chine: 1, chineY: 0.4, chineTop: 0.26, chineBottom: 0.44 },
        { t: 0.26, w: 1.2, h: 0.62, y: -0.08, e: 3.6, chine: 1, chineY: 0.42, chineTop: 0.34, chineBottom: 0.5 },
        { t: 0.4, w: 1.42, h: 0.7, y: -0.12, e: 4, chine: 1, chineY: 0.44, chineTop: 0.42, chineBottom: 0.56 },
        { t: 0.56, w: 1.5, h: 0.7, y: -0.12, e: 4.2, chine: 1, chineY: 0.45, chineTop: 0.5, chineBottom: 0.6 },
        { t: 0.72, w: 1.44, h: 0.66, y: -0.12, e: 4.2, chine: 0.9, chineY: 0.46, chineTop: 0.58, chineBottom: 0.66 },
        { t: 0.88, w: 1.24, h: 0.58, y: -0.1, e: 4, chine: 0.7, chineY: 0.48, chineTop: 0.68, chineBottom: 0.74 },
        { t: 1, w: 1.04, h: 0.5, y: -0.08, e: 3.8, chine: 0.5 },
      ],
    },
    wing: {
      // Cranked delta with a straight trailing edge: no fins, no tailplane,
      // so every control surface the aircraft has is on this one planform.
      kind: 'delta',
      span: 15.0,
      rootOffset: 1.5,
      rootChord: 12.6,
      tipChord: 1.5,
      sweep: 48,
      dihedral: 0,
      thickness: 0.34,
      atZ: 6.6,
      atY: -0.12,
      tipThicknessRatio: 0.36,
    },
    intakes: [
      {
        // Under the chine, where the forebody shields the lip from below.
        // Set on the shoulder instead it sat inside the body and never broke
        // the surface, leaving an aircraft with no visible inlet.
        kind: 'caret',
        atZ: 6.0,
        length: 3.2,
        halfWidth: 0.42,
        height: 0.72,
        atY: -0.26,
        offsetX: 1.26,
        duct: true,
        sDuct: { toY: -0.1, toX: 0.9 },
      },
    ],
    nozzle: {
      kind: 'vectoring-2d',
      atZ: 20.9,
      radius: 0.5,
      atY: -0.12,
      separation: 0.86,
      length: 1.8,
      engineFromZ: 13.6,
      engineRadius: 0.5,
      serrations: 8,
    },
    canopy: {
      fromZ: 3.2,
      toZ: 6.8,
      baseY: 0.42,
      topY: 1.22,
      halfWidth: 0.46,
      tier: 'hmd',
      seats: 1,
    },
    bays: [
      {
        fromZ: 8.0,
        toZ: 13.6,
        halfWidth: 1.0,
        atY: -0.32,
        depth: 0.48,
        doorOpen: 0,
      },
    ],
    markings: {
      // Nothing to paint: three partner nations and no aircraft in service.
      style: 'none',
      radius: 0.9,
    },
  },
};
