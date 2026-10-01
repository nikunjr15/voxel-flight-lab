import { assemble, type AssembleOptions, type AssembleResult } from './assemble';
import type { AircraftConfig } from '../../aircraft/types';

export interface BuildRequest {
  id: number;
  config: AircraftConfig;
  opts: AssembleOptions;
}

export interface BuildResponse {
  id: number;
  result?: AssembleResult;
  error?: string;
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

/**
 * Voxelising an airframe is 80-120 ms of tight loops. On the main thread that
 * lands as a dropped frame in the middle of a scroll transition, so it runs
 * here and comes back as transferable buffers the renderer can upload directly.
 */
ctx.addEventListener('message', (e: MessageEvent<BuildRequest>) => {
  const { id, config, opts } = e.data;
  try {
    const result = assemble(config, opts);
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
    ctx.postMessage({ id, result } satisfies BuildResponse, transfer);
  } catch (err) {
    ctx.postMessage({
      id,
      error: err instanceof Error ? err.message : String(err),
    } satisfies BuildResponse);
  }
});
