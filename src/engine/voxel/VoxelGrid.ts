/**
 * Dense voxel grid. Three parallel arrays keep per-cell cost at 3 bytes, which
 * for a typical 72 x 44 x 108 airframe grid is about 1 MB -- cheap enough to
 * build in a worker and throw away.
 *
 * Axes: +X starboard, +Y up, +Z forward (nose).
 */
export class VoxelGrid {
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
  readonly data: Uint16Array;
  readonly parts: Uint8Array;

  private _count = 0;
  minX = Infinity;
  minY = Infinity;
  minZ = Infinity;
  maxX = -Infinity;
  maxY = -Infinity;
  maxZ = -Infinity;

  constructor(sx: number, sy: number, sz: number) {
    this.sx = sx;
    this.sy = sy;
    this.sz = sz;
    this.data = new Uint16Array(sx * sy * sz);
    this.parts = new Uint8Array(sx * sy * sz);
  }

  get count(): number {
    return this._count;
  }

  index(x: number, y: number, z: number): number {
    return (z * this.sy + y) * this.sx + x;
  }

  inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && y >= 0 && z >= 0 && x < this.sx && y < this.sy && z < this.sz;
  }

  has(x: number, y: number, z: number): boolean {
    if (!this.inBounds(x, y, z)) return false;
    return this.data[this.index(x, y, z)] !== 0;
  }

  get(x: number, y: number, z: number): number {
    if (!this.inBounds(x, y, z)) return 0;
    return this.data[this.index(x, y, z)];
  }

  partAt(x: number, y: number, z: number): number {
    if (!this.inBounds(x, y, z)) return 0;
    return this.parts[this.index(x, y, z)];
  }

  set(x: number, y: number, z: number, pal: number, part: number): void {
    if (!this.inBounds(x, y, z)) return;
    const i = this.index(x, y, z);
    if (this.data[i] === 0) this._count++;
    this.data[i] = pal;
    this.parts[i] = part;
    if (x < this.minX) this.minX = x;
    if (y < this.minY) this.minY = y;
    if (z < this.minZ) this.minZ = z;
    if (x > this.maxX) this.maxX = x;
    if (y > this.maxY) this.maxY = y;
    if (z > this.maxZ) this.maxZ = z;
  }

  /** Writes only into air, so earlier structure wins overlaps. */
  setIfEmpty(x: number, y: number, z: number, pal: number, part: number): void {
    if (!this.inBounds(x, y, z)) return;
    if (this.data[this.index(x, y, z)] !== 0) return;
    this.set(x, y, z, pal, part);
  }

  /** Recolours existing structure only -- used for roundels and panel lines. */
  paint(x: number, y: number, z: number, pal: number, part = -1): void {
    if (!this.inBounds(x, y, z)) return;
    const i = this.index(x, y, z);
    if (this.data[i] === 0) return;
    this.data[i] = pal;
    if (part >= 0) this.parts[i] = part;
  }

  erase(x: number, y: number, z: number): void {
    if (!this.inBounds(x, y, z)) return;
    const i = this.index(x, y, z);
    if (this.data[i] === 0) return;
    this.data[i] = 0;
    this.parts[i] = 0;
    this._count--;
  }
}

/**
 * - set: write unconditionally.
 * - fill-empty: write only into air.
 * - paint: recolour only cells that are already solid.
 * - interior: recolour only solid cells enclosed across the section, i.e. with
 *   all four x and y neighbours solid. For internal parts that run fore and aft
 *   -- an engine core -- so they can never surface through a skin thinner than
 *   their own radius, while the end facing an intake duct (open in z) keeps
 *   its own colour.
 */
export type FillMode = 'set' | 'fill-empty' | 'paint' | 'erase' | 'interior';

export function applyFill(
  grid: VoxelGrid,
  mode: FillMode,
  x: number,
  y: number,
  z: number,
  pal: number,
  part: number,
): void {
  switch (mode) {
    case 'set':
      grid.set(x, y, z, pal, part);
      break;
    case 'fill-empty':
      grid.setIfEmpty(x, y, z, pal, part);
      break;
    case 'paint':
      grid.paint(x, y, z, pal, part);
      break;
    case 'erase':
      grid.erase(x, y, z);
      break;
    case 'interior':
      if (
        grid.has(x, y, z) &&
        grid.has(x + 1, y, z) &&
        grid.has(x - 1, y, z) &&
        grid.has(x, y + 1, z) &&
        grid.has(x, y - 1, z)
      ) {
        grid.paint(x, y, z, pal, part);
      }
      break;
  }
}
