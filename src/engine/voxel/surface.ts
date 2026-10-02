import { MATERIAL_KINDS, MaterialKind } from './palette';
import { VoxelGrid } from './VoxelGrid';
import { mulberry32 } from '../util/rng';

export interface SurfaceBucket {
  kind: MaterialKind;
  count: number;
  /** Model-space metres, 3 per instance. */
  offsets: Float32Array;
  colors: Float32Array;
  parts: Float32Array;
  ao: Float32Array;
  scatter: Float32Array;
  seeds: Float32Array;
}

export interface SurfaceData {
  buckets: SurfaceBucket[];
  /** Surface voxels actually drawn. */
  total: number;
  /** Every filled cell, including the hidden interior. */
  solid: number;
  voxelSize: number;
  min: [number, number, number];
  max: [number, number, number];
  /** Model-space centroid per part index, 3 floats each. */
  partCentroids: Float32Array;
  partCounts: Uint32Array;
}

export interface ExtractOptions {
  /** Voxels per metre. */
  vpm: number;
  /** Grid cell that maps to model-space origin. */
  origin: [number, number, number];
  colors: Float32Array;
  kinds: Uint8Array;
  seed: number;
  partCount: number;
}

/** The six face directions, each with the two axes that span its 3x3 patch. */
const FACES: Array<{
  d: [number, number, number];
  u: [number, number, number];
  v: [number, number, number];
}> = [
  { d: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] },
  { d: [-1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] },
  { d: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { d: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { d: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { d: [0, 0, -1], u: [1, 0, 0], v: [0, 1, 0] },
];

/**
 * Occlusion for one voxel, measured only on the sides that are actually
 * exposed.
 *
 * Counting the whole 26-neighbourhood looks reasonable but is wrong: most of
 * those cells are *inside* the solid, so a thick wing section scored higher
 * than a thin one and a flat painted surface came out blotchy, shaded by its
 * own internal thickness. Here each open face looks at the 3x3 patch of the
 * layer just outside it, so a surface in clear air gets nothing and only a
 * real concavity -- a wing root, a voxel under a store or inside an intake --
 * goes dark.
 */
function faceOcclusion(grid: VoxelGrid, x: number, y: number, z: number): number {
  let worst = 0;
  for (let f = 0; f < FACES.length; f++) {
    const { d, u, v } = FACES[f];
    if (grid.has(x + d[0], y + d[1], z + d[2])) continue;
    let occ = 0;
    for (let a = -1; a <= 1; a++) {
      for (let b = -1; b <= 1; b++) {
        const nx = x + d[0] + u[0] * a + v[0] * b;
        const ny = y + d[1] + u[1] * a + v[1] * b;
        const nz = z + d[2] + u[2] * a + v[2] * b;
        if (grid.has(nx, ny, nz)) occ++;
      }
    }
    if (occ > worst) worst = occ;
  }
  return worst / 9;
}

/**
 * Keeps only voxels with at least one exposed face and bakes an occlusion
 * term. Dropping the interior typically removes 40-55% of the instances for
 * free, which is the difference between 20k and 10k draws.
 */
export function extractSurface(grid: VoxelGrid, opts: ExtractOptions): SurfaceData {
  const { vpm, origin, colors, kinds, partCount } = opts;
  const voxelSize = 1 / vpm;
  const rand = mulberry32(opts.seed);

  const kindOf = (pal: number): MaterialKind => MATERIAL_KINDS[kinds[pal] ?? 0] ?? 'opaque';

  const indices: number[][] = MATERIAL_KINDS.map(() => []);
  const partCounts = new Uint32Array(partCount);
  const centroidAcc = new Float64Array(partCount * 3);

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  let solid = 0;

  const { sx, sy, sz, data } = grid;

  for (let z = 0; z < sz; z++) {
    for (let y = 0; y < sy; y++) {
      for (let x = 0; x < sx; x++) {
        const i = (z * sy + y) * sx + x;
        const pal = data[i];
        if (pal === 0) continue;
        solid++;
        const part = grid.parts[i];
        // A face counts as exposed against air *or* against a different part.
        // Without the second rule an engine or cockpit buried in structure
        // would be culled entirely and engine mode would reveal nothing.
        const open = (ox: number, oy: number, oz: number): boolean => {
          if (!grid.inBounds(ox, oy, oz)) return true;
          const j = (oz * sy + oy) * sx + ox;
          return data[j] === 0 || grid.parts[j] !== part;
        };
        const exposed =
          open(x - 1, y, z) ||
          open(x + 1, y, z) ||
          open(x, y - 1, z) ||
          open(x, y + 1, z) ||
          open(x, y, z - 1) ||
          open(x, y, z + 1);
        if (!exposed) continue;
        const kindIdx = MATERIAL_KINDS.indexOf(kindOf(pal));
        indices[kindIdx < 0 ? 0 : kindIdx].push(i);
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (z < minZ) minZ = z;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        if (z > maxZ) maxZ = z;
      }
    }
  }

  const toModel = (x: number, y: number, z: number): [number, number, number] => [
    (x - origin[0]) * voxelSize,
    (y - origin[1]) * voxelSize,
    (z - origin[2]) * voxelSize,
  ];

  const minM = toModel(minX, minY, minZ);
  const maxM = toModel(maxX, maxY, maxZ);
  const cx = (minM[0] + maxM[0]) / 2;
  const cy = (minM[1] + maxM[1]) / 2;
  const cz = (minM[2] + maxM[2]) / 2;
  const radius = Math.max(
    Math.hypot(maxM[0] - cx, maxM[1] - cy, maxM[2] - cz),
    voxelSize * 4,
  );

  let total = 0;
  const buckets: SurfaceBucket[] = [];

  for (let k = 0; k < MATERIAL_KINDS.length; k++) {
    const list = indices[k];
    if (list.length === 0) continue;
    const n = list.length;
    total += n;
    const offsets = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const parts = new Float32Array(n);
    const ao = new Float32Array(n);
    const scatter = new Float32Array(n * 3);
    const seeds = new Float32Array(n);

    for (let j = 0; j < n; j++) {
      const i = list[j];
      const x = i % sx;
      const y = ((i - x) / sx) % sy;
      const z = Math.floor(i / (sx * sy));
      const [mx, my, mz] = toModel(x, y, z);
      offsets[j * 3] = mx;
      offsets[j * 3 + 1] = my;
      offsets[j * 3 + 2] = mz;

      const pal = data[i];
      col[j * 3] = colors[pal * 3];
      col[j * 3 + 1] = colors[pal * 3 + 1];
      col[j * 3 + 2] = colors[pal * 3 + 2];

      const part = grid.parts[i];
      parts[j] = part;
      partCounts[part]++;
      centroidAcc[part * 3] += mx;
      centroidAcc[part * 3 + 1] += my;
      centroidAcc[part * 3 + 2] += mz;

      ao[j] = faceOcclusion(grid, x, y, z);

      // Dispersal cloud: push outward from the centroid onto a jittered shell so
      // the scatter reads as the airframe blowing apart, not as random noise.
      const dx = mx - cx;
      const dy = my - cy;
      const dz = mz - cz;
      const len = Math.hypot(dx, dy, dz) || 1;
      const spread = radius * (1.35 + rand() * 1.5);
      scatter[j * 3] = cx + (dx / len) * spread + (rand() - 0.5) * radius * 0.8;
      scatter[j * 3 + 1] = cy + (dy / len) * spread * 0.55 + (rand() - 0.5) * radius * 0.7;
      scatter[j * 3 + 2] = cz + (dz / len) * spread + (rand() - 0.5) * radius * 0.8;
      seeds[j] = rand();
    }

    buckets.push({
      kind: MATERIAL_KINDS[k],
      count: n,
      offsets,
      colors: col,
      parts,
      ao,
      scatter,
      seeds,
    });
  }

  const partCentroids = new Float32Array(partCount * 3);
  for (let p = 0; p < partCount; p++) {
    const c = partCounts[p];
    if (c === 0) continue;
    partCentroids[p * 3] = centroidAcc[p * 3] / c;
    partCentroids[p * 3 + 1] = centroidAcc[p * 3 + 1] / c;
    partCentroids[p * 3 + 2] = centroidAcc[p * 3 + 2] / c;
  }

  return {
    buckets,
    total,
    solid,
    voxelSize,
    min: minM,
    max: maxM,
    partCentroids,
    partCounts,
  };
}
