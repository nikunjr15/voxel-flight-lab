import { clamp } from '../util/math';
import { Track } from '../util/spline';
import { fillBox, fillLoftZ } from '../voxel/rasterize';
import type { CanopyParams } from '../../aircraft/types';
import type { BuildCtx } from './ctx';

/**
 * Hollows the forward fuselage, furnishes a cockpit and caps it with a glass
 * shell on its own material layer, so cockpit mode can dissolve the glazing
 * without touching the structure underneath.
 */
export function buildCanopy(ctx: BuildCtx, p: CanopyParams): void {
  const { grid } = ctx;
  const zFront = ctx.gzAft(p.fromZ);
  const zBack = ctx.gzAft(p.toZ);
  const hw = ctx.v(p.halfWidth);
  const yBase = ctx.gy(p.baseY);
  const domeH = ctx.v(p.topY - p.baseY);
  const tubDepth = Math.max(2.5, ctx.v(0.9));

  const glass = ctx.pal.idx('glass');
  const frame = ctx.pal.idx('frame');
  const tub = ctx.pal.idx('cockpit');
  const seatPal = ctx.pal.idx('seat');
  const hudPal = ctx.pal.idx('hud');
  const hudDim = ctx.pal.idx('hudDim');

  // t = 0 at the aft fairing, 1 at the windscreen. Width and height need
  // separate curves: one shared curve gives a flat-topped box, not a bubble.
  const tOf = (z: number): number => clamp((z - zBack) / Math.max(1e-6, zFront - zBack), 0, 1);
  const widthT = new Track([
    { t: 0, v: 0.42 },
    { t: 0.25, v: 0.86 },
    { t: 0.55, v: 1.0 },
    { t: 0.85, v: 0.92 },
    { t: 1, v: 0.72 },
  ]);
  const heightT = new Track([
    { t: 0, v: 0.22 },
    { t: 0.3, v: 0.88 },
    { t: 0.6, v: 1.0 },
    { t: 0.85, v: 0.93 },
    { t: 1, v: 0.66 },
  ]);
  const profile = (z: number): number => widthT.at(tOf(z));
  const domeAt = (z: number): number => heightT.at(tOf(z));

  // 1. Clear everything the canopy occupies, above and below the sill.
  fillLoftZ(
    grid,
    zBack,
    zFront,
    (z) => ({ cx: ctx.gx(0), cy: yBase, w: hw * profile(z) * 1.1, h: domeH * domeAt(z) * 1.12, e: 2 }),
    { pal: 0, part: 0, mode: 'erase', yMin: yBase },
  );
  fillBox(
    grid,
    [ctx.gx(0) - hw * 0.8, yBase - tubDepth, zBack],
    [ctx.gx(0) + hw * 0.8, yBase - 1, zFront],
    { pal: 0, part: 0, mode: 'erase' },
  );

  // 2. Tub floor and side consoles.
  fillBox(
    grid,
    [ctx.gx(0) - hw * 0.8, yBase - tubDepth, zBack],
    [ctx.gx(0) + hw * 0.8, yBase - tubDepth + 1, zFront],
    { pal: tub, part: ctx.p('cockpit') },
  );

  const seats = p.seats ?? 1;
  const span = zFront - zBack;
  for (let s = 0; s < seats; s++) {
    const t = seats === 1 ? 0.42 : 0.26 + s * 0.4;
    const zSeat = zBack + span * t;
    const seatW = Math.max(1.5, hw * 0.46);
    // Pan, back and headrest.
    fillBox(
      grid,
      [ctx.gx(0) - seatW, yBase - tubDepth + 1, zSeat - 1.2],
      [ctx.gx(0) + seatW, yBase - tubDepth + 2, zSeat + 1.6],
      { pal: seatPal, part: ctx.p('seat') },
    );
    fillBox(
      grid,
      [ctx.gx(0) - seatW, yBase - tubDepth + 1, zSeat - 2.4],
      [ctx.gx(0) + seatW, yBase + domeH * 0.42, zSeat - 1.2],
      { pal: seatPal, part: ctx.p('seat') },
    );
    fillBox(
      grid,
      [ctx.gx(0) - seatW * 0.7, yBase + domeH * 0.42, zSeat - 2.3],
      [ctx.gx(0) + seatW * 0.7, yBase + domeH * 0.62, zSeat - 1.3],
      { pal: seatPal, part: ctx.p('seat') },
    );
    // Control stick.
    fillBox(
      grid,
      [ctx.gx(0) - 0.5, yBase - tubDepth + 2, zSeat + 2.2],
      [ctx.gx(0) + 0.5, yBase - tubDepth + 4, zSeat + 3],
      { pal: ctx.pal.idx('frame'), part: ctx.p('cockpit') },
    );

    buildInstrumentPanel(ctx, {
      zPanel: zSeat + 3.4,
      yBase,
      hw,
      tubDepth,
      tier: p.tier,
      tub,
      hudPal,
      hudDim,
    });
  }

  // 3. Glazing as a thin shell on its own material layer.
  fillLoftZ(
    grid,
    zBack,
    zFront,
    (z) => {
      const w = hw * profile(z);
      const h = domeH * domeAt(z);
      if (w < 0.8 || h < 0.8) return null;
      return { cx: ctx.gx(0), cy: yBase, w, h, e: 2.1 };
    },
    { pal: glass, part: ctx.p('canopy-glass'), shell: 0.78, yMin: yBase, mode: 'fill-empty' },
  );

  if (p.framed) {
    for (const z of [zBack, zFront - 1]) {
      fillLoftZ(
        grid,
        z,
        z + 1,
        (zz) => ({ cx: ctx.gx(0), cy: yBase, w: hw * profile(zz), h: domeH * domeAt(zz), e: 2.1 }),
        { pal: frame, part: ctx.p('canopy-frame'), shell: 0.7, yMin: yBase, mode: 'set' },
      );
    }
  }
}

