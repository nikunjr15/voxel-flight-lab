import { Palette, PaletteSlot } from '../voxel/palette';
import { PART_INDEX, PartId } from '../voxel/parts';
import { VoxelGrid } from '../voxel/VoxelGrid';

/**
 * Model space is metres: +X starboard, +Y up, +Z forward, origin at mid-length
 * on the waterline. Configs quote positions as metres aft of the nose because
 * that is how aircraft dimensions are actually read off a drawing.
 */
export class BuildCtx {
  readonly grid: VoxelGrid;
  readonly pal: Palette;
  readonly vpm: number;
  readonly length: number;
  readonly origin: [number, number, number];

  constructor(grid: VoxelGrid, pal: Palette, vpm: number, length: number, origin: [number, number, number]) {
    this.grid = grid;
    this.pal = pal;
    this.vpm = vpm;
    this.length = length;
    this.origin = origin;
  }

  /** Metres to voxel units. */
  v(m: number): number {
    return m * this.vpm;
  }

  gx(xM: number): number {
    return this.origin[0] + xM * this.vpm;
  }

  gy(yM: number): number {
    return this.origin[1] + yM * this.vpm;
  }

  /** Model-space Z in metres to a grid coordinate. */
  gz(zM: number): number {
    return this.origin[2] + zM * this.vpm;
  }

  /** Metres aft of the nose to model-space Z. */
  zOf(aft: number): number {
    return this.length / 2 - aft;
  }

  /** Metres aft of the nose to a grid coordinate. */
  gzAft(aft: number): number {
    return this.gz(this.zOf(aft));
  }

  /** Grid coordinate back to metres aft of the nose. */
  aftAt(gz: number): number {
    return this.length / 2 - (gz - this.origin[2]) / this.vpm;
  }

  p(id: PartId): number {
    return PART_INDEX[id];
  }

  slot(s: PaletteSlot | undefined, fallback: PaletteSlot = 'skin'): number {
    return this.pal.idx(s ?? fallback);
  }
}
