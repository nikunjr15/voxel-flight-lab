import { DEG } from '../util/math';
import { fillBox, fillFrame, fillLoftZ, makeFrame } from '../voxel/rasterize';
import type { BayParams, StoreParams, SurfaceParams } from '../../aircraft/types';
import { wingChordZ } from './planform';
import type { BuildCtx } from './ctx';

/**
 * Pylons and the things that hang off them. Stores are their own part tags so
 * weapons mode can fly them onto the rails rather than rebuild the airframe.
 */
export function buildStores(
  ctx: BuildCtx,
  stores: StoreParams[],
  wing?: SurfaceParams,
): void {
  for (const s of stores) {
    const z = s.chord !== undefined && wing ? wingChordZ(wing, s.at[0], s.chord) : s.at[2];
    for (const side of s.mirror ? ([1, -1] as const) : ([1] as const)) {
      buildStore(ctx, s, side, z);
    }
  }
}

function buildStore(ctx: BuildCtx, s: StoreParams, side: 1 | -1, zAft: number): void {
  const { grid } = ctx;
  const cx = ctx.gx(s.at[0] * side);
  const cy = ctx.gy(s.at[1]);
  const zMid = ctx.gzAft(zAft);
  const half = ctx.v(s.length) * 0.5;
  const r = Math.max(1, ctx.v(s.radius));
  const body = ctx.slot(s.palette, 'store');
  const pylonPal = ctx.pal.idx('pylon');
  const storePart = ctx.p('store');

  if (s.kind === 'rail') {
    fillBox(grid, [cx - r, cy - r * 0.6, zMid - half], [cx + r, cy + r * 0.6, zMid + half], {
      pal: body,
      part: ctx.p('wingtip-rail'),
    });
    return;
  }

  // Body: a tube with an ogive nose and a tapered tail.
  fillLoftZ(
    grid,
    zMid - half,
    zMid + half,
    (z) => {
      const t = (z - (zMid - half)) / Math.max(1e-6, half * 2);
      // t = 0 at the tail, 1 at the nose.
      let k = 1;
      if (t > 0.78) k = Math.sqrt(Math.max(0, 1 - ((t - 0.78) / 0.22) ** 2));
      else if (t < 0.12) k = 0.72 + (t / 0.12) * 0.28;
      const rr = r * k;
      if (rr < 0.5) return null;
      return { cx, cy, w: rr, h: rr, e: 2 };
    },
    { pal: body, part: storePart },
  );

  const finSpan = s.fins ?? (s.kind === 'tank' ? 0 : 4);
  if (finSpan > 0) {
    const fin = ctx.v(s.radius) * 1.7;
    for (const roll of [0, 90]) {
      const a = roll * DEG;
      const frame = makeFrame(
        [cx, cy, zMid - half + ctx.v(s.length) * 0.16],
        [Math.cos(a), Math.sin(a), 0],
        [0, 0, -1],
      );
      const len = ctx.v(s.length) * 0.22;
      fillFrame(
        grid,
        frame,
        [-fin, -0.6, 0],
        [fin, 0.6, len],
        (lx, ly, lz) => Math.abs(lx) <= fin * (1 - lz / (len * 1.6)) && Math.abs(ly) <= 0.6,
        { pal: body, part: storePart },
      );
    }
  }

  if (s.pylon) {
    const h = ctx.v(s.pylon.height);
    const c = ctx.v(s.pylon.chord) * 0.5;
    fillBox(grid, [cx - 0.8, cy + r * 0.5, zMid - c], [cx + 0.8, cy + r * 0.5 + h, zMid + c], {
      pal: pylonPal,
      part: ctx.p('pylon'),
    });
  }
}

/**
 * Internal weapons bay. The cavity is carved out and lined so engine and
 * weapons modes have something real to reveal, and each door is its own part
 * so it can swing without a rebuild.
 */
export function buildBays(ctx: BuildCtx, bays: BayParams[]): void {
  for (const bay of bays) buildBay(ctx, bay);
}

function buildBay(ctx: BuildCtx, bay: BayParams): void {
  const { grid } = ctx;
  const zA = ctx.gzAft(bay.toZ);
  const zB = ctx.gzAft(bay.fromZ);
  const hw = ctx.v(bay.halfWidth);
  const top = ctx.gy(bay.atY);
  const depth = ctx.v(bay.depth);
  const floor = top - depth;
  const lining = ctx.pal.shade('skinDark', 0.55);
  const doorPal = ctx.pal.idx('skin');

  // Cavity, then a one-voxel lining so the bay reads as a box, not a hole.
  fillBox(grid, [ctx.gx(0) - hw, floor, zA], [ctx.gx(0) + hw, top, zB], {
    pal: 0,
    part: 0,
    mode: 'erase',
  });
  fillBox(grid, [ctx.gx(0) - hw - 1, floor - 1, zA - 1], [ctx.gx(0) + hw + 1, floor, zB + 1], {
    pal: lining,
    part: ctx.p('bay'),
    mode: 'fill-empty',
  });
  for (const sx of [-1, 1]) {
    const x = ctx.gx(0) + sx * (hw + 0.5);
    fillBox(grid, [x - 0.5, floor, zA], [x + 0.5, top, zB], {
      pal: lining,
      part: ctx.p('bay'),
      mode: 'fill-empty',
    });
  }

  // Doors hinge at the outboard edge and swing down. At 0 the door lies flat
  // across the opening; at full open it hangs vertically from the hinge.
  const open = (bay.doorOpen ?? 0) * 95 * DEG;
  for (const side of [1, -1] as const) {
    const hinge: [number, number, number] = [ctx.gx(0) + side * hw, floor, zA];
    // Chord runs forward from zA, because the local axis is measured from the
    // hinge toward the front of the bay.
    const frame = makeFrame(
      hinge,
      [-side * Math.cos(open), -Math.sin(open), 0],
      [0, 0, 1],
    );
    fillFrame(
      grid,
      frame,
      [0, -0.8, 0],
      [hw, 0.8, zB - zA],
      (lx, ly) => lx >= 0 && lx <= hw && Math.abs(ly) <= 0.8,
      { pal: doorPal, part: ctx.p('bay-door') },
    );
  }
}
