import { clamp, DEG } from '../util/math';
import { applyFill } from '../voxel/VoxelGrid';
import { fillBox, fillLoftZ } from '../voxel/rasterize';
import type { NozzleParams } from '../../aircraft/types';
import type { BuildCtx } from './ctx';

/**
 * Engine cores sit inside the fuselage. They stay visible to engine mode
 * because surface extraction treats a part boundary as an exposed face, so the
 * core keeps its outer shell even when it is buried in structure.
 */
export function buildEngine(ctx: BuildCtx, p: NozzleParams): void {
  if (p.engineFromZ === undefined) return;
  const radius = ctx.v(p.engineRadius ?? p.radius * 0.95);
  const metal = ctx.pal.idx('metal');
  const zFront = ctx.gzAft(p.engineFromZ);
  // Stop short of the exit plane: a core that runs all the way aft plugs the
  // nozzle throat, and the exhaust glow disappears behind it.
  const zBack = ctx.gzAft(p.atZ) + ctx.v(p.length ?? p.radius * 2.2) * 0.8;

  for (const cx of nozzleOffsets(ctx, p)) {
    fillLoftZ(
      ctx.grid,
      zBack,
      zFront,
      (z) => {
        const t = (z - zBack) / Math.max(1e-6, zFront - zBack);
        // Fat through the compressor, waisted at the turbine.
        const r = radius * (0.82 + 0.18 * Math.sin(Math.PI * t));
        return { cx, cy: ctx.gy(p.atY ?? 0), w: r, h: r, e: 2 };
      },
      { pal: metal, part: ctx.p('engine') },
    );
  }
}

export function nozzleOffsets(ctx: BuildCtx, p: NozzleParams): number[] {
  if (p.kind === 'twin-round' || (p.separation ?? 0) > 0) {
    const s = p.separation ?? 0;
    return [ctx.gx(-s), ctx.gx(s)];
  }
  return [ctx.gx(0)];
}

/** Triangle wave in 0..1 with `teeth` periods around the circumference. */
function sawtooth(phi: number, teeth: number): number {
  const t = ((phi / (Math.PI * 2)) * teeth) % 1;
  const u = t < 0 ? t + 1 : t;
  return 1 - Math.abs(u * 2 - 1);
}

/**
 * Round nozzle. Serrations are a real per-azimuth cut rather than a banded
 * approximation: the lip steps aft wherever a tooth is missing, which is what
 * makes a stealth exhaust read as one.
 */
function buildRoundNozzle(
  ctx: BuildCtx,
  p: NozzleParams,
  cx: number,
  cy: number,
  zExit: number,
  length: number,
): void {
  const { grid } = ctx;
  const radius = ctx.v(p.radius);
  const nozzlePal = ctx.pal.idx('nozzle');
  const exhaust = ctx.pal.idx('exhaust');
  const teeth = p.serrations ?? (p.kind === 'serrated' ? 8 : 0);
  const toothDepth = teeth > 0 ? Math.max(1.5, radius * 0.45) : 0;
  const part = ctx.p('nozzle');

  const z0 = Math.max(0, Math.floor(zExit));
  const z1 = Math.min(grid.sz - 1, Math.ceil(zExit + length));
  const inner = 0.74;

  // Clear whatever the fuselage left in the throat, so the exhaust reads as a
  // hole with a glow at the bottom rather than a dark plug.
  fillLoftZ(
    grid,
    zExit,
    zExit + length * 1.05,
    () => ({ cx, cy, w: radius * inner, h: radius * inner, e: 2 }),
    { pal: 0, part: 0, mode: 'erase' },
  );

  for (let z = z0; z <= z1; z++) {
    const t = clamp((z - zExit) / Math.max(1e-6, length), 0, 1);
    const r = radius * (1 - 0.1 * (1 - t));
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(grid.sx - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(grid.sy - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.hypot(dx, dy);
        if (d > r || d < r * inner) continue;
        if (teeth > 0) {
          // Cut back the lip in the gaps between teeth.
          const cut = toothDepth * (1 - sawtooth(Math.atan2(dy, dx), teeth));
          if (z < zExit + cut) continue;
        }
        // Only the exit ring forces itself over the skin. Further forward the
        // tube is buried inside the fuselage, and overwriting there punches
        // dark nozzle metal through the top of the tail.
        const mode = z <= zExit + toothDepth + 2 ? 'set' : 'fill-empty';
        applyFill(grid, mode, x, y, z, nozzlePal, part);
      }
    }
  }

  // Glowing throat just inside the exit plane.
  fillLoftZ(
    grid,
    zExit + toothDepth,
    zExit + toothDepth + 1,
    () => ({ cx, cy, w: radius * 0.72, h: radius * 0.72, e: 2 }),
    { pal: exhaust, part },
  );
}

