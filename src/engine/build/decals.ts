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

/**
 * Paints the outermost filled voxel of each row on one flank, in local surface
 * coordinates: the across-body axis is arc length measured along the
 * cross-section, not raw height.
 *
 * Projecting the stencil straight down the x axis works on a flat slab and
 * nowhere else. On a curved or angled flank -- a Tejas intake cheek, a Flanker
 * spine -- neighbouring rows land on voxels far apart in x, so the mask
 * stretches with the surface and a roundel comes out as a smeared U. Walking
 * the section outward from the centre row and accumulating
 * sqrt(1 + dx^2) per step unwraps it: the marking stays circular, and it stops
 * at a shoulder of its own accord rather than wrapping over it, because one
 * sharp step in x spends the whole remaining radius.
 */
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
  const z0 = Math.max(0, Math.floor(cz - reach));
  const z1 = Math.min(grid.sz - 1, Math.ceil(cz + reach));
  const from = side > 0 ? grid.sx - 1 : 0;
  const step = side > 0 ? -1 : 1;
  const rows = Math.ceil(reach);

  const outermost = (y: number, z: number): number => {
    if (y < 0 || y >= grid.sy) return -1;
    for (let x = from; x >= 0 && x < grid.sx; x += step) {
      if (grid.has(x, y, z)) return x;
    }
    return -1;
  };

  // Snap the centre row to the widest point of the section. Configs give the
  // marking height in metres, and one height cannot sit on the flank of every
  // airframe: on a jet whose forward fuselage is shallow it lands on the
  // shoulder, the walk climbs onto the upper deck, and half the roundel ends
  // up visible from directly above. The widest row is the flank by definition.
  const zMid = Math.min(grid.sz - 1, Math.max(0, Math.round(cz)));
  const search = Math.round(reach * 0.6);
  let yc = Math.round(cy);
  let widest = -1;
  for (let y = Math.round(cy) - search; y <= Math.round(cy) + search; y++) {
    const x = outermost(y, zMid);
    if (x < 0 || !allow(grid.partAt(x, y, zMid))) continue;
    const out = side > 0 ? x : grid.sx - 1 - x;
    if (out <= widest) continue;
    widest = out;
    yc = y;
  }

  for (let z = z0; z <= z1; z++) {
    const u = z - cz;
    const xc = outermost(yc, z);
    if (xc < 0) continue;
    for (const dir of [1, -1] as const) {
      let xPrev = xc;
      let s = 0;
      // Downward starts one row out; the centre row belongs to the upward pass.
      for (let k = dir > 0 ? 0 : 1; k <= rows; k++) {
        const y = yc + dir * k;
        const x = outermost(y, z);
        if (x < 0) break;
        if (k > 0) s += Math.hypot(1, x - xPrev);
        xPrev = x;
        if (s > reach) break;
        const pal = mask(u, dir * s);
        if (pal === 0) continue;
        if (allow(grid.partAt(x, y, z))) grid.paint(x, y, z, pal, part);
      }
    }
  }
}

export const anyPart: PartFilter = () => true;
