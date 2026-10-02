import { applyFill, FillMode, VoxelGrid } from './VoxelGrid';
import { lerp, thicknessProfile, V3, vCross, vDot, vNorm, vSub } from '../util/math';

/** Orthonormal basis in grid space. ex = span, ey = thickness, ez = chord. */
export interface Frame {
  o: V3;
  ex: V3;
  ey: V3;
  ez: V3;
}

/** Builds a right-handed frame from a span direction and a chord direction. */
export function makeFrame(origin: V3, spanDir: V3, chordDir: V3): Frame {
  const ez = vNorm(chordDir);
  let ex = vNorm(spanDir);
  // Orthonormalise span against chord so a swept or canted surface stays square.
  const proj = vDot(ex, ez);
  ex = vNorm(vSub(ex, [ez[0] * proj, ez[1] * proj, ez[2] * proj]));
  const ey = vNorm(vCross(ez, ex));
  return { o: origin, ex, ey, ez };
}

export type InsideFn = (lx: number, ly: number, lz: number) => boolean;

export interface FillOptions {
  pal: number;
  part: number;
  mode?: FillMode;
}

/**
 * Rasterises any shape defined in a local frame. Iterating the world AABB and
 * inverse-transforming each cell avoids the holes a forward splat would leave
 * on canted surfaces, and the inverse of an orthonormal basis is just dots.
 */
export function fillFrame(
  grid: VoxelGrid,
  frame: Frame,
  localMin: V3,
  localMax: V3,
  inside: InsideFn,
  opts: FillOptions,
): void {
  const { o, ex, ey, ez } = frame;
  let x0 = Infinity;
  let y0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let z1 = -Infinity;

  for (let i = 0; i < 8; i++) {
    const lx = i & 1 ? localMax[0] : localMin[0];
    const ly = i & 2 ? localMax[1] : localMin[1];
    const lz = i & 4 ? localMax[2] : localMin[2];
    const wx = o[0] + ex[0] * lx + ey[0] * ly + ez[0] * lz;
    const wy = o[1] + ex[1] * lx + ey[1] * ly + ez[1] * lz;
    const wz = o[2] + ex[2] * lx + ey[2] * ly + ez[2] * lz;
    if (wx < x0) x0 = wx;
    if (wy < y0) y0 = wy;
    if (wz < z0) z0 = wz;
    if (wx > x1) x1 = wx;
    if (wy > y1) y1 = wy;
    if (wz > z1) z1 = wz;
  }

  const ix0 = Math.max(0, Math.floor(x0));
  const iy0 = Math.max(0, Math.floor(y0));
  const iz0 = Math.max(0, Math.floor(z0));
  const ix1 = Math.min(grid.sx - 1, Math.ceil(x1));
  const iy1 = Math.min(grid.sy - 1, Math.ceil(y1));
  const iz1 = Math.min(grid.sz - 1, Math.ceil(z1));
  const mode = opts.mode ?? 'set';

  for (let z = iz0; z <= iz1; z++) {
    const dz = z - o[2];
    for (let y = iy0; y <= iy1; y++) {
      const dy = y - o[1];
      for (let x = ix0; x <= ix1; x++) {
        const dx = x - o[0];
        const lx = dx * ex[0] + dy * ex[1] + dz * ex[2];
        if (lx < localMin[0] || lx > localMax[0]) continue;
        const ly = dx * ey[0] + dy * ey[1] + dz * ey[2];
        if (ly < localMin[1] || ly > localMax[1]) continue;
        const lz = dx * ez[0] + dy * ez[1] + dz * ez[2];
        if (lz < localMin[2] || lz > localMax[2]) continue;
        if (!inside(lx, ly, lz)) continue;
        applyFill(grid, mode, x, y, z, opts.pal, opts.part);
      }
    }
  }
}

/** Superellipse cross-section sampled per station along +Z. */
export interface LoftSample {
  cx: number;
  cy: number;
  w: number;
  h: number;
  /** 2 = ellipse, 3 to 5 = progressively boxier. */
  e?: number;
  /**
   * Triangular taper in -1..1. Positive narrows the section toward its
   * bottom, negative toward its top. Applied as a width scale per row, so it
   * composes with the superellipse exponent rather than replacing it.
   */
  tri?: number;
}

export interface LoftOptions extends FillOptions {
  /** Keep only the outer shell: cells whose normalised radius is above this. */
  shell?: number;
  /** Clip the section vertically, in grid units. */
  yMin?: number;
  yMax?: number;
}

