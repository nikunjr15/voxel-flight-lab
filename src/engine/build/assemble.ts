import { Palette } from '../voxel/palette';
import { PART_COUNT } from '../voxel/parts';
import { VoxelGrid } from '../voxel/VoxelGrid';
import { extractSurface, SurfaceData } from '../voxel/surface';
import { DEG } from '../util/math';
import { hashString } from '../util/rng';
import { COUNTRIES } from '../../aircraft/countries';
import type { AircraftConfig, SurfaceParams } from '../../aircraft/types';
import { BuildCtx } from './ctx';
import { buildFuselage } from './fuselage';
import { buildFin, buildLerx, buildSurfacePair, buildVariableWing } from './wing';
import { buildCanopy } from './canopy';
import { buildIntake, DuctPath } from './intake';
import { buildEngine, buildNozzle } from './nozzle';
import { buildBays, buildStores } from './stores';
import { buildNacelles } from './nacelle';
import { buildFairings } from './fairing';
import { buildBlocks } from './blocks';
import { buildMarkings } from './markings';
import { buildLettering } from './glyphs';

/**
 * Resolution is set per planform, not per length. Normalising by length alone
 * gives a short wide aircraft like the MiG-15 a span of 128 voxels and twice
 * the surface of a long thin one, which blows the budget on exactly the jets
 * that least need the detail. Using sqrt(length x span) keeps surface counts
 * within a narrow band across the whole roster.
 */
export const TARGET_PLANFORM_VOXELS = 104;

export interface AssembleOptions {
  /** 1.0 desktop, 0.65 mobile, 0.5 low power. */
  density?: number;
  /** Forces voxels nose to tail, overriding the planform rule. */
  targetLengthVoxels?: number;
  /**
   * Forces an exact world voxel size in metres, overriding both rules above.
   * Any set of aircraft built with the same value shares a block size, so a
   * gallery or a compare turntable shows honest relative scale instead of
   * each airframe being quantised to its own grid.
   */
  voxelSize?: number;
  /** Overrides the wing sweep on variable-geometry aircraft, in degrees. */
  wingSweep?: number;
  /** Overrides bay door opening, 0 closed to 1 open. */
  doorOpen?: number;
}

export interface AssembleResult extends SurfaceData {
  id: string;
  buildMs: number;
  gridDims: [number, number, number];
  /**
   * Intake-to-engine centreline paths in model space, for the airflow
   * particles in engine mode.
   */
  ductPaths: Array<Array<[number, number, number]>>;
}

/**
 * Resolves a fin-mounted stabiliser to real coordinates. A T-tail config says
 * `mount: 'fin-top'` and the height comes from the vertical tail, so moving
 * the fin never leaves the tailplane floating.
 */
function mountedTail(tail: SurfaceParams, fin?: SurfaceParams): SurfaceParams {
  if (!tail.mount || tail.mount === 'body' || !fin) return tail;
  const frac = tail.mount === 'fin-top' ? 0.94 : 0.55;
  const atY = fin.atY + fin.span * frac;
  // Follow the fin's leading edge aft as the mounting point rises.
  const sweepShift = Math.tan(fin.sweep * DEG) * fin.span * frac;
  return { ...tail, atY, atZ: fin.atZ + sweepShift + (tail.atZ - fin.atZ) * 0.25 };
}

/**
 * Turns one config into draw-ready instance buffers. Everything downstream --
 * modes, morphs, the live block count -- reads from this single output.
 */
export function assemble(config: AircraftConfig, opts: AssembleOptions = {}): AssembleResult {
  const t0 = performance.now();
  const density = opts.density ?? 1;

  const g = config.geometry;
  const length = g.fuselage.length;
  const planform = Math.sqrt(length * Math.max(1, g.bbox.span));
  const vpm = opts.voxelSize
    ? density / opts.voxelSize
    : opts.targetLengthVoxels
      ? (opts.targetLengthVoxels * density) / length
      : (TARGET_PLANFORM_VOXELS * density) / planform;

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

  if (g.wing.vg) buildVariableWing(ctx, g.wing, 'wing-r', 'wing-l', opts.wingSweep);
  else buildSurfacePair(ctx, g.wing, 'wing-r', 'wing-l');

  if (g.canard) buildSurfacePair(ctx, g.canard, 'canard-r', 'canard-l');
  if (g.tailH) buildSurfacePair(ctx, mountedTail(g.tailH, g.tailV), 'tail-h-r', 'tail-h-l');
  if (g.tailV) buildFin(ctx, g.tailV, 'tail-v', { side: 0 });
  if (g.tailVTwin) {
    buildFin(ctx, g.tailVTwin, 'tail-v-r', { side: 1 });
    buildFin(ctx, g.tailVTwin, 'tail-v-l', { side: -1 });
  }
  if (g.tailVee) {
    buildFin(ctx, g.tailVee, 'tail-v-r', { side: 1 });
    buildFin(ctx, g.tailVee, 'tail-v-l', { side: -1 });
  }
  if (g.ventral) {
    buildFin(ctx, g.ventral, 'ventral-r', { side: 1, down: true });
    buildFin(ctx, g.ventral, 'ventral-l', { side: -1, down: true });
  }

  if (g.fairings) buildFairings(ctx, g.fairings);

  const ductTo = g.nozzle?.engineFromZ ?? length * 0.7;
  const paths: DuctPath[] = [];
  for (const intake of g.intakes) paths.push(...buildIntake(ctx, intake, ductTo));

  if (g.nacelles) buildNacelles(ctx, g.nacelles);
  if (g.nozzle) {
    buildEngine(ctx, g.nozzle);
    buildNozzle(ctx, g.nozzle);
  }
  buildCanopy(ctx, g.canopy);

  if (g.bays) {
    buildBays(
      ctx,
      opts.doorOpen === undefined ? g.bays : g.bays.map((b) => ({ ...b, doorOpen: opts.doorOpen })),
    );
  }
  if (g.stores) buildStores(ctx, g.stores);
  if (g.blocks) buildBlocks(ctx, g.blocks);
  if (g.markings) buildMarkings(ctx, g.markings, COUNTRIES[config.spec.country].marking, g.wing);
  if (g.lettering) buildLettering(ctx, g.lettering);

  const surface = extractSurface(grid, {
    vpm,
    origin,
    colors: palette.toColorArray(),
    kinds: palette.toKindArray(),
    seed: hashString(config.id),
    partCount: PART_COUNT,
  });

  const voxelSize = 1 / vpm;
  const toModel = (pt: [number, number, number]): [number, number, number] => [
    (pt[0] - origin[0]) * voxelSize,
    (pt[1] - origin[1]) * voxelSize,
    (pt[2] - origin[2]) * voxelSize,
  ];

  return {
    ...surface,
    id: config.id,
    buildMs: performance.now() - t0,
    gridDims: [sx, sy, sz],
    ductPaths: paths.map((p) => p.points.map(toModel)),
  };
}
