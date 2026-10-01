import { F16 } from './data/f16';
import type { AircraftConfig } from './types';

/** Exhibit order. Chapter order follows this list. */
export const AIRCRAFT: AircraftConfig[] = [F16];

export const byId = (id: string): AircraftConfig | undefined =>
  AIRCRAFT.find((a) => a.id === id);

export const byChapter = (chapter: number): AircraftConfig[] =>
  AIRCRAFT.filter((a) => a.chapter === chapter);

export * from './types';
export * from './countries';
