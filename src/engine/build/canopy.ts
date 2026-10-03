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
  // Interior unit. The furniture was drawn in voxels at about nine to the
  // metre; scaled by this it keeps its size in metres when the cockpit is
  // built finer, for the cockpit-mode section, and is unchanged otherwise.
  const u = Math.max(1, ctx.vpm / 9);

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
    [ctx.gx(0) + hw * 0.8, yBase - tubDepth + u, zFront],
    { pal: tub, part: ctx.p('cockpit') },
  );

  const seats = p.seats ?? 1;
  const span = zFront - zBack;
  for (let s = 0; s < seats; s++) {
    const t = seats === 1 ? 0.42 : 0.26 + s * 0.4;
    const zSeat = zBack + span * t;
    const seatW = Math.max(1.5 * u, hw * 0.46);
    const floor = yBase - tubDepth;
    // Pan, back and headrest.
    fillBox(
      grid,
      [ctx.gx(0) - seatW, floor + u, zSeat - 1.2 * u],
      [ctx.gx(0) + seatW, floor + 2 * u, zSeat + 1.6 * u],
      { pal: seatPal, part: ctx.p('seat') },
    );
    fillBox(
      grid,
      [ctx.gx(0) - seatW, floor + u, zSeat - 2.4 * u],
      [ctx.gx(0) + seatW, yBase + domeH * 0.42, zSeat - 1.2 * u],
      { pal: seatPal, part: ctx.p('seat') },
    );
    fillBox(
      grid,
      [ctx.gx(0) - seatW * 0.7, yBase + domeH * 0.42, zSeat - 2.3 * u],
      [ctx.gx(0) + seatW * 0.7, yBase + domeH * 0.62, zSeat - 1.3 * u],
      { pal: seatPal, part: ctx.p('seat') },
    );
    // Control stick.
    fillBox(
      grid,
      [ctx.gx(0) - 0.5 * u, floor + 2 * u, zSeat + 2.2 * u],
      [ctx.gx(0) + 0.5 * u, floor + 4 * u, zSeat + 3 * u],
      { pal: ctx.pal.idx('frame'), part: ctx.p('cockpit') },
    );

    buildInstrumentPanel(ctx, {
      u,
      zPanel: zSeat + 3.4 * u,
      yBase,
      hw,
      tubDepth,
      tier: p.tier,
      tub,
      hudPal,
      hudDim,
      // Seats run aft to forward, so the last one is the front cockpit. Only
      // the pilot up front looks through a sight or a HUD.
      front: s === seats - 1,
      hud: p.hud !== false,
      panoramic: p.panoramic === true,
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
  /** Interior unit; see buildCanopy. */
  u: number;
  zPanel: number;
  yBase: number;
  hw: number;
  tubDepth: number;
  tier: CanopyParams['tier'];
  tub: number;
  hudPal: number;
  hudDim: number;
  front: boolean;
  hud: boolean;
  panoramic: boolean;
}

/**
 * Instrument fit by era, on the aft face of the panel:
 *   analog  -- rows of dials, and a reflector gunsight (gen 1 and 2)
 *   mixed   -- dials with the first small screen among them (gen 3)
 *   mfd     -- three multifunction displays and a HUD (gen 4 and 4.5)
 *   glass   -- large displays, or one panoramic touchscreen, HUD optional
 * Dials are pale faces; screens carry the dark display colour on their own
 * part, so cockpit mode can light them without touching anything else.
 */
function buildInstrumentPanel(ctx: BuildCtx, a: PanelArgs): void {
  const { grid } = ctx;
  const x0 = ctx.gx(0);
  const u = a.u;
  const panelY0 = a.yBase - a.tubDepth + 2 * u;
  const panelY1 = a.yBase + u;
  const w = a.hw * 0.72;
  const gauge = ctx.pal.idx('gauge');
  const screen = ctx.pal.idx('screen');
  const cockpit = ctx.p('cockpit');
  const display = ctx.p('display');

  fillBox(grid, [x0 - w, panelY0, a.zPanel], [x0 + w, panelY1, a.zPanel + 1.2 * u], {
    pal: a.tub,
    part: cockpit,
  });

  // A face on the panel's aft side, centred at (dx, y).
  const face = (dx: number, y: number, hx: number, hy: number, pal: number, part: number) =>
    fillBox(grid, [x0 + dx - hx * u, y - hy * u, a.zPanel - 0.4 * u], [x0 + dx + hx * u, y + hy * u, a.zPanel + 0.2 * u], {
      pal,
      part,
    });
  // A round dial: the face built a row at a time, each row as wide as the
  // circle is there. Below about three voxels across it degrades to a square,
  // which is all a coarse airframe can show anyway.
  const dial = (dx: number, y: number) => {
    const r = 0.6 * u;
    for (let dy = -r; dy <= r; dy += 0.5) {
      const half = Math.sqrt(Math.max(0, r * r - dy * dy));
      if (half < 0.5) continue;
      fillBox(grid, [x0 + dx - half, y + dy - 0.25, a.zPanel - 0.4 * u], [x0 + dx + half, y + dy + 0.25, a.zPanel + 0.2 * u], {
        pal: gauge,
        part: cockpit,
      });
    }
  };
  // Dials sit on a pitch in interior units, so a finer build keeps the gap
  // between them instead of growing them into one pale slab.
  const pitch = Math.max(w * 0.55, 1.7 * u);

  // Faces sit just under the coaming, where a real panel carries them. Hung
  // off the tub floor instead they ended up half a metre down in the dark,
  // under the glare shield, where no view of the cockpit could reach them.
  const hi = panelY1 - 1.3 * u;
  const lo = panelY1 - 2.8 * u;

  switch (a.tier) {
    case 'analog':
      for (const dx of [-pitch, 0, pitch]) {
        dial(dx, lo);
        dial(dx, hi);
      }
      break;
    case 'mixed':
      for (const dx of [-pitch * 1.13, pitch * 1.13]) {
        dial(dx, lo);
        dial(dx, hi);
      }
      // The first small screen, among the dials.
      face(0, (lo + hi) / 2, 0.9, 1.0, screen, display);
      break;
    case 'mfd':
      for (const dx of [-w * 0.55, 0, w * 0.55]) face(dx, (lo + hi) / 2, 1.0, 1.2, screen, display);
      break;
    case 'glass':
      if (a.panoramic) {
        face(0, (lo + hi) / 2, (w * 0.9) / u, 1.3, screen, display);
      } else {
        for (const dx of [-w * 0.5, w * 0.5]) face(dx, (lo + hi) / 2, (w * 0.38) / u, 1.3, screen, display);
      }
      break;
  }

  if (!a.front) return;
  const symbology = ctx.p('hud-symbology');

  // Third-generation cockpits still aimed through an optical sight rather
  // than a head-up display, so they share the reflector sight.
  if (a.tier === 'analog' || a.tier === 'mixed') {
    // Reflector gunsight. Dim glass at rest, because it stands above the
    // coaming and the lit colour would show from outside. Its symbology sits
    // one voxel aft, hidden until cockpit mode.
    fillBox(grid, [x0 - u, a.yBase + u, a.zPanel - 1.4 * u], [x0 + u, a.yBase + 2.6 * u, a.zPanel - 0.9 * u], {
      pal: a.hudDim,
      part: ctx.p('hud'),
    });
    fillBox(grid, [x0 - 0.6 * u, a.yBase + 1.3 * u, a.zPanel - 1.9 * u], [x0 + 0.6 * u, a.yBase + 2.3 * u, a.zPanel - 1.4 * u], {
      pal: a.hudPal,
      part: symbology,
    });
    return;
  }
  if (!a.hud) return;

  // Head-up display: a combiner pane on a short pedestal. Kept low and thin:
  // at the old height it stood well clear of the coaming, and in the full HUD
  // colour it read from outside as a saturated green cube on the nose. The
  // pane carries the dim slot; the lit symbology is a separate part behind it.
  fillBox(grid, [x0 - 0.6 * u, a.yBase + 0.6 * u, a.zPanel - 1.5 * u], [x0 + 0.6 * u, a.yBase + 1.4 * u, a.zPanel - u], {
    pal: ctx.pal.idx('frame'),
    part: ctx.p('hud'),
  });
  fillBox(
    grid,
    [x0 - a.hw * 0.28, a.yBase + 1.4 * u, a.zPanel - 1.7 * u],
    [x0 + a.hw * 0.28, a.yBase + 3.0 * u, a.zPanel - 1.3 * u],
    { pal: a.hudDim, part: ctx.p('hud') },
  );
  fillBox(
    grid,
    [x0 - a.hw * 0.2, a.yBase + 1.6 * u, a.zPanel - 2.1 * u],
    [x0 + a.hw * 0.2, a.yBase + 2.8 * u, a.zPanel - 1.7 * u],
    { pal: a.hudPal, part: symbology },
  );
}
