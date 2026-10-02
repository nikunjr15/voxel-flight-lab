import { ME262 } from './data/me262';
import { F86 } from './data/f86';
import { MIG15 } from './data/mig15';
import { MIG21 } from './data/mig21';
import { F104 } from './data/f104';
import { MIRAGE3 } from './data/mirage3';
import { F4 } from './data/f4';
import { MIG23 } from './data/mig23';
import { AJEET } from './data/ajeet';
import { F15 } from './data/f15';
import { F16 } from './data/f16';
import { SU27 } from './data/su27';
import { MIG29 } from './data/mig29';
import { MIRAGE2000 } from './data/mirage2000';
import type { AircraftConfig } from './types';

/** Exhibit order. Chapter order follows this list. */
export const AIRCRAFT: AircraftConfig[] = [
  ME262,
  F86,
  MIG15,
  MIG21,
  F104,
  MIRAGE3,
  F4,
  MIG23,
  AJEET,
  F15,
  F16,
  SU27,
  MIG29,
  MIRAGE2000,
];

export const byId = (id: string): AircraftConfig | undefined =>
  AIRCRAFT.find((a) => a.id === id);

export const byChapter = (chapter: number): AircraftConfig[] =>
  AIRCRAFT.filter((a) => a.chapter === chapter);

export * from './types';
export * from './countries';
