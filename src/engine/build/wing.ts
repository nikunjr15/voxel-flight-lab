import { clamp, DEG, V3 } from '../util/math';
import { fillLoftZ, fillPlanform, makeFrame, Planform, planformStation } from '../voxel/rasterize';
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
    const part = ctx.p(side > 0 ? partR : partL);
    const rootPos: V3 = [ctx.gx(rootOffset * side), y, z];

    if (!p.outerDihedral) {
      const frame = makeFrame(
        rootPos,
        [side * Math.cos(dihedral), Math.sin(dihedral), 0],
        CHORD_AFT,
      );
      fillPlanform(ctx.grid, frame, plan, { pal, part });
      continue;
    }

    // Cranked dihedral: inner panel at `dihedral`, outer panel at `angle`,
    // joined at the break. Both halves read their taper from the true root,
    // so the leading edge stays continuous across the joint.
    const breakAt = plan.span * clamp(p.outerDihedral.at, 0.05, 0.95);
    const outer = p.outerDihedral.angle * DEG;

    const innerFrame = makeFrame(
      rootPos,
      [side * Math.cos(dihedral), Math.sin(dihedral), 0],
      CHORD_AFT,
    );
    fillPlanform(ctx.grid, innerFrame, { ...plan, spanTo: breakAt }, { pal, part });

    const leBreak = planformStation(plan, breakAt).le;
    const breakPos: V3 = [
      rootPos[0] + side * Math.cos(dihedral) * breakAt,
      rootPos[1] + Math.sin(dihedral) * breakAt,
      rootPos[2] - leBreak,
    ];
    const outerFrame = makeFrame(
      breakPos,
      [side * Math.cos(outer), Math.sin(outer), 0],
      CHORD_AFT,
    );
    fillPlanform(ctx.grid, outerFrame, { ...plan, spanFrom: breakAt }, { pal, part });
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
 * Variable-geometry wing: a fixed glove plus an outer panel that pivots.
 *
 * The panel is expressed as an ordinary planform rather than a rotated frame,
 * because `makeFrame` orthonormalises the span axis against the chord axis and
 * would cancel the sweep. Sweeping a panel back shortens its lateral span by
 * cos(theta) and lengthens its streamwise chord by 1/cos(theta), which is what
 * the two scale factors below reproduce.
 */
export function buildVariableWing(
  ctx: BuildCtx,
  p: SurfaceParams,
  partR: PartId,
  partL: PartId,
  sweepDeg?: number,
): void {
  const vg = p.vg;
  if (!vg) {
    buildSurfacePair(ctx, p, partR, partL);
    return;
  }
  const rootOffset = p.rootOffset ?? 0;
  const dihedral = (p.dihedral ?? 0) * DEG;
  const pal = ctx.slot(p.palette);
  const z = ctx.gzAft(p.atZ);
  const y = ctx.gy(p.atY);
  const theta = clamp(sweepDeg ?? vg.sweepMin, vg.sweepMin, vg.sweepMax) * DEG;
  const cosT = Math.max(0.2, Math.cos(theta));

  for (const side of [1, -1] as const) {
    const part = ctx.p(side > 0 ? partR : partL);

    // Fixed glove, from the fuselage side out to the pivot.
    const gloveSpan = vg.pivotX - rootOffset;
    if (gloveSpan > 0) {
      const gloveFrame = makeFrame(
        [ctx.gx(rootOffset * side), y, z],
        [side * Math.cos(dihedral), Math.sin(dihedral), 0],
        CHORD_AFT,
      );
      fillPlanform(
        ctx.grid,
        gloveFrame,
        {
          span: ctx.v(gloveSpan),
          rootChord: ctx.v(vg.gloveChord),
          tipChord: ctx.v(vg.gloveChord * 0.92),
          sweep: vg.gloveSweep * DEG,
          thickness: ctx.v(p.thickness * 1.25),
          tipThicknessRatio: 0.85,
        },
        { pal, part },
      );
    }

    // Movable panel, hinged at the pivot.
    const pivotLE = Math.tan(vg.gloveSweep * DEG) * ctx.v(gloveSpan) * 0.35;
    const panelFrame = makeFrame(
      [ctx.gx(vg.pivotX * side), y, z - pivotLE],
      [side * Math.cos(dihedral), Math.sin(dihedral), 0],
      CHORD_AFT,
    );
    fillPlanform(
      ctx.grid,
      panelFrame,
      {
        span: ctx.v(vg.panelSpan) * cosT,
        rootChord: ctx.v(vg.panelRootChord) / cosT,
        tipChord: ctx.v(vg.panelTipChord) / cosT,
        sweep: theta,
        thickness: ctx.v(p.thickness),
        tipThicknessRatio: p.tipThicknessRatio ?? 0.6,
        roundTip: p.roundTip,
      },
      { pal, part },
    );
  }
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
