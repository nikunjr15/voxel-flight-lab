/** Timer-query extension, typed loosely: it is not in the DOM lib. */
interface TimerExt {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}

export interface FrameSummary {
  /** Mean interval between frames, ms. Capped by the display's refresh. */
  frameMs: number;
  frameP95: number;
  /** Mean main-thread time spent on one frame's work, ms. */
  cpuMs: number;
  /** Mean GPU time for one frame's draw, ms; null if the timer query is unavailable. */
  gpuMs: number | null;
}

const WINDOW = 90;

/**
 * Frame-time readout for verifying the performance budget. Toggled with F.
 *
 * Frame interval alone says little on a fast machine -- it sits at the
 * display's refresh until the budget is blown -- so it also records the
 * main-thread cost of each frame and, where the browser exposes it, the GPU
 * time of the draw from a timer query. Those two are what the mode budget
 * is measured in.
 */
export class DevStats {
  readonly el: HTMLElement;
  private frames: number[] = [];
  private cpu: number[] = [];
  private gpu: number[] = [];
  private last = 0;
  private visible = false;
  private extra = '';

  private gl: WebGL2RenderingContext | null = null;
  private ext: TimerExt | null = null;
  private pending: WebGLQuery[] = [];
  private active: WebGLQuery | null = null;

  constructor(parent: HTMLElement = document.body) {
    this.el = document.createElement('div');
    this.el.className = 'dev-stats';
    this.el.setAttribute('aria-hidden', 'true');
    this.el.hidden = true;
    parent.appendChild(this.el);
    // `?stats=1` shows it from the start, for devices with no F key.
    if (__REVIEW__ && new URLSearchParams(location.search).get('stats') === '1') this.toggle();
  }

  /** Enables GPU timing on review builds, if the context supports it. */
  attachGl(gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    if (!__REVIEW__ || !(gl instanceof WebGL2RenderingContext)) return;
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExt | null;
    if (!ext) return;
    this.gl = gl;
    this.ext = ext;
  }

  toggle(): void {
    this.visible = !this.visible;
    this.el.hidden = !this.visible;
  }

  setExtra(text: string): void {
    this.extra = text;
  }

  /** Brackets the frame's draw calls. At most one query is open at a time. */
  beginGpu(): void {
    const gl = this.gl;
    if (!gl || !this.ext || this.active || this.pending.length > 4) return;
    const q = gl.createQuery();
    if (!q) return;
    gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q);
    this.active = q;
  }

  endGpu(): void {
    const gl = this.gl;
    if (!gl || !this.ext || !this.active) return;
    gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push(this.active);
    this.active = null;
  }

  private collectGpu(): void {
    const gl = this.gl;
    if (!gl || !this.ext) return;
    const disjoint = gl.getParameter(this.ext.GPU_DISJOINT_EXT) as boolean;
    while (this.pending.length) {
      const q = this.pending[0];
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
      const ns = gl.getQueryParameter(q, gl.QUERY_RESULT) as number;
      if (!disjoint) push(this.gpu, ns / 1e6);
      gl.deleteQuery(q);
      this.pending.shift();
    }
  }

  /** `now` is the rAF timestamp; `workMs` the main-thread time this frame took. */
  tick(now: number, workMs = 0): void {
    if (this.last > 0) push(this.frames, now - this.last);
    this.last = now;
    push(this.cpu, workMs);
    this.collectGpu();
    if (!this.visible || this.frames.length < 10) return;

    const s = this.summary();
    this.el.textContent =
      `${s.frameMs.toFixed(1)} ms avg · ${s.frameP95.toFixed(1)} ms p95 · ${(1000 / s.frameMs).toFixed(0)} fps · ` +
      `cpu ${s.cpuMs.toFixed(2)} ms` +
      (s.gpuMs !== null ? ` · gpu ${s.gpuMs.toFixed(2)} ms` : '') +
      (this.extra ? ` · ${this.extra}` : '');
  }

  summary(): FrameSummary {
    const sorted = [...this.frames].sort((a, b) => a - b);
    return {
      frameMs: mean(this.frames),
      frameP95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
      cpuMs: mean(this.cpu),
      gpuMs: this.gpu.length ? mean(this.gpu) : null,
    };
  }

  /** Clears the sample windows, so a summary covers only what follows. */
  reset(): void {
    this.frames.length = 0;
    this.cpu.length = 0;
    this.gpu.length = 0;
    this.last = 0;
  }
}

function push(list: number[], v: number): void {
  list.push(v);
  if (list.length > WINDOW) list.shift();
}

function mean(list: number[]): number {
  return list.length ? list.reduce((s, v) => s + v, 0) / list.length : 0;
}
