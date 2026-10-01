import { VoxelGrid } from '../voxel/VoxelGrid';

/**
 * A 2D stencil in voxel units, returning a palette index or 0 for "leave the
 * skin alone". `u` runs along the fuselage, `v` across it.
 */
export type Mask = (u: number, v: number) => number;

export type PartFilter = (part: number) => boolean;

/**
 * Paints the topmost filled voxel of each column inside a region. The filter
 * stops a wing roundel from creeping onto the fuselage, or onto a fin that
 * happens to stand above the same column.
 */
export function paintTop(
  grid: VoxelGrid,
  cx: number,
  cz: number,
  reach: number,
  mask: Mask,
  part: number,
  allow: PartFilter,
): void {
  const x0 = Math.max(0, Math.floor(cx - reach));
  const x1 = Math.min(grid.sx - 1, Math.ceil(cx + reach));
  const z0 = Math.max(0, Math.floor(cz - reach));
  const z1 = Math.min(grid.sz - 1, Math.ceil(cz + reach));
  for (let z = z0; z <= z1; z++) {
    for (let x = x0; x <= x1; x++) {
      const pal = mask(z - cz, x - cx);
      if (pal === 0) continue;
      for (let y = grid.sy - 1; y >= 0; y--) {
        if (!grid.has(x, y, z)) continue;
        if (allow(grid.partAt(x, y, z))) grid.paint(x, y, z, pal, part);
        break;
      }
    }
  }
}

/** Paints the outermost filled voxel of each row on one flank. */
export function paintSide(
  grid: VoxelGrid,
  side: 1 | -1,
  cy: number,
  cz: number,
  reach: number,
  mask: Mask,
  part: number,
  allow: PartFilter,
): void {
  const y0 = Math.max(0, Math.floor(cy - reach));
  const y1 = Math.min(grid.sy - 1, Math.ceil(cy + reach));
  const z0 = Math.max(0, Math.floor(cz - reach));
  const z1 = Math.min(grid.sz - 1, Math.ceil(cz + reach));
  for (let z = z0; z <= z1; z++) {
    for (let y = y0; y <= y1; y++) {
      const pal = mask(z - cz, y - cy);
      if (pal === 0) continue;
      const from = side > 0 ? grid.sx - 1 : 0;
      const step = side > 0 ? -1 : 1;
      for (let x = from; x >= 0 && x < grid.sx; x += step) {
        if (!grid.has(x, y, z)) continue;
        if (allow(grid.partAt(x, y, z))) grid.paint(x, y, z, pal, part);
        break;
      }
    }
  }
}

export const anyPart: PartFilter = () => true;
