import { assemble, type AssembleOptions, type AssembleResult } from './assemble';
import type { AircraftConfig } from '../../aircraft/types';
import { silhouette, type Silhouette } from './silhouette';
import type { BuildRequest, BuildResponse } from './worker';

interface Pending {
  resolve: (r: BuildResponse) => void;
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
    const entry = this.pending.get(e.data.id);
    if (!entry) return;
    this.pending.delete(e.data.id);
    if (e.data.error) entry.reject(new Error(e.data.error));
    else entry.resolve(e.data);
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

  private send(request: BuildRequest): Promise<BuildResponse> {
    return new Promise<BuildResponse>((resolve, reject) => {
      this.pending.set(request.id, { resolve, reject });
      this.worker?.postMessage(request);
    });
  }

  async build(config: AircraftConfig, opts: AssembleOptions = {}): Promise<AssembleResult> {
    if (!this.worker) return assemble(config, opts);
    try {
      const r = await this.send({ id: ++this.seq, kind: 'build', config, opts });
      if (!r.result) throw new Error('build returned nothing');
      return r.result;
    } catch (err) {
      if (this.workerFailed) return assemble(config, opts);
      throw err;
    }
  }

  /** Plan-view mask for the evolution ribbon. */
  async silhouette(config: AircraftConfig): Promise<Silhouette> {
    if (!this.worker) return silhouette(config);
    try {
      const r = await this.send({ id: ++this.seq, kind: 'silhouette', config });
      if (!r.silhouette) throw new Error('silhouette returned nothing');
      return r.silhouette;
    } catch (err) {
      if (this.workerFailed) return silhouette(config);
      throw err;
    }
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
