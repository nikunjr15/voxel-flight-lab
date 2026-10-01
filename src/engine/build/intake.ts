import { clamp, smoothstep } from '../util/math';
import { fillBox, fillLoftZ } from '../voxel/rasterize';
import type { PartId } from '../voxel/parts';
import type { IntakeParams } from '../../aircraft/types';
import type { BuildCtx } from './ctx';

const SIDE_KINDS: IntakeParams['kind'][] = ['side-rect', 'side-half-cone', 'caret', 'dsi'];

/** Centreline of a duct bore, sampled in grid space. */
export interface DuctPath {
  points: Array<[number, number, number]>;
}

/**
 * Intakes are built as an outer body, a bored-out throat and a duct wall
 * running aft. The bore matters beyond looks: engine mode traces airflow along
 * the path this returns.
 */
export function buildIntake(ctx: BuildCtx, p: IntakeParams, ductToZ: number): DuctPath[] {
  if (p.kind === 'nose') return [buildNoseIntake(ctx, p, ductToZ)];
  const isSide = SIDE_KINDS.includes(p.kind);
  const sides: number[] = isSide ? [-1, 1] : [0];
  const paths: DuctPath[] = [];

  for (const side of sides) {
    const part: PartId = side === 0 ? 'intake-c' : side > 0 ? 'intake-r' : 'intake-l';
    paths.push(buildOne(ctx, p, side, part, ductToZ));
  }
  return paths;
}

function buildOne(
  ctx: BuildCtx,
  p: IntakeParams,
  side: number,
  part: PartId,
  ductToZ: number,
): DuctPath {
  const { grid } = ctx;
  const lipX = (p.offsetX ?? 0) * (side === 0 ? 1 : side);
  const cx = ctx.gx(lipX);
  const cy = ctx.gy(p.atY);
  const hw = ctx.v(p.halfWidth);
  const hh = ctx.v(p.height) * 0.5;
  const zLip = ctx.gzAft(p.atZ);
  const zAft = ctx.gzAft(p.atZ + p.length);
  const exponent = p.kind === 'caret' || p.kind === 'side-rect' ? 3.2 : 2.3;

  const skin = ctx.pal.idx('skin');
  const dark = ctx.pal.idx('skinDark');

  // Outer body, fairing into the fuselage aft so it does not end in a slab.
  // `fill-empty` keeps the fuselage dominant where the two overlap.
  fillLoftZ(
    grid,
    zAft,
    zLip,
    (z) => {
      const t = clamp((zLip - z) / Math.max(1e-6, zLip - zAft), 0, 1);
      const fade = 1 - 0.3 * t * t;
      const drift = side === 0 ? hh * 0.4 * t * t : 0;
      return { cx, cy: cy + drift, w: hw * fade, h: hh * fade, e: exponent };
    },
    { pal: skin, part: ctx.p(part), mode: 'fill-empty' },
  );

  if (p.splitter && side !== 0) {
    // Boundary-layer splitter plate standing the lip off the fuselage.
    const gap = ctx.v(p.splitter);
    const inner = cx - Math.sign(lipX || side) * (hw + gap);
    fillBox(
      grid,
      [Math.min(cx, inner), cy - hh * 0.9, zAft],
      [Math.max(cx, inner), cy + hh * 0.9, zLip],
      { pal: dark, part: ctx.p(part), mode: 'fill-empty' },
    );
  }

  if (p.kind === 'side-half-cone' && p.shockCone) {
    // Half-cone shock body standing in the inboard corner of the lip, as on
    // the F-104 and the Mirage III. Only the outboard half is drawn, which is
    // what makes it read as a half cone rather than a spike.
    const len = ctx.v(p.shockCone.length);
    const rc = ctx.v(p.shockCone.radius);
    const inboard = Math.sign(lipX || side) * -1;
    const coneX = cx + inboard * hw * 0.55;
    const zTip = zLip + len * 0.55;
    fillLoftZ(
      grid,
      zTip - len,
      zTip,
      (z) => {
        const t = clamp((zTip - z) / Math.max(1e-6, len), 0, 1);
        const rr = rc * Math.pow(t, 0.7);
        if (rr < 0.5) return null;
        return { cx: coneX, cy, w: rr, h: rr, e: 2 };
      },
      { pal: ctx.pal.shade('skinDark', 0.8), part: ctx.p(part) },
    );
  }

  if (p.kind === 'dsi') {
    // Diverterless bump: a shallow blister just ahead of the lip, which is what
    // replaces the splitter plate on a stealth inlet.
    const bump = ctx.v(0.6);
    fillLoftZ(
      grid,
      zLip,
      zLip + bump,
      (z) => {
        const t = (z - zLip) / Math.max(1e-6, bump);
        const k = Math.sqrt(Math.max(0, 1 - t * t));
        return { cx, cy, w: hw * 0.95 * k, h: hh * 1.0 * k, e: exponent };
      },
      { pal: skin, part: ctx.p(part), mode: 'fill-empty' },
    );
  }

  if (p.duct === false) return { points: [[cx, cy, zLip]] };

  const zDuctEnd = ctx.gzAft(ductToZ);
  const endY = p.sDuct ? ctx.gy(p.sDuct.toY) : cy;
  const endX = p.sDuct?.toX !== undefined ? ctx.gx(p.sDuct.toX * (side === 0 ? 1 : side)) : cx;

  // S-bend: ease the bore centre from the lip to the compressor face so there
  // is no straight line of sight down the duct.
  const centreAt = (z: number): [number, number] => {
    const t = clamp((zLip - z) / Math.max(1e-6, zLip - zDuctEnd), 0, 1);
    const k = smoothstep(t);
    return [cx + (endX - cx) * k, cy + (endY - cy) * k];
  };
  const bore = (z: number): number => {
    const t = clamp((zLip - z) / Math.max(1e-6, zLip - zDuctEnd), 0, 1);
    return 1 - 0.18 * t;
  };

  fillLoftZ(
    grid,
    zDuctEnd,
    zLip,
    (z) => {
      const [bx, by] = centreAt(z);
      const k = bore(z);
      return { cx: bx, cy: by, w: hw * 0.8 * k, h: hh * 0.8 * k, e: exponent };
    },
    { pal: dark, part: ctx.p('duct'), shell: 0.76, mode: 'set' },
  );
  fillLoftZ(
    grid,
    zDuctEnd,
    zLip,
    (z) => {
      const [bx, by] = centreAt(z);
      const k = bore(z);
      return { cx: bx, cy: by, w: hw * 0.6 * k, h: hh * 0.6 * k, e: exponent };
    },
    { pal: 0, part: 0, mode: 'erase' },
  );

  const points: Array<[number, number, number]> = [];
  for (let i = 0; i <= 12; i++) {
    const z = zLip + ((zDuctEnd - zLip) * i) / 12;
    const [bx, by] = centreAt(z);
    points.push([bx, by, z]);
  }
  return { points };
}

