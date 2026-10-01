import { ME262 } from './data/me262';
import { F86 } from './data/f86';
import { MIG15 } from './data/mig15';
import { MIG21 } from './data/mig21';
import { F104 } from './data/f104';
import { MIRAGE3 } from './data/mirage3';
import { F16 } from './data/f16';
import type { AircraftConfig } from './types';

/** Exhibit order. Chapter order follows this list. */
export const AIRCRAFT: AircraftConfig[] = [
  ME262,
  F86,
  MIG15,
  MIG21,
  F104,
  MIRAGE3,
  F16,
];

export const byId = (id: string): AircraftConfig | undefined =>
  AIRCRAFT.find((a) => a.id === id);

export const byChapter = (chapter: number): AircraftConfig[] =>
  AIRCRAFT.filter((a) => a.chapter === chapter);

export * from './types';
export * from './countries';
