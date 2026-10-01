import { clamp } from '../util/math';
import { fillBox, fillLoftZ } from '../voxel/rasterize';
import type { NacelleParams } from '../../aircraft/types';
import type { BuildCtx } from './ctx';

/**
 * A podded engine: annular intake lip at the front, bored-through duct, and an
 * exhaust at the back. Tagged `intake`, `duct`, `engine` and `nozzle` like a
 * buried engine, so engine mode treats a podded jet the same as an internal one.
 */
export function buildNacelles(ctx: BuildCtx, nacelles: NacelleParams[]): void {
  for (const n of nacelles) {
    for (const side of n.mirror ? ([1, -1] as const) : ([1] as const)) {
      buildOne(ctx, n, side);
    }
  }
}

function buildOne(ctx: BuildCtx, n: NacelleParams, side: 1 | -1): void {
  const { grid } = ctx;
  const cx = ctx.gx(n.at[0] * side);
  const cyBase = ctx.gy(n.at[1]);
  const half = ctx.v(n.length) * 0.5;
  const zMid = ctx.gzAft(n.at[2]);
  const zFront = zMid + half;
  const zBack = zMid - half;
  const r = Math.max(1.5, ctx.v(n.radius));
  const exhaustR = ctx.v(n.exhaustRadius ?? n.radius * 0.78);
  const droop = ctx.v(n.incidence ?? 0);

  const skin = ctx.pal.idx('skin');
  const dark = ctx.pal.idx('skinDark');
  const metal = ctx.pal.idx('metal');
  const exhaust = ctx.pal.idx('exhaust');
  const part = side > 0 ? ctx.p('intake-r') : ctx.p('intake-l');

  // Nose droop tilts the pod, so the centre shifts with station.
  const centreAt = (z: number): number => {
    const t = clamp((zFront - z) / Math.max(1e-6, zFront - zBack), 0, 1);
    return cyBase + droop * (0.5 - t);
  };

  // Outer body: cylindrical through the middle, rounded at both ends.
  fillLoftZ(
    grid,
    zBack,
    zFront,
    (z) => {
      const t = clamp((z - zBack) / Math.max(1e-6, zFront - zBack), 0, 1);
      let k = 1;
      if (t > 0.86) k = 0.82 + 0.18 * Math.sqrt(Math.max(0, 1 - ((t - 0.86) / 0.14) ** 2));
      else if (t < 0.18) k = 0.84 + (t / 0.18) * 0.16;
      return { cx, cy: centreAt(z), w: r * k, h: r * k, e: 2 };
    },
    { pal: skin, part },
  );

  // Duct: lined bore from the lip back to the turbine face. The bore is wide
  // relative to the pod, or at voxel scale the intake reads as a solid snout.
  const zDuctEnd = zBack + (zFront - zBack) * 0.3;
  fillLoftZ(
    grid,
    zDuctEnd,
    zFront,
    (z) => ({ cx, cy: centreAt(z), w: r * 0.84, h: r * 0.84, e: 2 }),
    { pal: dark, part: ctx.p('duct'), shell: 0.68 },
  );
  fillLoftZ(
    grid,
    zDuctEnd,
    zFront + 1,
    (z) => ({ cx, cy: centreAt(z), w: r * 0.6, h: r * 0.6, e: 2 }),
    { pal: 0, part: 0, mode: 'erase' },
  );
  // Lip ring, darker so the opening carries at a distance.
  fillLoftZ(
    grid,
    zFront - 1.4,
    zFront,
    (z) => ({ cx, cy: centreAt(z), w: r * 0.98, h: r * 0.98, e: 2 }),
    { pal: ctx.pal.shade('skinDark', 0.72), part, shell: 0.6 },
  );

  // Turbine face and exhaust.
  fillLoftZ(
    grid,
    zBack + 1,
    zDuctEnd,
    (z) => ({ cx, cy: centreAt(z), w: r * 0.6, h: r * 0.6, e: 2 }),
    { pal: metal, part: ctx.p('engine') },
  );
  fillLoftZ(
    grid,
    zBack,
    zBack + 1.4,
    (z) => ({ cx, cy: centreAt(z), w: exhaustR, h: exhaustR, e: 2 }),
    { pal: exhaust, part: ctx.p('nozzle') },
  );

  if (n.pylon && n.pylon > 0) {
    const h = ctx.v(n.pylon);
    const top = cyBase + r * 0.4 + h;
    fillBox(
      grid,
      [cx - 1, cyBase + r * 0.4, zMid - half * 0.45],
      [cx + 1, top, zMid + half * 0.45],
      { pal: skin, part: ctx.p('pylon'), mode: 'fill-empty' },
    );
  }
}