/**
 * Nose intake: the whole forward fuselage is the lip. Bores an annulus back to
 * the engine and drops a centrebody in the middle, which on the real aircraft
 * is where the radar went.
 */
function buildNoseIntake(ctx: BuildCtx, p: IntakeParams, ductToZ: number): DuctPath {
  const { grid } = ctx;
  const cx = ctx.gx(0);
  const cy = ctx.gy(p.atY);
  const hw = ctx.v(p.halfWidth);
  const hh = ctx.v(p.height) * 0.5;
  const zLip = ctx.gzAft(p.atZ);
  const zDuctEnd = ctx.gzAft(ductToZ);
  const dark = ctx.pal.idx('skinDark');
  const lipPal = ctx.pal.shade('skinDark', 0.7);

  fillLoftZ(grid, zDuctEnd, zLip, () => ({ cx, cy, w: hw * 0.86, h: hh * 0.86, e: 2 }), {
    pal: dark,
    part: ctx.p('duct'),
    shell: 0.74,
  });
  // Erase forward past the lip as well: whatever the fuselage loft put in
  // front of the inlet would otherwise cap it, and the intake reads as solid.
  fillLoftZ(
    grid,
    zDuctEnd,
    ctx.gzAft(-0.4),
    () => ({ cx, cy, w: hw * 0.68, h: hh * 0.68, e: 2 }),
    { pal: 0, part: 0, mode: 'erase' },
  );
  // Lip ring, a shade darker so the opening reads at a distance.
  fillLoftZ(grid, zLip, zLip + 1.2, () => ({ cx, cy, w: hw, h: hh, e: 2 }), {
    pal: lipPal,
    part: ctx.p('intake-c'),
    shell: 0.62,
  });

  if (p.shockCone) {
    const len = ctx.v(p.shockCone.length);
    const r = ctx.v(p.shockCone.radius);
    // Mostly inside the duct, with only the tip proud of the lip: a cone that
    // stands a long way in front of the nose reads as a spike, not a radome.
    const zTip = zLip + len * 0.22;
    fillLoftZ(
      grid,
      zTip - len,
      zTip,
      (z) => {
        const t = clamp((zTip - z) / Math.max(1e-6, len), 0, 1);
        // Ogive rather than a straight cone: sharp tip, fuller base.
        const rr = r * Math.pow(t, 0.62);
        if (rr < 0.5) return null;
        return { cx, cy, w: rr, h: rr, e: 2 };
      },
      { pal: lipPal, part: ctx.p('intake-c') },
    );
  }

  const points: Array<[number, number, number]> = [];
  for (let i = 0; i <= 12; i++) points.push([cx, cy, zLip + ((zDuctEnd - zLip) * i) / 12]);
  return { points };
}
