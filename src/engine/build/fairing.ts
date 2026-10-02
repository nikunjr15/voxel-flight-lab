import { clamp, lerp } from '../util/math';
import { fillLoftZ } from '../voxel/rasterize';
import type { FairingParams } from '../../aircraft/types';
import type { BuildCtx } from './ctx';

/**
 * Lofted bodies blended onto the airframe. This is what carries the twin
 * engine nacelles of an F-15, Su-27 or MiG-29, where the "fuselage" is really
 * a centre section with two tunnels either side of it.
 */
export function buildFairings(ctx: BuildCtx, fairings: FairingParams[]): void {
  for (const f of fairings) {
    for (const side of f.mirror ? ([1, -1] as const) : ([1] as const)) {
      buildOne(ctx, f, side);
    }
  }
}

function buildOne(ctx: BuildCtx, f: FairingParams, side: 1 | -1): void {
  const cx = ctx.gx(f.at[0] * side);
  const cy = ctx.gy(f.at[1]);
  const zFront = ctx.gzAft(f.fromZ);
  const zBack = ctx.gzAft(f.toZ);

  fillLoftZ(
    ctx.grid,
    zBack,
    zFront,
    (z) => {
      // t = 0 at the front of the fairing, 1 at the back.
      const t = clamp((zFront - z) / Math.max(1e-6, zFront - zBack), 0, 1);
      const w = ctx.v(lerp(f.front[0], f.back[0], t));
      const h = ctx.v(lerp(f.front[1], f.back[1], t));
      if (w < 0.5 || h < 0.5) return null;
      return { cx, cy, w, h, e: f.exponent ?? 2.2 };
    },
    {
      pal: ctx.slot(f.palette),
      part: ctx.p(f.part ?? 'fuselage'),
      mode: f.under === false ? 'set' : 'fill-empty',
    },
  );
}
