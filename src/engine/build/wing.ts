import { DEG, V3 } from '../util/math';
import { fillLoftZ, fillPlanform, makeFrame, Planform } from '../voxel/rasterize';
import type { PartId } from '../voxel/parts';
import type { LerxParams, SurfaceParams } from '../../aircraft/types';
import type { BuildCtx } from './ctx';

function planformOf(ctx: BuildCtx, p: SurfaceParams, halfSpan: number): Planform {
  const span = ctx.v(halfSpan);
  return {
    span,
    rootChord: ctx.v(p.rootChord),
    tipChord: ctx.v(p.tipChord),
    sweep: p.sweep * DEG,
    thickness: ctx.v(p.thickness),
    tipThicknessRatio: p.tipThicknessRatio ?? 0.6,
    roundTip: p.roundTip,
    kink: p.kink
      ? {
          at: span * p.kink.at,
          chord: ctx.v(p.kink.chord),
          sweep: p.kink.sweep * DEG,
        }
      : undefined,
  };
}

/** Chord runs aft, and aft is -Z because the nose points at +Z. */
const CHORD_AFT: V3 = [0, 0, -1];

/** Wings, canards and stabilators: one mirrored pair, tagged per side. */
export function buildSurfacePair(
  ctx: BuildCtx,
  p: SurfaceParams,
  partR: PartId,
  partL: PartId,
): void {
  const rootOffset = p.rootOffset ?? 0;
  const halfSpan = p.span / 2 - rootOffset;
  if (halfSpan <= 0) return;
  const dihedral = (p.dihedral ?? 0) * DEG;
  const pal = ctx.slot(p.palette);
  const plan = planformOf(ctx, p, halfSpan);
  const z = ctx.gzAft(p.atZ);
  const y = ctx.gy(p.atY);

  for (const side of [1, -1] as const) {
    const frame = makeFrame(
      [ctx.gx(rootOffset * side), y, z],
      [side * Math.cos(dihedral), Math.sin(dihedral), 0],
      CHORD_AFT,
    );
    fillPlanform(ctx.grid, frame, plan, {
      pal,
      part: ctx.p(side > 0 ? partR : partL),
    });
  }
}

export interface FinOptions {
  /** -1 port, 0 centreline, 1 starboard. */
  side?: -1 | 0 | 1;
  /** Points below the waterline, for ventral fins. */
  down?: boolean;
}

/** A single vertical surface. `span` is read as height above the root. */
export function buildFin(
  ctx: BuildCtx,
  p: SurfaceParams,
  part: PartId,
  { side = 0, down = false }: FinOptions = {},
): void {
  const cant = (p.cant ?? 0) * DEG;
  const lateral = side === 0 ? 0 : (p.separation ?? 0) * side;
  const tilt = side === 0 ? 1 : side;
  const up = down ? -1 : 1;
  const spanDir: V3 = [tilt * Math.sin(cant), up * Math.cos(cant), 0];
  const frame = makeFrame([ctx.gx(lateral), ctx.gy(p.atY), ctx.gzAft(p.atZ)], spanDir, CHORD_AFT);
  fillPlanform(ctx.grid, frame, planformOf(ctx, p, p.span), {
    pal: ctx.slot(p.palette),
    part: ctx.p(part),
  });
}

/**
 * Leading-edge root extension. Built as a flat lens lofted along Z rather than
 * a planform, because its leading edge is a curve, not a straight sweep line.
 */
export function buildLerx(ctx: BuildCtx, p: LerxParams): void {
  const zFront = ctx.gzAft(p.fromZ);
  const zBack = ctx.gzAft(p.toZ);
  const span = Math.max(1e-6, p.toZ - p.fromZ);
  fillLoftZ(
    ctx.grid,
    zBack,
    zFront,
    (z) => {
      const t = Math.min(1, Math.max(0, (ctx.aftAt(z) - p.fromZ) / span));
      const w = ctx.v(p.maxHalfWidth) * Math.pow(t, 1.3);
      if (w < 0.6) return null;
      return { cx: ctx.gx(0), cy: ctx.gy(p.atY), w, h: ctx.v(p.thickness) * 0.5, e: 2 };
    },
    { pal: ctx.pal.idx('skin'), part: ctx.p('lerx'), mode: 'fill-empty' },
  );
}
