import { Palette } from '../voxel/palette';
import { PART_COUNT } from '../voxel/parts';
import { VoxelGrid } from '../voxel/VoxelGrid';
import { extractSurface, SurfaceData } from '../voxel/surface';
import { hashString } from '../util/rng';
import { COUNTRIES } from '../../aircraft/countries';
import type { AircraftConfig } from '../../aircraft/types';
import { BuildCtx } from './ctx';
import { buildFuselage } from './fuselage';
import { buildFin, buildLerx, buildSurfacePair } from './wing';
import { buildCanopy } from './canopy';
import { buildIntake } from './intake';
import { buildEngine, buildNozzle } from './nozzle';
import { buildBlocks } from './blocks';
import { buildMarkings } from './markings';

export interface AssembleOptions {
  /** 1.0 desktop, 0.65 mobile, 0.5 low power. */
  density?: number;
  /** Voxels nose to tail at density 1.0. */
  targetLengthVoxels?: number;
}

export interface AssembleResult extends SurfaceData {
  id: string;
  buildMs: number;
  gridDims: [number, number, number];
}

/**
 * Turns one config into draw-ready instance buffers. Everything downstream --
 * modes, morphs, the live block count -- reads from this single output.
 */
export function assemble(config: AircraftConfig, opts: AssembleOptions = {}): AssembleResult {
  const t0 = performance.now();
  const density = opts.density ?? 1;
  const target = (opts.targetLengthVoxels ?? 128) * density;

  const g = config.geometry;
  const length = g.fuselage.length;
  const vpm = target / length;

  const sx = Math.ceil(g.bbox.span * vpm) + 10;
  const sy = Math.ceil(g.bbox.height * vpm) + 14;
  const sz = Math.ceil(length * vpm) + 10;
  const origin: [number, number, number] = [
    Math.floor(sx / 2),
    Math.floor(g.bbox.height * vpm * 0.42) + 7,
    Math.floor(sz / 2),
  ];

  const grid = new VoxelGrid(sx, sy, sz);
  const palette = new Palette(config.palette);
  const ctx = new BuildCtx(grid, palette, vpm, length, origin);

  buildFuselage(ctx, g.fuselage);
  if (g.lerx) buildLerx(ctx, g.lerx);
  buildSurfacePair(ctx, g.wing, 'wing-r', 'wing-l');
  if (g.canard) buildSurfacePair(ctx, g.canard, 'canard-r', 'canard-l');
  if (g.tailH) buildSurfacePair(ctx, g.tailH, 'tail-h-r', 'tail-h-l');
  if (g.tailV) buildFin(ctx, g.tailV, 'tail-v', { side: 0 });
  if (g.tailVTwin) {
    buildFin(ctx, g.tailVTwin, 'tail-v-r', { side: 1 });
    buildFin(ctx, g.tailVTwin, 'tail-v-l', { side: -1 });
  }
  if (g.ventral) {
    buildFin(ctx, g.ventral, 'ventral-r', { side: 1, down: true });
    buildFin(ctx, g.ventral, 'ventral-l', { side: -1, down: true });
  }

  const ductTo = g.nozzle.engineFromZ ?? length * 0.7;
  for (const intake of g.intakes) buildIntake(ctx, intake, ductTo);
  buildEngine(ctx, g.nozzle);
  buildNozzle(ctx, g.nozzle);
  buildCanopy(ctx, g.canopy);
  if (g.blocks) buildBlocks(ctx, g.blocks);
  if (g.markings) buildMarkings(ctx, g.markings, COUNTRIES[config.spec.country].marking);

  const surface = extractSurface(grid, {
    vpm,
    origin,
    colors: palette.toColorArray(),
    kinds: palette.toKindArray(),
    seed: hashString(config.id),
    partCount: PART_COUNT,
  });

  return {
    ...surface,
    id: config.id,
    buildMs: performance.now() - t0,
    gridDims: [sx, sy, sz],
  };
}
