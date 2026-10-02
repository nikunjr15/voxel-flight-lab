import type { AssembleOptions } from '../../engine/build/assemble';
import type { AircraftConfig, AircraftGeometry } from '../../aircraft/types';
import type { PartId } from '../../engine/voxel/parts';

export interface RigSpecimen {
  label: string;
  note: string;
  config: AircraftConfig;
  opts?: AssembleOptions;
  /** Palette overrides, so a buried part can be given a telling colour. */
  palette?: Record<string, string>;
  /** Parts faded on load, so a buried feature can be seen. */
  reveal?: PartId[];
}

const PALETTE = {
  skin: '#9aa6b1',
  skinLight: '#b8c2c9',
  skinDark: '#6e7b86',
  skinShade: '#848f99',
  frame: '#3b434a',
  glass: '#a6d6e8',
  cockpit: '#2f353a',
  seat: '#3c4248',
  hud: '#7cf0c4',
  metal: '#8f949a',
  nozzle: '#6f6a66',
  exhaust: '#6b3417',
  store: '#6b7681',
  pylon: '#59636c',
  accent: '#ff6a2b',
};

/** Neutral test body: nothing distinctive, so the feature under test reads. */
const BASE: AircraftGeometry = {
  bbox: { span: 9, height: 4.4 },
  fuselage: {
    length: 12,
    radomeTo: 0.07,
    noseTo: 0.28,
    stations: [
      { t: 0, w: 0.05, h: 0.05, y: 0.12, e: 2 },
      { t: 0.05, w: 0.26, h: 0.25, y: 0.11, e: 2 },
      { t: 0.14, w: 0.46, h: 0.44, y: 0.08, e: 2 },
      { t: 0.3, w: 0.62, h: 0.62, y: 0.02, e: 2.2 },
      { t: 0.52, w: 0.68, h: 0.7, y: 0, e: 2.3 },
      { t: 0.74, w: 0.64, h: 0.68, y: 0, e: 2.3 },
      { t: 0.9, w: 0.56, h: 0.58, y: 0.02, e: 2.2 },
      { t: 1, w: 0.48, h: 0.5, y: 0.02, e: 2.1 },
    ],
  },
  wing: {
    span: 7.6,
    rootOffset: 0.62,
    rootChord: 3.4,
    tipChord: 1.1,
    sweep: 34,
    thickness: 0.26,
    atZ: 5.2,
    atY: -0.05,
  },
  tailV: {
    span: 2.1,
    rootChord: 3.0,
    tipChord: 1.1,
    sweep: 44,
    thickness: 0.22,
    atZ: 8.0,
    atY: 0.45,
  },
  tailH: {
    span: 4.4,
    rootOffset: 0.46,
    rootChord: 1.9,
    tipChord: 0.7,
    sweep: 36,
    thickness: 0.15,
    atZ: 9.4,
    atY: -0.02,
  },
  intakes: [
    { kind: 'chin', atZ: 3.6, length: 2.2, halfWidth: 0.5, height: 0.68, atY: -0.82, duct: true },
  ],
  nozzle: {
    kind: 'round',
    atZ: 12.0,
    radius: 0.46,
    atY: 0.02,
    length: 1.2,
    engineFromZ: 7.6,
    engineRadius: 0.44,
  },
  canopy: {
    fromZ: 2.4,
    toZ: 5.1,
    baseY: 0.48,
    topY: 1.22,
    halfWidth: 0.44,
    tier: 'mfd',
    seats: 1,
  },
};

function clone<T>(v: T): T {
  return structuredClone(v);
}

function specimen(
  id: string,
  label: string,
  note: string,
  patch: (g: AircraftGeometry) => void,
  extra: Partial<Pick<RigSpecimen, 'opts' | 'reveal' | 'palette'>> = {},
): RigSpecimen {
  const geometry = clone(BASE);
  patch(geometry);
  return {
    label,
    note,
    ...extra,
    config: {
      id: `rig-${id}`,
      name: label,
      designation: label,
      exhibitNo: '000',
      chapter: 0,
      spec: {
        firstFlight: 0,
        engines: { count: 1, type: 'afterburning-turbofan' },
        crew: 1,
        role: 'Test rig specimen',
        country: 'US',
        generation: '4',
        lengthM: geometry.fuselage.length,
        spanM: geometry.bbox.span,
        heightM: geometry.bbox.height,
        status: 'concept',
      },
      copy: { category: 'RIG', subtitle: ['', ''], annotations: [] },
      palette: { ...PALETTE, ...(extra.palette ?? {}) },
      geometry,
    },
  };
}

