import { assemble } from './assemble';
import { DEFAULT_HIDDEN, PART_INDEX } from '../voxel/parts';
import type { AircraftConfig } from '../../aircraft/types';

/**
 * A plan-view mask of an airframe: one cell per voxel column, nose at row 0.
 * The evolution ribbon draws these as small 2D icons, which is far cheaper
 * than a live 3D thumbnail per aircraft.
 */
export interface Silhouette {
  id: string;
  /** Columns across the span. */
  w: number;
  /** Rows along the length, nose first. */
  h: number;
  /** 0 empty, 1 airframe, 2 glazing seen from above. */
  cells: Uint8Array;
}

/** Parts that are not on show at rest stay off the icon too. */
const HIDDEN = new Set(DEFAULT_HIDDEN.map((p) => PART_INDEX[p]));

/** Nose-to-tail resolution of a mask; plenty for a 30-pixel icon. */
const MASK_LENGTH = 44;

/**
 * Builds the airframe at a coarse resolution and keeps, for every column seen
 * from above, whatever is on top of it. Runs in the build worker.
 */
export function silhouette(config: AircraftConfig): Silhouette {
  const r = assemble(config, { targetLengthVoxels: MASK_LENGTH });
  const vs = r.voxelSize;
  const w = Math.round((r.max[0] - r.min[0]) / vs) + 1;
  const h = Math.round((r.max[2] - r.min[2]) / vs) + 1;
  const cells = new Uint8Array(w * h);
  const top = new Float32Array(w * h).fill(-Infinity);

  for (const b of r.buckets) {
    const value = b.kind === 'glass' ? 2 : 1;
    for (let i = 0; i < b.count; i++) {
      if (HIDDEN.has(b.parts[i])) continue;
      const x = Math.round((b.offsets[i * 3] - r.min[0]) / vs);
      const y = b.offsets[i * 3 + 1];
      // Nose is +Z; row 0 is the nose.
      const row = Math.round((r.max[2] - b.offsets[i * 3 + 2]) / vs);
      if (x < 0 || x >= w || row < 0 || row >= h) continue;
      const c = row * w + x;
      if (y > top[c]) {
        top[c] = y;
        cells[c] = value;
      }
    }
  }
  return { id: config.id, w, h, cells };
}
