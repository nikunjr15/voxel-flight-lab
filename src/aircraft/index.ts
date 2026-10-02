import { ME262 } from './data/me262';
import { F86 } from './data/f86';
import { MIG15 } from './data/mig15';
import { MIG21 } from './data/mig21';
import { F104 } from './data/f104';
import { MIRAGE3 } from './data/mirage3';
import { GNAT } from './data/gnat';
import { F4 } from './data/f4';
import { MIG23 } from './data/mig23';
import { F15 } from './data/f15';
import { F16 } from './data/f16';
import { SU27 } from './data/su27';
import { MIG29 } from './data/mig29';
import { MIRAGE2000 } from './data/mirage2000';
import { RAFALE } from './data/rafale';
import { GRIPEN } from './data/gripen';
import { TYPHOON } from './data/typhoon';
import { SU30MKI } from './data/su30mki';
import { TEJAS } from './data/tejas';
import { F22 } from './data/f22';
import { F35 } from './data/f35';
import { SU57 } from './data/su57';
import { J20 } from './data/j20';
import { AMCA } from './data/amca';
import { GCAP } from './data/gcap';
import { NGAD } from './data/ngad';
import { VAJRA } from './data/vajra';
import type { AircraftConfig } from './types';

/** Exhibit order. Chapter order follows this list. */
export const AIRCRAFT: AircraftConfig[] = [
  ME262,
  F86,
  MIG15,
  MIG21,
  F104,
  MIRAGE3,
  GNAT,
  F4,
  MIG23,
  F15,
  F16,
  SU27,
  MIG29,
  MIRAGE2000,
  RAFALE,
  GRIPEN,
  TYPHOON,
  SU30MKI,
  TEJAS,
  F22,
  F35,
  SU57,
  J20,
  AMCA,
  GCAP,
  NGAD,
  VAJRA,
];

/**
 * Pairings worth putting on the compare turntable, where the contrast tells a
 * story rather than just showing two shapes.
 */
export const SUGGESTED_PAIRS: Array<{ a: string; b: string; note: string }> = [
  {
    a: 'gnat',
    b: 'f-86',
    note: 'Indian Gnats were credited against Pakistani Sabres in 1965 and 1971, which earned the Gnat the Sabre Slayer nickname. Two very different answers to the same decade.',
  },
  {
    a: 'f-104',
    b: 'mirage-3',
    note: 'The same Mach 2 requirement solved two ways: the smallest possible wing, or the largest possible delta.',
  },
  {
    a: 'f-15',
    b: 'su-27',
    note: 'Two air superiority fighters drawn against each other, one a conventional big-wing design, the other a blended lifting body.',
  },
  {
    a: 'f-15',
    b: 'f-22',
    note: 'The same job, a generation apart. Everything the Eagle rounds off, the Raptor flattens, and everything the Eagle hangs outside, the Raptor swallows.',
  },
  {
    a: 'su-27',
    b: 'su-57',
    note: 'The Flanker idea carried into the fifth generation: the same wide body and spaced engines, reshaped for radar rather than replaced.',
  },
  {
    a: 'tejas',
    b: 'amca',
    note: 'What India has flown beside what it is designing. One is a small, conventional delta; the other is shaped for radar from the first line.',
  },
];

export const byId = (id: string): AircraftConfig | undefined =>
  AIRCRAFT.find((a) => a.id === id);

export const byChapter = (chapter: number): AircraftConfig[] =>
  AIRCRAFT.filter((a) => a.chapter === chapter);

export * from './types';
export * from './countries';