const VG_WING: AircraftGeometry['wing'] = {
  span: 9,
  rootOffset: 0.66,
  rootChord: 3.4,
  tipChord: 1.0,
  sweep: 20,
  thickness: 0.26,
  atZ: 4.4,
  atY: 0.1,
  vg: {
    pivotX: 1.5,
    gloveSweep: 68,
    gloveChord: 3.9,
    sweepMin: 18,
    sweepMax: 72,
    panelRootChord: 2.1,
    panelTipChord: 0.9,
    panelSpan: 3.2,
  },
};

/**
 * One plinth per primitive added in this phase. Each specimen changes exactly
 * one thing about the neutral body, so a defect has nowhere to hide.
 */
export const SPECIMENS: RigSpecimen[] = [
  specimen(
    'vg-fwd',
    'Variable sweep 18',
    'Fixed glove plus movable panel, fully forward',
    (g) => {
      g.wing = clone(VG_WING);
    },
    { opts: { wingSweep: 18 } },
  ),
  specimen(
    'vg-mid',
    'Variable sweep 45',
    'Panel chord grows as the lateral span shortens',
    (g) => {
      g.wing = clone(VG_WING);
    },
    { opts: { wingSweep: 45 } },
  ),
  specimen(
    'vg-aft',
    'Variable sweep 72',
    'Fully aft; panel tucks against the glove',
    (g) => {
      g.wing = clone(VG_WING);
    },
    { opts: { wingSweep: 72 } },
  ),
  specimen('canard', 'Close-coupled canard', 'Canard pair high and just ahead of the wing', (g) => {
    g.wing = {
      ...g.wing,
      span: 8.2,
      rootChord: 4.4,
      tipChord: 0.9,
      sweep: 52,
      atZ: 5.0,
    };
    g.canard = {
      span: 5.0,
      rootOffset: 0.6,
      rootChord: 1.5,
      tipChord: 0.6,
      sweep: 44,
      dihedral: -3,
      thickness: 0.14,
      atZ: 3.6,
      atY: 0.42,
      roundTip: true,
    };
    g.tailH = undefined;
  }),
  specimen('vtail', 'V-tail', 'Canted pair doing both jobs, no separate stabilator', (g) => {
    g.tailV = undefined;
    g.tailH = undefined;
    g.tailVee = {
      span: 2.2,
      rootChord: 2.6,
      tipChord: 0.9,
      sweep: 40,
      cant: 42,
      separation: 0.34,
      thickness: 0.2,
      atZ: 8.4,
      atY: 0.35,
    };
  }),
  specimen('twin-fin', 'Canted twin fins', 'Outward cant, as on a stealth tail', (g) => {
    g.tailV = undefined;
    g.tailVTwin = {
      span: 1.9,
      rootChord: 2.4,
      tipChord: 0.8,
      sweep: 42,
      cant: 28,
      separation: 1.05,
      thickness: 0.18,
      atZ: 8.2,
      atY: 0.4,
    };
  }),
  specimen(
    's-duct',
    'S-duct intake',
    'Bore eases up and inboard, no line of sight to the face',
    (g) => {
      g.intakes = [
        {
          kind: 'side-rect',
          atZ: 3.6,
          length: 2.2,
          halfWidth: 0.5,
          height: 0.92,
          atY: -0.46,
          offsetX: 0.95,
          duct: true,
          splitter: 0.14,
          sDuct: { toY: 0.22, toX: 0 },
        },
      ];
      g.nozzle = { ...g.nozzle!, engineFromZ: 8.4 };
    },
    {
      reveal: ['fuselage', 'nose', 'wing-l', 'wing-r', 'tail-v', 'tail-h-l', 'tail-h-r'],
      // The duct borrows skinDark, so recolouring it makes the bend legible.
      palette: { skinDark: '#2f8f89' },
    },
  ),
  specimen('serrated', 'Serrated nozzle', 'Eight chevrons cut per azimuth, not banded', (g) => {
    g.nozzle = { ...g.nozzle!, kind: 'serrated', radius: 0.58, length: 1.6, serrations: 8 };
  }),
  specimen('vector-2d', '2D vectoring nozzle', 'Flat petals deflected 15 degrees', (g) => {
    g.nozzle = {
      ...g.nozzle!,
      kind: 'vectoring-2d',
      radius: 0.56,
      length: 1.7,
      vector: 15,
      serrations: 6,
    };
  }),
  specimen(
    'bay',
    'Weapons bay, open',
    'Carved cavity, lined, doors hinged outboard',
    (g) => {
      g.bays = [
        { fromZ: 5.0, toZ: 7.8, halfWidth: 0.5, atY: -0.1, depth: 0.52, doorOpen: 1 },
      ];
    },
  ),
  specimen('nose-intake', 'Nose intake, shock cone', 'Annular lip with an ogive centrebody', (g) => {
    g.intakes = [
      {
        kind: 'nose',
        atZ: 0.35,
        length: 1.0,
        halfWidth: 0.44,
        height: 0.88,
        atY: 0.08,
        duct: true,
        shockCone: { length: 1.5, radius: 0.24 },
      },
    ];
    g.fuselage.radomeTo = 0.02;
    g.fuselage.stations = [
      { t: 0, w: 0.4, h: 0.4, y: 0.1, e: 2 },
      { t: 0.12, w: 0.46, h: 0.46, y: 0.08, e: 2 },
      { t: 0.3, w: 0.6, h: 0.6, y: 0.02, e: 2.1 },
      { t: 0.52, w: 0.66, h: 0.68, y: 0, e: 2.2 },
      { t: 0.74, w: 0.62, h: 0.66, y: 0, e: 2.2 },
      { t: 1, w: 0.48, h: 0.5, y: 0.02, e: 2.1 },
    ];
  }),
  specimen('dsi', 'DSI intake', 'Diverterless bump in place of a splitter plate', (g) => {
    g.intakes = [
      {
        kind: 'dsi',
        atZ: 3.6,
        length: 2.1,
        halfWidth: 0.42,
        height: 0.8,
        atY: -0.36,
        offsetX: 0.84,
        duct: true,
        sDuct: { toY: 0.05, toX: 0 },
      },
    ];
  }),
  specimen('stores', 'Pylons and stores', 'Rail, missile and drop tank on pylons', (g) => {
    g.stores = [
      {
        kind: 'missile',
        at: [2.1, -0.5, 6.4],
        length: 2.8,
        radius: 0.12,
        mirror: true,
        pylon: { height: 0.3, chord: 0.7 },
        fins: 4,
      },
      {
        kind: 'tank',
        at: [1.25, -0.62, 6.1],
        length: 3.6,
        radius: 0.22,
        mirror: true,
        pylon: { height: 0.26, chord: 0.8 },
        fins: 0,
      },
      { kind: 'rail', at: [3.8, 0.0, 6.0], length: 1.6, radius: 0.1, mirror: true },
    ];
  }),
  specimen('nacelle', 'Underwing nacelles', 'Podded engines: lip, bored duct, exhaust', (g) => {
    g.wing = { ...g.wing, sweep: 20, rootChord: 2.9, tipChord: 1.2, span: 8.6, atZ: 4.6 };
    g.nacelles = [
      {
        at: [1.9, -0.52, 5.4],
        length: 3.4,
        radius: 0.42,
        mirror: true,
        pylon: 0.2,
        exhaustRadius: 0.3,
      },
    ];
    g.nozzle = { ...g.nozzle!, kind: 'round', radius: 0.3, engineFromZ: undefined };
  }),
  specimen('t-tail', 'T-tail', 'Stabiliser carried on top of the fin', (g) => {
    g.tailV = {
      span: 2.3,
      rootChord: 2.8,
      tipChord: 1.3,
      sweep: 40,
      thickness: 0.22,
      atZ: 8.0,
      atY: 0.45,
    };
    g.tailH = {
      span: 3.6,
      rootOffset: 0.18,
      rootChord: 1.5,
      tipChord: 0.7,
      sweep: 22,
      thickness: 0.13,
      atZ: 9.4,
      atY: 0,
      mount: 'fin-top',
    };
  }),
  specimen('anhedral', 'Strong anhedral', 'Straight wing drooped ten degrees', (g) => {
    g.wing = {
      ...g.wing,
      span: 6.6,
      rootChord: 2.6,
      tipChord: 1.0,
      sweep: 8,
      dihedral: -10,
      thickness: 0.16,
    };
  }),
  specimen('cranked', 'Cranked dihedral', 'Flat inner panel, outer panel up twelve degrees', (g) => {
    g.wing = {
      ...g.wing,
      span: 8.4,
      rootChord: 3.6,
      tipChord: 1.1,
      sweep: 42,
      dihedral: 0,
      outerDihedral: { at: 0.55, angle: 12 },
    };
    g.tailH = { ...g.tailH!, dihedral: -20 };
  }),
  specimen('half-cone', 'Half-cone side intakes', 'Shock body in the inboard corner of each lip', (g) => {
    g.intakes = [
      {
        kind: 'side-half-cone',
        atZ: 4.0,
        length: 2.1,
        halfWidth: 0.42,
        height: 0.72,
        atY: -0.2,
        offsetX: 0.9,
        duct: true,
        splitter: 0.12,
        shockCone: { length: 1.4, radius: 0.3 },
      },
    ];
  }),
  specimen('tri-section', 'Triangular fuselage', 'Section tapered to an apex at the keel', (g) => {
    g.fuselage.stations = g.fuselage.stations.map((st) => ({
      ...st,
      tri: st.t < 0.1 ? 0 : 0.72,
      e: 2.6,
    }));
  }),
  specimen('compound-delta', 'Compound delta', 'Leading-edge sweep changes part way out', (g) => {
    g.wing = {
      ...g.wing,
      kind: 'cranked-delta',
      span: 8.2,
      rootChord: 5.6,
      tipChord: 0.5,
      sweep: 62,
      atZ: 3.4,
      kink: { at: 0.5, chord: 2.6, sweep: 42 },
    };
    g.tailH = undefined;
  }),
  specimen('canard-forward', 'Forward canard', 'Set well ahead of the wing, not close coupled', (g) => {
    g.wing = { ...g.wing, span: 8.4, rootChord: 4.6, tipChord: 0.9, sweep: 53, atZ: 5.2 };
    g.canard = {
      span: 5.2,
      rootOffset: 0.58,
      rootChord: 1.5,
      tipChord: 0.6,
      sweep: 45,
      dihedral: -2,
      thickness: 0.14,
      atZ: 2.6,
      atY: 0.5,
      roundTip: true,
    };
    g.tailH = undefined;
  }),
  specimen('tandem', 'Two-seat tandem canopy', 'Two seats under one long canopy', (g) => {
    g.canopy = { ...g.canopy, fromZ: 2.1, toZ: 5.6, seats: 2, topY: 1.3 };
  }),
  specimen('vector-axi', 'Axisymmetric vectoring', 'Round nozzle swung as a whole', (g) => {
    g.nozzle = { ...g.nozzle!, kind: 'round', radius: 0.52, length: 1.8, vector: 18 };
  }),
  specimen('glyphs', 'Voxel glyph font', 'Serial painted with the in-code 3x5 font', (g) => {
    g.lettering = [
      { text: 'VFL-04', on: 'fuselage', atZ: 3.8, atY: 0.1, size: 0.1, palette: 'frame' },
      { text: 'LAB', on: 'fin', atZ: 9.4, atY: 1.35, size: 0.1, palette: 'frame' },
    ];
  }),
  specimen('chine', 'Chined fuselage', 'Hard lateral edge, flat deck and keel', (g) => {
    g.fuselage.stations = g.fuselage.stations.map((st) => ({
      ...st,
      // Faired in behind the radome and out again at the tail, which is how a
      // config should use it: switched on at one station the body steps.
      chine: st.t < 0.08 ? 0 : st.t > 0.86 ? 0.35 : 1,
      chineY: 0.44,
      chineTop: 0.3,
      chineBottom: 0.52,
    }));
  }),
  specimen('chine-blend', 'Chine fairing in and out', 'Half-chined section, round fore and aft', (g) => {
    g.fuselage.stations = g.fuselage.stations.map((st) => ({
      ...st,
      chine: st.t > 0.25 && st.t < 0.7 ? 0.5 : 0,
      chineY: 0.4,
    }));
  }),
  specimen('levcon', 'LEVCON', 'Movable surface let into the root extension', (g) => {
    g.wing = { ...g.wing, span: 10, rootChord: 5.4, tipChord: 1.1, sweep: 42, atZ: 4.8 };
    g.lerx = { fromZ: 2.6, toZ: 4.8, maxHalfWidth: 1.1, atY: -0.05, thickness: 0.2 };
    g.levcon = {
      span: 3.6,
      rootOffset: 0.8,
      rootChord: 1.0,
      tipChord: 0.6,
      sweep: 48,
      dihedral: 0,
      thickness: 0.16,
      atZ: 3.0,
      atY: 0.0,
      palette: 'skinDark',
    };
    g.canard = undefined;
    g.tailH = undefined;
  }),
  specimen('tailless', 'Tailless', 'No fin, no stabiliser: control from the wing alone', (g) => {
    g.wing = {
      ...g.wing,
      kind: 'cranked-delta',
      span: 11,
      rootChord: 7.4,
      tipChord: 0.6,
      sweep: 55,
      atZ: 3.2,
      kink: { at: 0.58, chord: 2.4, sweep: 38 },
    };
    g.tailV = undefined;
    g.tailH = undefined;
    g.canard = undefined;
  }),
  specimen('bay-closed', 'Weapons bay, closed', 'Stealth default: doors shut, nothing hung outside', (g) => {
    g.bays = [{ fromZ: 4.4, toZ: 7.6, halfWidth: 0.6, atY: -0.5, depth: 0.7, doorOpen: 0 }];
    g.stores = undefined;
  }),
];