export function fillLoftZ(
  grid: VoxelGrid,
  z0: number,
  z1: number,
  sample: (z: number) => LoftSample | null,
  opts: LoftOptions,
): void {
  const za = Math.max(0, Math.floor(Math.min(z0, z1)));
  const zb = Math.min(grid.sz - 1, Math.ceil(Math.max(z0, z1)));
  const mode = opts.mode ?? 'set';
  const shell = opts.shell ?? 0;
  const clipMin = opts.yMin ?? -Infinity;
  const clipMax = opts.yMax ?? Infinity;

  for (let z = za; z <= zb; z++) {
    const s = sample(z);
    if (!s) continue;
    const w = Math.max(s.w, 0.5);
    const h = Math.max(s.h, 0.5);
    const e = s.e ?? 2;
    const x0 = Math.max(0, Math.floor(s.cx - w));
    const x1 = Math.min(grid.sx - 1, Math.ceil(s.cx + w));
    const y0 = Math.max(0, Math.floor(Math.max(s.cy - h, clipMin)));
    const y1 = Math.min(grid.sy - 1, Math.ceil(Math.min(s.cy + h, clipMax)));
    const tri = s.tri ?? 0;
    for (let y = y0; y <= y1; y++) {
      const ny = Math.abs((y - s.cy) / h);
      const py = e === 2 ? ny * ny : Math.pow(ny, e);
      if (py > 1) continue;
      let wRow = w;
      if (tri !== 0) {
        // Height fraction, 0 at the bottom of the section and 1 at the top.
        const ty = (y - (s.cy - h)) / (2 * h);
        wRow = w * (tri > 0 ? 1 - tri * (1 - ty) : 1 + tri * ty);
        if (wRow < 0.5) continue;
      }
      for (let x = x0; x <= x1; x++) {
        const nx = Math.abs((x - s.cx) / wRow);
        const px = e === 2 ? nx * nx : Math.pow(nx, e);
        const r = px + py;
        if (r > 1) continue;
        if (shell > 0) {
          const rr = e === 2 ? Math.sqrt(r) : Math.pow(r, 1 / e);
          if (rr < shell) continue;
        }
        applyFill(grid, mode, x, y, z, opts.pal, opts.part);
      }
    }
  }
}

/** Lifting-surface planform. All values in grid units, angles in radians. */
export interface Planform {
  span: number;
  rootChord: number;
  tipChord: number;
  sweep: number;
  thickness: number;
  tipThicknessRatio?: number;
  rootInset?: number;
  kink?: { at: number; chord: number; sweep: number };
  /** Rounds the tip instead of cutting it square. */
  roundTip?: boolean;
  /**
   * Fills only the span band [spanFrom, spanTo], while taper and sweep stay
   * measured from the true root. Lets a surface be built in pieces -- an
   * inner panel and an outer one at a different dihedral -- without the
   * planform breaking at the joint.
   */
  spanFrom?: number;
  spanTo?: number;
}

export interface Station {
  le: number;
  chord: number;
}

export function planformStation(p: Planform, s: number): Station {
  return stationAt(p, s);
}

function stationAt(p: Planform, s: number): Station {
  if (p.kink && s > p.kink.at) {
    const leKink = Math.tan(p.sweep) * p.kink.at;
    const le = leKink + Math.tan(p.kink.sweep) * (s - p.kink.at);
    const t = (s - p.kink.at) / Math.max(1e-6, p.span - p.kink.at);
    return { le, chord: Math.max(1, lerp(p.kink.chord, p.tipChord, t)) };
  }
  const outer = p.kink ? p.kink.at : p.span;
  const t = outer <= 0 ? 0 : s / outer;
  const endChord = p.kink ? p.kink.chord : p.tipChord;
  return { le: Math.tan(p.sweep) * s, chord: Math.max(1, lerp(p.rootChord, endChord, t)) };
}

