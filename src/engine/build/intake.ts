import { fillLoftZ } from '../voxel/rasterize';
import type { PartId } from '../voxel/parts';
import type { IntakeParams } from '../../aircraft/types';
import type { BuildCtx } from './ctx';

const SIDE_KINDS: IntakeParams['kind'][] = ['side-rect', 'side-half-cone', 'caret', 'dsi'];

/**
 * Intakes are built as an outer body, a bored-out throat and a duct wall that
 * runs aft. The bore matters beyond looks: engine mode traces airflow along it.
 */
export function buildIntake(ctx: BuildCtx, p: IntakeParams, ductToZ: number): void {
  const isSide = SIDE_KINDS.includes(p.kind);
  const sides: number[] = isSide ? [-1, 1] : [0];

  for (const side of sides) {
    const part: PartId = side === 0 ? 'intake-c' : side > 0 ? 'intake-r' : 'intake-l';
    buildOne(ctx, p, side, part, ductToZ);
  }
}

function buildOne(
  ctx: BuildCtx,
  p: IntakeParams,
  side: number,
  part: PartId,
  ductToZ: number,
): void {
  const { grid } = ctx;
  const cx = ctx.gx((p.offsetX ?? 0) * (side === 0 ? 1 : side));
  const cy = ctx.gy(p.atY);
  const hw = ctx.v(p.halfWidth);
  const hh = ctx.v(p.height) * 0.5;
  const zLip = ctx.gzAft(p.atZ);
  const zAft = ctx.gzAft(p.atZ + p.length);
  const exponent = p.kind === 'caret' || p.kind === 'side-rect' ? 3.2 : 2.3;

  const skin = ctx.pal.idx('skin');
  const dark = ctx.pal.idx('skinDark');

  // Outer body, fairing into the belly aft so it does not end in a slab.
  // `fill-empty` keeps the fuselage dominant where the two overlap.
  fillLoftZ(
    grid,
    zAft,
    zLip,
    (z) => {
      const t = Math.min(1, Math.max(0, (zLip - z) / Math.max(1e-6, zLip - zAft)));
      const fade = 1 - 0.3 * t * t;
      return { cx, cy: cy + hh * 0.4 * t * t, w: hw * fade, h: hh * fade, e: exponent };
    },
    { pal: skin, part: ctx.p(part), mode: 'fill-empty' },
  );

  if (p.kind === 'dsi') {
    // Diverterless bump: a shallow blister just ahead of the lip.
    fillLoftZ(
      grid,
      zLip,
      zLip + ctx.v(0.55),
      (z) => {
        const t = (z - zLip) / Math.max(1e-6, ctx.v(0.55));
        const k = Math.sqrt(Math.max(0, 1 - t * t));
        return { cx, cy, w: hw * 0.92 * k, h: hh * 0.95 * k, e: exponent };
      },
      { pal: skin, part: ctx.p(part), mode: 'fill-empty' },
    );
  }

  if (p.duct === false) return;

  const zDuctEnd = ctx.gzAft(ductToZ);
  const bore = (z: number) => {
    // The throat contracts a little aft of the lip, as a real duct does.
    const t = Math.min(1, Math.max(0, (zLip - z) / Math.max(1e-6, zLip - zDuctEnd)));
    return 1 - 0.18 * t;
  };

  fillLoftZ(
    grid,
    zDuctEnd,
    zLip,
    (z) => ({ cx, cy, w: hw * 0.8 * bore(z), h: hh * 0.8 * bore(z), e: exponent }),
    { pal: dark, part: ctx.p('duct'), shell: 0.76, mode: 'set' },
  );
  fillLoftZ(
    grid,
    zDuctEnd,
    zLip,
    (z) => ({ cx, cy, w: hw * 0.6 * bore(z), h: hh * 0.6 * bore(z), e: exponent }),
    { pal: 0, part: 0, mode: 'erase' },
  );
}
