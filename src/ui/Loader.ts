/**
 * The entry screen: "Calibrating airframe", a percentage of real work done,
 * and a delta wing assembling out of voxels as it counts. At 100% it offers
 * the two ways in, which double as the user gesture the audio needs.
 *
 * Progress is the weighted sum of tasks that actually finish -- fonts, the
 * build worker answering, the first airframe built and on screen, the
 * ribbon's silhouettes -- and the number shown eases toward that sum but
 * never runs ahead of it.
 */

export type LoadTask = 'fonts' | 'worker' | 'build' | 'masks';

const WEIGHTS: Record<LoadTask, number> = { fonts: 0.15, worker: 0.15, build: 0.5, masks: 0.2 };

/** A delta wing in plan, nose up: one cell per voxel. */
function deltaWing(): { x: number; z: number }[] {
  const cells: { x: number; z: number }[] = [];
  const W = 31;
  const L = 27;
  const cx = (W - 1) / 2;
  for (let z = 0; z < L; z++) {
    // Fuselage from the nose; the wing's leading edge sweeps out from row 6.
    const body = z < 3 ? 0.6 : 1.4;
    const wing = z < 6 ? 0 : Math.min(cx, (z - 6) * 0.82 + 1);
    const half = Math.max(body, wing);
    for (let x = 0; x < W; x++) {
      if (Math.abs(x - cx) <= half) cells.push({ x, z });
    }
  }
  return cells;
}

interface Cell {
  x: number;
  z: number;
  /** Order of appearance, 0..1. */
  at: number;
  /** Time it appeared, ms; -1 until then. */
  born: number;
}

export class Loader {
  private readonly el: HTMLElement;
  private readonly pct: HTMLElement;
  private readonly bar: HTMLElement;
  private readonly actions: HTMLElement;
  private readonly status: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly done: Record<LoadTask, number> = { fonts: 0, worker: 0, build: 0, masks: 0 };
  private readonly cells: Cell[];
  private shown = 0;
  private raf = 0;
  private last = 0;
  private ready = false;
  private enter: ((sound: boolean) => void) | null = null;
  private readonly reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Takes over the loader markup, or removes it and returns null on a repeat visit. */
  static mount(): Loader | null {
    const el = document.querySelector<HTMLElement>('.loader');
    if (!el) return null;
    if (!document.documentElement.classList.contains('is-loading')) {
      el.remove();
      return null;
    }
    return new Loader(el);
  }

  private constructor(el: HTMLElement) {
    this.el = el;
    const q = <T extends HTMLElement>(sel: string) => {
      const found = el.querySelector<T>(sel);
      if (!found) throw new Error(`Missing ${sel}`);
      return found;
    };
    this.pct = q('[data-field="pct"]');
    this.bar = q('.loader__pct');
    this.actions = q('.loader__actions');
    this.status = q('.loader__status');
    this.canvas = q<HTMLCanvasElement>('.loader__wing');
    this.ctx = this.canvas.getContext('2d');

    // Cells gather roughly from the middle outward, with enough randomness
    // that the wing builds up rather than growing like a stain.
    const cells = deltaWing();
    const cx = 15;
    const order = cells
      .map((c) => ({ c, k: Math.hypot(c.x - cx, (c.z - 13) * 1.2) + Math.random() * 9 }))
      .sort((a, b) => a.k - b.k);
    this.cells = order.map(({ c }, i) => ({ ...c, at: (i + 1) / order.length, born: -1 }));

    // Everything outside the loader is inert until the visitor chooses.
    for (const sel of ['.skip', '[data-mount="chapters"]', '.chrome']) {
      document.querySelector(sel)?.setAttribute('inert', '');
    }

    for (const b of el.querySelectorAll<HTMLButtonElement>('[data-enter]')) {
      b.addEventListener('click', () => this.leave(b.dataset.enter === 'sound'));
    }

    void document.fonts?.ready.then(() => this.set('fonts', 1));
    if (!document.fonts) this.set('fonts', 1);

    this.resize();
    window.addEventListener('resize', this.resize);
    this.raf = requestAnimationFrame(this.frame);
  }

  /** Called with the choice; must stay synchronous so audio can start inside it. */
  onEnter(fn: (sound: boolean) => void): void {
    this.enter = fn;
  }

  set(task: LoadTask, v: number): void {
    this.done[task] = Math.max(this.done[task], Math.min(1, v));
  }

  private get target(): number {
    let t = 0;
    for (const k of Object.keys(WEIGHTS) as LoadTask[]) t += WEIGHTS[k] * this.done[k];
    return t;
  }

  private readonly resize = (): void => {
    const css = Math.min(340, window.innerWidth * 0.7);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.style.width = `${css}px`;
    this.canvas.style.height = `${css * 0.72}px`;
    this.canvas.width = Math.round(css * dpr);
    this.canvas.height = Math.round(css * 0.72 * dpr);
  };

  private readonly frame = (now: number): void => {
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;
    this.last = now;
    const target = this.target * 100;
    // Ease toward the real figure, never past it.
    this.shown = this.reduced ? target : Math.min(target, this.shown + (target - this.shown) * (1 - Math.exp(-dt * 5)) + dt * 4);
    const n = Math.floor(this.shown + 1e-6);
    this.pct.textContent = String(n);
    this.bar.setAttribute('aria-valuenow', String(n));
    this.draw(now);
    if (!this.ready && this.target >= 1 && this.shown >= 99.5) this.showActions();
    this.raf = requestAnimationFrame(this.frame);
  };

  private draw(now: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);
    // Oblique plan: each voxel is a top face with a strip of its front face
    // under it, drawn nose-first so nearer cells overlap farther ones.
    const s = w / 34;
    const top = s * 0.62;
    const face = s * 0.34;
    const ox = (w - 31 * s) / 2;
    const oy = (h - 27 * top - face) / 2;
    const progress = this.shown / 100;
    for (const c of this.cells) {
      const visible = this.reduced || c.at <= progress;
      if (!visible) continue;
      if (c.born < 0) c.born = now;
      // A new voxel drops in and fades up over a third of a second.
      const t = this.reduced ? 1 : Math.min(1, (now - c.born) / 340);
      const e = 1 - (1 - t) ** 3;
      const x = ox + c.x * s;
      const y = oy + c.z * top - (1 - e) * s * 2.2;
      ctx.globalAlpha = e;
      ctx.fillStyle = '#c3c9ce';
      ctx.fillRect(x, y, s - 0.5, top - 0.5);
      ctx.fillStyle = '#8c949b';
      ctx.fillRect(x, y + top - 0.5, s - 0.5, face);
    }
    ctx.globalAlpha = 1;
  }

  private showActions(): void {
    this.ready = true;
    this.el.classList.add('is-ready');
    this.actions.hidden = false;
    this.status.textContent = 'Ready. Enter with sound, or in silence.';
    this.actions.querySelector<HTMLButtonElement>('[data-enter]')?.focus({ preventScroll: true });
  }

  private leave(sound: boolean): void {
    // Synchronous first: this is the gesture that may start the audio.
    this.enter?.(sound);
    for (const sel of ['.skip', '[data-mount="chapters"]', '.chrome']) {
      document.querySelector(sel)?.removeAttribute('inert');
    }
    document.documentElement.classList.remove('is-loading');
    document.documentElement.classList.add('is-entered');
    this.el.classList.add('is-leaving');
    const finish = () => {
      cancelAnimationFrame(this.raf);
      window.removeEventListener('resize', this.resize);
      this.el.remove();
    };
    if (this.reduced) finish();
    else window.setTimeout(finish, 700);
  }
}
