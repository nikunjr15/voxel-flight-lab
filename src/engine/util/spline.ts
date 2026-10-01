import { clamp } from './math';

export interface Knot {
  t: number;
  v: number;
}

/**
 * Monotone cubic Hermite (Fritsch-Carlson). Plain Catmull-Rom overshoots on
 * fuselage profiles and produces negative half-widths, which rasterise as holes.
 */
export class Track {
  private readonly ts: number[];
  private readonly vs: number[];
  private readonly ms: number[];

  constructor(knots: Knot[]) {
    const sorted = [...knots].sort((a, b) => a.t - b.t);
    this.ts = sorted.map((k) => k.t);
    this.vs = sorted.map((k) => k.v);
    this.ms = Track.tangents(this.ts, this.vs);
  }

  private static tangents(ts: number[], vs: number[]): number[] {
    const n = ts.length;
    if (n < 2) return [0];
    const d: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      const dt = ts[i + 1] - ts[i];
      d.push(dt === 0 ? 0 : (vs[i + 1] - vs[i]) / dt);
    }
    const m: number[] = new Array(n);
    m[0] = d[0];
    m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) {
      m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    }
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) {
        m[i] = 0;
        m[i + 1] = 0;
        continue;
      }
      const a = m[i] / d[i];
      const b = m[i + 1] / d[i];
      const s = a * a + b * b;
      if (s > 9) {
        const tau = 3 / Math.sqrt(s);
        m[i] = tau * a * d[i];
        m[i + 1] = tau * b * d[i];
      }
    }
    return m;
  }

  at(t: number): number {
    const { ts, vs, ms } = this;
    const n = ts.length;
    if (n === 0) return 0;
    if (n === 1) return vs[0];
    const x = clamp(t, ts[0], ts[n - 1]);
    let i = 0;
    while (i < n - 2 && x > ts[i + 1]) i++;
    const h = ts[i + 1] - ts[i];
    if (h === 0) return vs[i];
    const s = (x - ts[i]) / h;
    const s2 = s * s;
    const s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1;
    const h10 = s3 - 2 * s2 + s;
    const h01 = -2 * s3 + 3 * s2;
    const h11 = s3 - s2;
    return h00 * vs[i] + h10 * h * ms[i] + h01 * vs[i + 1] + h11 * h * ms[i + 1];
  }
}
