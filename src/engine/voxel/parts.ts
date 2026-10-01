/**
 * Part tags drive every inspection mode: isolate, fade, highlight, explode and
 * the hover tooltip all key off these. Index 0 is reserved for "untagged".
 * The part-state texture is 64 wide, so the list must stay under 64 entries.
 */
export const PARTS = [
  'none',
  'radome',
  'nose',
  'fuselage',
  'spine',
  'lerx',
  'wing-l',
  'wing-r',
  'flap-l',
  'flap-r',
  'canard-l',
  'canard-r',
  'tail-v',
  'tail-v-l',
  'tail-v-r',
  'tail-h-l',
  'tail-h-r',
  'ventral-l',
  'ventral-r',
  'canopy-glass',
  'canopy-frame',
  'cockpit',
  'seat',
  'hud',
  'intake-l',
  'intake-r',
  'intake-c',
  'duct',
  'engine',
  'nozzle',
  'pylon',
  'store',
  'bay-door',
  'bay',
  'marking',
  'gear',
  'airbrake',
  'probe',
  'wingtip-rail',
] as const;

export type PartId = (typeof PARTS)[number];

export const PART_COUNT = PARTS.length;

export const PART_INDEX: Record<PartId, number> = PARTS.reduce(
  (acc, id, i) => {
    acc[id] = i;
    return acc;
  },
  {} as Record<PartId, number>,
);

export const partIndex = (id: PartId): number => PART_INDEX[id];

/** Human-readable labels for tooltips and exploded-view leader lines. */
export const PART_LABEL: Record<PartId, string> = {
  none: 'Structure',
  radome: 'Radome',
  nose: 'Forward fuselage',
  fuselage: 'Fuselage',
  spine: 'Dorsal spine',
  lerx: 'Leading-edge root extension',
  'wing-l': 'Port wing',
  'wing-r': 'Starboard wing',
  'flap-l': 'Port control surface',
  'flap-r': 'Starboard control surface',
  'canard-l': 'Port canard',
  'canard-r': 'Starboard canard',
  'tail-v': 'Vertical stabiliser',
  'tail-v-l': 'Port vertical stabiliser',
  'tail-v-r': 'Starboard vertical stabiliser',
  'tail-h-l': 'Port stabilator',
  'tail-h-r': 'Starboard stabilator',
  'ventral-l': 'Port ventral fin',
  'ventral-r': 'Starboard ventral fin',
  'canopy-glass': 'Canopy glazing',
  'canopy-frame': 'Canopy frame',
  cockpit: 'Cockpit',
  seat: 'Ejection seat',
  hud: 'Head-up display',
  'intake-l': 'Port intake',
  'intake-r': 'Starboard intake',
  'intake-c': 'Ventral intake',
  duct: 'Intake duct',
  engine: 'Engine',
  nozzle: 'Exhaust nozzle',
  pylon: 'Pylon',
  store: 'External store',
  'bay-door': 'Weapons bay door',
  bay: 'Internal weapons bay',
  marking: 'National marking',
  gear: 'Landing gear',
  airbrake: 'Airbrake',
  probe: 'Pitot probe',
  'wingtip-rail': 'Wingtip rail',
};

/** Which way each part travels in the exploded view. Unit vectors, model space. */
export const PART_EXPLODE_DIR: Partial<Record<PartId, [number, number, number]>> = {
  radome: [0, 0, 1],
  nose: [0, 0, 0.6],
  'wing-l': [-1, 0.1, 0],
  'wing-r': [1, 0.1, 0],
  'flap-l': [-1, 0.1, -0.3],
  'flap-r': [1, 0.1, -0.3],
  'canard-l': [-1, 0.25, 0.25],
  'canard-r': [1, 0.25, 0.25],
  'tail-v': [0, 1, -0.2],
  'tail-v-l': [-0.55, 1, -0.2],
  'tail-v-r': [0.55, 1, -0.2],
  'tail-h-l': [-1, 0, -0.4],
  'tail-h-r': [1, 0, -0.4],
  'ventral-l': [-0.5, -1, 0],
  'ventral-r': [0.5, -1, 0],
  'canopy-glass': [0, 1, 0.35],
  'canopy-frame': [0, 1, 0.35],
  cockpit: [0, 0.65, 0.5],
  seat: [0, 0.9, 0.3],
  hud: [0, 0.75, 0.55],
  'intake-l': [-0.8, -0.45, 0.2],
  'intake-r': [0.8, -0.45, 0.2],
  'intake-c': [0, -1, 0.2],
  duct: [0, -0.7, 0],
  engine: [0, 0, -0.9],
  nozzle: [0, 0, -1],
  pylon: [0, -0.8, 0],
  store: [0, -1, 0],
  'bay-door': [0, -1, 0],
  bay: [0, -0.8, 0],
  gear: [0, -1, 0],
  airbrake: [0, 0.8, -0.5],
  probe: [0, 0, 1],
  'wingtip-rail': [1, 0.2, 0.3],
};

/** Parts that make up the outer skin, hidden or faded by the engine and x-ray modes. */
export const SKIN_PARTS: PartId[] = [
  'radome',
  'nose',
  'fuselage',
  'spine',
  'lerx',
  'wing-l',
  'wing-r',
  'flap-l',
  'flap-r',
  'canard-l',
  'canard-r',
  'tail-v',
  'tail-v-l',
  'tail-v-r',
  'tail-h-l',
  'tail-h-r',
  'ventral-l',
  'ventral-r',
  'marking',
];

export const PROPULSION_PARTS: PartId[] = [
  'intake-l',
  'intake-r',
  'intake-c',
  'duct',
  'engine',
  'nozzle',
];

export const COCKPIT_PARTS: PartId[] = ['cockpit', 'seat', 'hud', 'canopy-frame'];
