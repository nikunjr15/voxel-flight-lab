import { assemble, type AssembleOptions, type AssembleResult } from './assemble';
import { silhouette, type Silhouette } from './silhouette';
import type { AircraftConfig } from '../../aircraft/types';

export type BuildRequest =
  | { id: number; kind: 'build'; config: AircraftConfig; opts: AssembleOptions }
  | { id: number; kind: 'silhouette'; config: AircraftConfig }
  | { id: number; kind: 'ping' };

export interface BuildResponse {
  id: number;
  result?: AssembleResult;
  silhouette?: Silhouette;
  error?: string;
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

/**
 * Voxelising an airframe is 80-120 ms of tight loops. On the main thread that
 * lands as a dropped frame in the middle of a scroll transition, so it runs
 * here and comes back as transferable buffers the renderer can upload directly.
 * The ribbon's plan-view masks are built here for the same reason.
 */
ctx.addEventListener('message', (e: MessageEvent<BuildRequest>) => {
  const req = e.data;
  try {
    if (req.kind === 'ping') {
      ctx.postMessage({ id: req.id } satisfies BuildResponse);
      return;
    }
    if (req.kind === 'silhouette') {
      const s = silhouette(req.config);
      ctx.postMessage({ id: req.id, silhouette: s } satisfies BuildResponse, [s.cells.buffer]);
      return;
    }
    const result = assemble(req.config, req.opts);
    const transfer: Transferable[] = [];
    for (const b of result.buckets) {
      transfer.push(
        b.offsets.buffer,
        b.colors.buffer,
        b.parts.buffer,
        b.ao.buffer,
        b.scatter.buffer,
        b.seeds.buffer,
      );
    }
    transfer.push(result.partCentroids.buffer, result.partCounts.buffer);
    ctx.postMessage({ id: req.id, result } satisfies BuildResponse, transfer);
  } catch (err) {
    ctx.postMessage({
      id: req.id,
      error: err instanceof Error ? err.message : String(err),
    } satisfies BuildResponse);
  }
});
