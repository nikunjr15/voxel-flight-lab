import { clamp } from '../util/math';
import { Track } from '../util/spline';
import { fillLoftZ } from '../voxel/rasterize';
import type { FuselageParams } from '../../aircraft/types';
import type { BuildCtx } from './ctx';

/**
 * Lofts the fuselage from its cross-section stations. Monotone interpolation
 * keeps half-widths positive between stations, which a plain Catmull-Rom does
 * not, and a negative half-width rasterises as a hole in the skin.
 */
export function buildFuselage(ctx: BuildCtx, p: FuselageParams): void {
  const wT = new Track(p.stations.map((s) => ({ t: s.t, v: s.w })));
  const hT = new Track(p.stations.map((s) => ({ t: s.t, v: s.h })));
  const yT = new Track(p.stations.map((s) => ({ t: s.t, v: s.y ?? 0 })));
  const eT = new Track(p.stations.map((s) => ({ t: s.t, v: s.e ?? 2 })));

  const triT = new Track(p.stations.map((s) => ({ t: s.t, v: s.tri ?? 0 })));
  // Chining is interpolated like every other section parameter, so a config
  // can run the facets in behind the radome and out again ahead of the tail
  // without the body stepping where the shaping starts.
  const chined = p.stations.some((s) => (s.chine ?? 0) > 0);
  const chineT = new Track(p.stations.map((s) => ({ t: s.t, v: s.chine ?? 0 })));
  const chineYT = new Track(p.stations.map((s) => ({ t: s.t, v: s.chineY ?? 0.45 })));
  const chineTopT = new Track(p.stations.map((s) => ({ t: s.t, v: s.chineTop ?? 0.3 })));
  const chineBotT = new Track(p.stations.map((s) => ({ t: s.t, v: s.chineBottom ?? 0.5 })));
  const radomeTo = p.radomeTo ?? 0.07;
  const noseTo = p.noseTo ?? 0.3;

  const skin = ctx.pal.idx('skin');
  const dark = ctx.pal.idx('skinDark');

  const zNose = ctx.gzAft(0);

  // The radome is usually a darker dielectric cap, so it gets its own pass.
  const sample = (z: number) => {
    const t = clamp(ctx.aftAt(z) / p.length, 0, 1);
    const w = ctx.v(Math.max(wT.at(t), 0));
    const h = ctx.v(Math.max(hT.at(t), 0));
    if (w < 0.4 || h < 0.4) return null;
    return {
      cx: ctx.gx(0),
      cy: ctx.gy(yT.at(t)),
      w,
      h,
      e: clamp(eT.at(t), 1.6, 6),
      tri: clamp(triT.at(t), -1, 1),
      chine: chined ? clamp(chineT.at(t), 0, 1) : 0,
      chineY: clamp(chineYT.at(t), 0.1, 0.9),
      chineTop: clamp(chineTopT.at(t), 0.02, 1),
      chineBottom: clamp(chineBotT.at(t), 0.02, 1),
    };
  };

  fillLoftZ(ctx.grid, ctx.gzAft(p.length), ctx.gzAft(p.length * noseTo), sample, {
    pal: skin,
    part: ctx.p('fuselage'),
  });
  fillLoftZ(ctx.grid, ctx.gzAft(p.length * noseTo), ctx.gzAft(p.length * radomeTo), sample, {
    pal: skin,
    part: ctx.p('nose'),
  });
  fillLoftZ(ctx.grid, ctx.gzAft(p.length * radomeTo), zNose, sample, {
    pal: dark,
    part: ctx.p('radome'),
  });

  if (p.spine) {
    const { from, to, halfWidth, height } = p.spine;
    fillLoftZ(
      ctx.grid,
      ctx.gzAft(to),
      ctx.gzAft(from),
      (z) => {
        const aft = ctx.aftAt(z);
        const t = clamp((aft - from) / Math.max(1e-6, to - from), 0, 1);
        // Fairs in at both ends so the spine does not finish in a cliff.
        const fade = Math.pow(Math.sin(Math.PI * t), 0.5);
        const ft = clamp(aft / p.length, 0, 1);
        const deck = ctx.gy(yT.at(ft)) + ctx.v(Math.max(hT.at(ft), 0)) * 0.55;
        return {
          cx: ctx.gx(0),
          cy: deck,
          w: ctx.v(halfWidth) * fade,
          h: ctx.v(height) * fade + 0.5,
          e: 2.4,
        };
      },
      { pal: skin, part: ctx.p('spine'), mode: 'fill-empty' },
    );
  }
}
