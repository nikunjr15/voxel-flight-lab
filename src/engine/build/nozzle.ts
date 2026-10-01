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
  const offsets = nozzleOffsets(ctx, p);
  const zFront = ctx.gzAft(p.engineFromZ);
  const zBack = ctx.gzAft(p.atZ);

  for (const cx of offsets) {
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

function nozzleOffsets(ctx: BuildCtx, p: NozzleParams): number[] {
  if (p.kind === 'twin-round' || (p.separation ?? 0) > 0) {
    const s = p.separation ?? 0;
    return [ctx.gx(-s), ctx.gx(s)];
  }
  return [ctx.gx(0)];
}

export function buildNozzle(ctx: BuildCtx, p: NozzleParams): void {
  const { grid } = ctx;
  const length = ctx.v(p.length ?? p.radius * 2.2);
  const radius = ctx.v(p.radius);
  const cy = ctx.gy(p.atY ?? 0);
  const zExit = ctx.gzAft(p.atZ);
  const zIn = zExit + length;
  const nozzlePal = ctx.pal.idx('nozzle');
  const exhaust = ctx.pal.idx('exhaust');

  for (const cx of nozzleOffsets(ctx, p)) {
    if (p.kind === 'vectoring-2d') {
      // Flat upper and lower petals, narrower than they are wide.
      fillBox(
        grid,
        [cx - radius * 1.05, cy - radius * 0.72, zExit],
        [cx + radius * 1.05, cy + radius * 0.72, zIn],
        { pal: nozzlePal, part: ctx.p('nozzle') },
      );
      fillBox(
        grid,
        [cx - radius * 0.78, cy - radius * 0.46, zExit],
        [cx + radius * 0.78, cy + radius * 0.46, zIn - 1],
        { pal: 0, part: 0, mode: 'erase' },
      );
      fillBox(
        grid,
        [cx - radius * 0.78, cy - radius * 0.46, zExit],
        [cx + radius * 0.78, cy + radius * 0.46, zExit + 1],
        { pal: exhaust, part: ctx.p('nozzle') },
      );
      continue;
    }

    const serrated = p.kind === 'serrated';
    fillLoftZ(
      grid,
      zExit,
      zIn,
      (z) => {
        const t = (z - zExit) / Math.max(1e-6, length);
        let r = radius * (1 - 0.1 * (1 - t));
        if (serrated) {
          // Sawtooth trailing edge: the lip steps back in alternating bands.
          const band = Math.floor((z - zExit) % 2);
          r *= band === 0 ? 1 : 0.94;
        }
        return { cx, cy, w: r, h: r, e: 2 };
      },
      { pal: nozzlePal, part: ctx.p('nozzle'), shell: 0.74 },
    );

    fillLoftZ(
      grid,
      zExit,
      zExit + 1,
      () => ({ cx, cy, w: radius * 0.72, h: radius * 0.72, e: 2 }),
      { pal: exhaust, part: ctx.p('nozzle') },
    );
  }
}
