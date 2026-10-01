import { fillBox, fillEllipsoid } from '../voxel/rasterize';
import type { BlockParams } from '../../aircraft/types';
import type { BuildCtx } from './ctx';

/** Small details that do not earn a dedicated builder: fairings, probes, rails. */
export function buildBlocks(ctx: BuildCtx, blocks: BlockParams[]): void {
  for (const b of blocks) {
    const sides = b.mirror ? [1, -1] : [1];
    for (const side of sides) {
      const cx = ctx.gx(b.at[0] * side);
      const cy = ctx.gy(b.at[1]);
      const cz = ctx.gzAft(b.at[2]);
      const hx = ctx.v(b.size[0]) * 0.5;
      const hy = ctx.v(b.size[1]) * 0.5;
      const hz = ctx.v(b.size[2]) * 0.5;
      const opts = { pal: ctx.slot(b.palette), part: ctx.p(b.part) };
      if (b.shape === 'box') {
        fillBox(ctx.grid, [cx - hx, cy - hy, cz - hz], [cx + hx, cy + hy, cz + hz], opts);
      } else {
        fillEllipsoid(ctx.grid, [cx, cy, cz], [hx, hy, hz], {
          ...opts,
          exponent: b.exponent ?? 2,
        });
      }
    }
  }
}