/** Flat upper and lower petals, as used on a two-dimensional vectoring nozzle. */
function build2DNozzle(
  ctx: BuildCtx,
  p: NozzleParams,
  cx: number,
  cy: number,
  zExit: number,
  length: number,
): void {
  const { grid } = ctx;
  const radius = ctx.v(p.radius);
  const nozzlePal = ctx.pal.idx('nozzle');
  const exhaust = ctx.pal.idx('exhaust');
  const part = ctx.p('nozzle');
  const teeth = p.serrations ?? 0;
  const deflect = Math.tan((p.vector ?? 0) * DEG);

  const halfW = radius * 1.05;
  const halfH = radius * 0.72;
  const z0 = Math.max(0, Math.floor(zExit));
  const z1 = Math.min(grid.sz - 1, Math.ceil(zExit + length));
  const toothDepth = teeth > 0 ? Math.max(1.5, radius * 0.4) : 0;

  fillBox(
    grid,
    [cx - halfW * 0.74, cy - halfH * 0.62 - length * Math.abs(deflect), zExit],
    [cx + halfW * 0.74, cy + halfH * 0.62 + length * Math.abs(deflect), zExit + length * 1.05],
    { pal: 0, part: 0, mode: 'erase' },
  );

  for (let z = z0; z <= z1; z++) {
    const t = clamp((z - zExit) / Math.max(1e-6, length), 0, 1);
    // The petals pivot about the throat, so deflection grows toward the exit.
    const shift = -deflect * (1 - t) * length;
    const x0 = Math.max(0, Math.floor(cx - halfW));
    const x1 = Math.min(grid.sx - 1, Math.ceil(cx + halfW));
    const y0 = Math.max(0, Math.floor(cy + shift - halfH));
    const y1 = Math.min(grid.sy - 1, Math.ceil(cy + shift + halfH));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = Math.abs(x - cx) / halfW;
        const dy = Math.abs(y - (cy + shift)) / halfH;
        if (dx > 1 || dy > 1) continue;
        const onWall = dx > 0.74 || dy > 0.62;
        if (!onWall) continue;
        if (teeth > 0) {
          // Sawtooth across the span of the flat lip.
          const u = (x - cx) / halfW;
          const cut = toothDepth * (1 - sawtooth((u * 0.5 + 0.5) * Math.PI * 2, teeth));
          if (z < zExit + cut) continue;
        }
        // Only the exit ring forces itself over the skin. Further forward the
        // tube is buried inside the fuselage, and overwriting there punches
        // dark nozzle metal through the top of the tail.
        const mode = z <= zExit + toothDepth + 2 ? 'set' : 'fill-empty';
        applyFill(grid, mode, x, y, z, nozzlePal, part);
      }
    }
  }

  const shiftExit = -deflect * length;
  fillBox(
    grid,
    [cx - halfW * 0.72, cy + shiftExit - halfH * 0.6, zExit + toothDepth],
    [cx + halfW * 0.72, cy + shiftExit + halfH * 0.6, zExit + toothDepth + 1],
    { pal: exhaust, part },
  );
}

export function buildNozzle(ctx: BuildCtx, p: NozzleParams): void {
  const length = ctx.v(p.length ?? p.radius * 2.2);
  const cy = ctx.gy(p.atY ?? 0);
  const zExit = ctx.gzAft(p.atZ);

  for (const cx of nozzleOffsets(ctx, p)) {
    if (p.kind === 'vectoring-2d') build2DNozzle(ctx, p, cx, cy, zExit, length);
    else buildRoundNozzle(ctx, p, cx, cy, zExit, length);
  }
}
