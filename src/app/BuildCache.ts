import { buildClient } from '../engine/build/client';
import type { AssembleOptions, AssembleResult } from '../engine/build/assemble';
import type { AircraftConfig } from '../aircraft/types';

/**
 * Finished builds, kept so that stepping to an aircraft never waits on the
 * worker. The exhibit prefetches its neighbours after each change; by the
 * time the visitor moves, the next airframe is usually already here.
 *
 * Results are shared between models: a model only reads its buffers, so the
 * same build can back the outgoing and incoming model of a morph.
 */
export class BuildCache {
  /** Insertion-ordered, so the first entry is the least recently used. */
  private readonly entries = new Map<string, Promise<AssembleResult>>();
  private prefetchToken = 0;

  constructor(private readonly limit = 8) {}

  private key(config: AircraftConfig, opts: AssembleOptions): string {
    return `${config.id}|${opts.density ?? 1}|${opts.wingSweep ?? '-'}`;
  }

  has(config: AircraftConfig, opts: AssembleOptions): boolean {
    return this.entries.has(this.key(config, opts));
  }

  get(config: AircraftConfig, opts: AssembleOptions): Promise<AssembleResult> {
    const k = this.key(config, opts);
    let p = this.entries.get(k);
    if (p) {
      // Touch: move to the most recently used end.
      this.entries.delete(k);
      this.entries.set(k, p);
      return p;
    }
    p = buildClient.build(config, opts);
    p.catch(() => this.entries.delete(k));
    this.entries.set(k, p);
    while (this.entries.size > this.limit) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
    return p;
  }

  /**
   * Builds the given aircraft one after another, never more than one ahead,
   * so a build the visitor actually asks for is not queued behind a row of
   * speculative ones. A newer prefetch call cancels the rest of an older one.
   */
  async prefetch(configs: AircraftConfig[], opts: (c: AircraftConfig) => AssembleOptions): Promise<void> {
    const token = ++this.prefetchToken;
    for (const c of configs) {
      if (token !== this.prefetchToken) return;
      const o = opts(c);
      if (this.has(c, o)) continue;
      try {
        await this.get(c, o);
      } catch {
        // A failed prefetch is retried on demand; nothing to do here.
      }
    }
  }
}
