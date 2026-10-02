import type { AircraftConfig } from '../types';

/**
 * HAL Tejas. Tailless compound delta: the leading edge sweeps hard at the
 * root and eases outboard, which is the whole planform -- there is no
 * tailplane and no canard.
 */
export const TEJAS: AircraftConfig = {
  id: 'tejas',
  name: 'HAL Tejas',
  designation: 'Tejas',
  exhibitNo: '019',
  chapter: 5,
  spec: {
    firstFlight: 2001,
    machMax: 1.6,
    engines: { count: 1, type: 'afterburning-turbofan' },
    crew: 1,
    role: 'Multirole fighter',
    country: 'IN',
    generation: '4.5',
    lengthM: 13.2,
    spanM: 8.2,
    heightM: 4.4,
    status: 'in-service',
  },
  copy: {
    category: 'SINGLE-ENGINE TAILLESS COMPOUND DELTA',
    subtitle: [
      'No tailplane, no canard, and a wing whose sweep changes',
      'part way out to do the work of both.',
    ],
    annotations: [
      {
        n: '01',
        title: 'The sweep changes',
        body: 'Steep at the root for supersonic flight, shallower outboard for lift at low speed. The kink in the leading edge is where one job hands over to the other.',
      },
      {
        n: '02',
        title: 'Smallest of its generation',
        body: 'At just over thirteen metres it is the shortest supersonic fighter in current service, and among the lightest. A tailless layout saves the weight a tail and its structure would cost.',
      },
      {
        n: '03',
        title: 'A long time coming',
        body: 'Begun in the 1980s and first flown in 2001, the programme had to build an Indian aerospace industry alongside the aircraft: flight controls, composites and radar as well as the airframe.',
      },
    ],
  },
  palette: {
    skin: '#8d98a1',
    skinLight: '#a7b1b9',
    skinDark: '#66717a',
    skinShade: '#79848c',
    frame: '#2b3036',
    glass: '#a6d6e8',
    cockpit: '#262b31',
    seat: '#363c42',
    hud: '#7cf0c4',
    metal: '#949aa0',
    nozzle: '#6c6864',
    exhaust: '#6b3417',
    accent: '#ff9933',
  },
  geometry: {
    bbox: { span: 8.4, height: 3.9 },
    fuselage: {
      length: 13.2,
      radomeTo: 0.07,
      noseTo: 0.28,
      stations: [
        { t: 0, w: 0.06, h: 0.06, y: 0.04, e: 2 },
        { t: 0.04, w: 0.24, h: 0.24, y: 0.04, e: 2 },
        { t: 0.14, w: 0.46, h: 0.44, y: 0.0, e: 2.1 },
        { t: 0.28, w: 0.6, h: 0.56, y: -0.04, e: 2.3 },
        { t: 0.44, w: 0.66, h: 0.6, y: -0.06, e: 2.4 },
        { t: 0.6, w: 0.66, h: 0.6, y: -0.06, e: 2.4 },
        { t: 0.76, w: 0.62, h: 0.56, y: -0.04, e: 2.3 },
        { t: 0.9, w: 0.56, h: 0.5, y: -0.02, e: 2.2 },
        { t: 1, w: 0.5, h: 0.46, y: 0.0, e: 2.2 },
      ],
    },
    wing: {
      kind: 'cranked-delta',
      span: 8.2,
      rootOffset: 0.58,
      rootChord: 6.6,
      tipChord: 0.4,
      sweep: 62,
      // The crank: sweep eases from 62 to 42 degrees. Placed slightly inboard
      // of half span so the outer panel is long enough for the break to read in
      // plan view; the published sweeps are kept as they are.
      kink: { at: 0.45, chord: 3.1, sweep: 42 },
      dihedral: 0,
      thickness: 0.26,
      atZ: 4.5,
      atY: -0.12,
      tipThicknessRatio: 0.4,
    },
    tailV: {
      span: 2.1,
      rootChord: 3.4,
      tipChord: 1.1,
      sweep: 52,
      thickness: 0.22,
      atZ: 8.6,
      atY: 0.42,
    },
    intakes: [
      {
        kind: 'side-rect',
        atZ: 4.3,
        length: 2.0,
        halfWidth: 0.26,
        height: 0.74,
        atY: -0.14,
        offsetX: 0.78,
        duct: true,
        splitter: 0.1,
        sDuct: { toY: -0.1, toX: 0 },
      },
    ],
    nozzle: {
      kind: 'round',
      atZ: 13.1,
      radius: 0.46,
      atY: -0.02,
      length: 1.4,
      engineFromZ: 8.4,
      engineRadius: 0.44,
    },
    canopy: {
      fromZ: 2.6,
      toZ: 4.8,
      baseY: 0.48,
      topY: 1.2,
      halfWidth: 0.4,
      tier: 'hmd',
      seats: 1,
    },
    blocks: [
      {
        shape: 'box',
        at: [0, 0.04, -0.24],
        size: [0.06, 0.06, 0.56],
        part: 'probe',
        palette: 'frame',
      },
    ],
    markings: {
      radius: 0.58,
      wing: { x: 2.3, chord: 0.4 },
      fuselageZ: 3.2,
    },
  },
};
