import { assemble, type AssembleOptions, type AssembleResult } from './assemble';
import type { AircraftConfig } from '../../aircraft/types';
import type { BuildRequest, BuildResponse } from './worker';

interface Pending {
  resolve: (r: AssembleResult) => void;
  reject: (e: Error) => void;
}

/**
 * Front door to the voxel builder. Uses a worker when one can be created and
 * falls back to building in place when it cannot, so nothing downstream has to
 * care which happened.
 */
export class BuildClient {
  private worker: Worker | null = null;
  private seq = 0;
  private readonly pending = new Map<number, Pending>();
  private workerFailed = false;

  constructor() {
    this.spawn();
  }

  private spawn(): void {
    if (this.workerFailed) return;
    try {
      this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      this.worker.addEventListener('message', this.onMessage);
      this.worker.addEventListener('error', this.onError);
    } catch {
      this.workerFailed = true;
      this.worker = null;
    }
  }

  private readonly onMessage = (e: MessageEvent<BuildResponse>): void => {
    const { id, result, error } = e.data;
    const entry = this.pending.get(id);
    if (!entry) return;
    this.pending.delete(id);
    if (result) entry.resolve(result);
    else entry.reject(new Error(error ?? 'build failed'));
  };

  private readonly onError = (): void => {
    // One failure is enough: drop to synchronous builds rather than stalling.
    this.workerFailed = true;
    const pending = [...this.pending.values()];
    this.pending.clear();
    this.worker?.terminate();
    this.worker = null;
    for (const p of pending) p.reject(new Error('build worker failed'));
  };

  get usesWorker(): boolean {
    return this.worker !== null;
  }

  async build(config: AircraftConfig, opts: AssembleOptions = {}): Promise<AssembleResult> {
    if (!this.worker) return assemble(config, opts);
    const id = ++this.seq;
    const request: BuildRequest = { id, config, opts };
    return new Promise<AssembleResult>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker?.postMessage(request);
    }).catch((err: Error) => {
      if (this.workerFailed) return assemble(config, opts);
      throw err;
    });
  }

  /** Builds several configs, keeping the worker busy without flooding it. */
  async buildAll(
    configs: AircraftConfig[],
    opts: AssembleOptions = {},
  ): Promise<AssembleResult[]> {
    const out: AssembleResult[] = [];
    for (const c of configs) out.push(await this.build(c, opts));
    return out;
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
  }
}

export const buildClient = new BuildClient();