export function fillPlanform(grid: VoxelGrid, frame: Frame, p: Planform, opts: FillOptions): void {
  const inset = p.rootInset ?? 0;
  const tipRatio = p.tipThicknessRatio ?? 0.6;
  const from = p.spanFrom ?? 0;
  const to = Math.min(p.span, p.spanTo ?? p.span);
  // The frame origin sits at `from`, so leading edges are measured from there.
  const leBase = stationAt(p, from).le;
  const localSpan = Math.max(0, to - from);

  let zMin = Infinity;
  let zMax = -Infinity;
  for (let i = 0; i <= 24; i++) {
    const st = stationAt(p, from + (localSpan * i) / 24);
    const le = st.le - leBase;
    if (le < zMin) zMin = le;
    if (le + st.chord > zMax) zMax = le + st.chord;
  }
  const halfT = Math.max(p.thickness, 1.2) * 0.5 + 1;

  const inside: InsideFn = (lx, ly, lz) => {
    const s = from + lx;
    if (s < inset || s > to) return false;
    const st = stationAt(p, s);
    let chord = st.chord;
    let le = st.le - leBase;
    if (p.roundTip) {
      const radius = chord * 0.45;
      const over = s - (p.span - radius);
      if (over > 0) {
        const k = Math.sqrt(Math.max(0, 1 - (over / radius) * (over / radius)));
        const shrink = radius * (1 - k);
        le += shrink * 0.5;
        chord -= shrink;
        if (chord <= 0.6) return false;
      }
    }
    if (lz < le || lz > le + chord) return false;
    const c = (lz - le) / chord;
    const th = Math.max(
      p.thickness * thicknessProfile(c) * lerp(1, tipRatio, s / Math.max(1e-6, p.span)),
      1.0,
    );
    // Quantise to whole voxels. A fractional thickness puts the upper surface
    // at non-integer heights, so neighbouring columns round differently and
    // the top of the wing dithers between top faces and step faces -- which
    // reads from above as soft dirty patches on what should be flat paint.
    return Math.abs(ly) <= Math.round(th) * 0.5 + 1e-4;
  };

  fillFrame(grid, frame, [0, -halfT, zMin - 1], [localSpan, halfT, zMax + 1], inside, opts);
}

export function fillBox(grid: VoxelGrid, min: V3, max: V3, opts: FillOptions): void {
  const mode = opts.mode ?? 'set';
  const x0 = Math.max(0, Math.round(min[0]));
  const y0 = Math.max(0, Math.round(min[1]));
  const z0 = Math.max(0, Math.round(min[2]));
  const x1 = Math.min(grid.sx - 1, Math.round(max[0]));
  const y1 = Math.min(grid.sy - 1, Math.round(max[1]));
  const z1 = Math.min(grid.sz - 1, Math.round(max[2]));
  for (let z = z0; z <= z1; z++) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) applyFill(grid, mode, x, y, z, opts.pal, opts.part);
    }
  }
}

export function fillEllipsoid(
  grid: VoxelGrid,
  c: V3,
  r: V3,
  opts: FillOptions & { shell?: number; exponent?: number },
): void {
  const mode = opts.mode ?? 'set';
  const e = opts.exponent ?? 2;
  const x0 = Math.max(0, Math.floor(c[0] - r[0]));
  const y0 = Math.max(0, Math.floor(c[1] - r[1]));
  const z0 = Math.max(0, Math.floor(c[2] - r[2]));
  const x1 = Math.min(grid.sx - 1, Math.ceil(c[0] + r[0]));
  const y1 = Math.min(grid.sy - 1, Math.ceil(c[1] + r[1]));
  const z1 = Math.min(grid.sz - 1, Math.ceil(c[2] + r[2]));
  for (let z = z0; z <= z1; z++) {
    const nz = Math.pow(Math.abs((z - c[2]) / Math.max(0.5, r[2])), e);
    for (let y = y0; y <= y1; y++) {
      const ny = Math.pow(Math.abs((y - c[1]) / Math.max(0.5, r[1])), e);
      for (let x = x0; x <= x1; x++) {
        const nx = Math.pow(Math.abs((x - c[0]) / Math.max(0.5, r[0])), e);
        const v = nx + ny + nz;
        if (v > 1) continue;
        if (opts.shell && Math.pow(v, 1 / e) < opts.shell) continue;
        applyFill(grid, mode, x, y, z, opts.pal, opts.part);
      }
    }
  }
}

/** Axial ring or tube along +Z, used for nozzles, ducts and intake lips. */
export function fillTubeZ(
  grid: VoxelGrid,
  cx: number,
  cy: number,
  z0: number,
  z1: number,
  outer: (t: number) => number,
  innerRatio: number,
  opts: FillOptions & { squash?: number },
): void {
  const squash = opts.squash ?? 1;
  fillLoftZ(
    grid,
    z0,
    z1,
    (z) => {
      const t = (z - z0) / Math.max(1e-6, z1 - z0);
      const r = outer(t);
      return { cx, cy, w: r, h: r * squash, e: 2 };
    },
    { ...opts, shell: innerRatio },
  );
}