interface PanelArgs {
  zPanel: number;
  yBase: number;
  hw: number;
  tubDepth: number;
  tier: CanopyParams['tier'];
  tub: number;
  hudPal: number;
  hudDim: number;
}

/**
 * Instrument fit by generation: a gunsight and dials, then multifunction
 * displays, then a wide-area display plus a helmet-cued HUD.
 */
function buildInstrumentPanel(ctx: BuildCtx, a: PanelArgs): void {
  const { grid } = ctx;
  const x0 = ctx.gx(0);
  const panelY0 = a.yBase - a.tubDepth + 2;
  const panelY1 = a.yBase + 1;
  const w = a.hw * 0.72;

  fillBox(grid, [x0 - w, panelY0, a.zPanel], [x0 + w, panelY1, a.zPanel + 1.2], {
    pal: a.tub,
    part: ctx.p('cockpit'),
  });

  if (a.tier === 'analog') {
    for (const dx of [-w * 0.55, 0, w * 0.55]) {
      fillBox(
        grid,
        [x0 + dx - 0.8, panelY0 + 1, a.zPanel - 0.4],
        [x0 + dx + 0.8, panelY0 + 2.6, a.zPanel + 0.2],
        { pal: a.hudPal, part: ctx.p('hud') },
      );
    }
    // Reflector gunsight. Dim for the same reason as the combiner: it stands
    // above the coaming, so the lit colour would show from outside.
    fillBox(
      grid,
      [x0 - 1, a.yBase + 1, a.zPanel - 1.4],
      [x0 + 1, a.yBase + 2.6, a.zPanel - 0.9],
      { pal: a.hudDim, part: ctx.p('hud') },
    );
    return;
  }

  if (a.tier === 'mfd') {
    for (const dx of [-w * 0.52, 0, w * 0.52]) {
      fillBox(
        grid,
        [x0 + dx - 1.2, panelY0 + 1, a.zPanel - 0.4],
        [x0 + dx + 1.2, panelY0 + 3.4, a.zPanel + 0.2],
        { pal: a.hudPal, part: ctx.p('hud') },
      );
    }
  } else {
    fillBox(
      grid,
      [x0 - w * 0.86, panelY0 + 1, a.zPanel - 0.4],
      [x0 + w * 0.86, panelY0 + 3.8, a.zPanel + 0.2],
      { pal: a.hudPal, part: ctx.p('hud') },
    );
  }

  // Head-up display: a combiner pane on a short pedestal. Kept low and thin:
  // at the old height it stood well clear of the coaming, and in the full HUD
  // colour it read from outside as a saturated green cube on the nose. The
  // pane carries the dim slot, so cockpit mode -- which raises emissive on the
  // hud part -- is the only place the symbology colour actually shows.
  fillBox(grid, [x0 - 0.6, a.yBase + 0.6, a.zPanel - 1.5], [x0 + 0.6, a.yBase + 1.4, a.zPanel - 1], {
    pal: ctx.pal.idx('frame'),
    part: ctx.p('hud'),
  });
  fillBox(
    grid,
    [x0 - a.hw * 0.28, a.yBase + 1.4, a.zPanel - 1.7],
    [x0 + a.hw * 0.28, a.yBase + 3.0, a.zPanel - 1.3],
    { pal: a.hudDim, part: ctx.p('hud') },
  );
}
