/** Frame-time readout for verifying the performance budget. Toggled with F. */
export class DevStats {
  readonly el: HTMLElement;
  private samples: number[] = [];
  private last = 0;
  private visible = false;

  constructor(parent: HTMLElement = document.body) {
    this.el = document.createElement('div');
    this.el.className = 'dev-stats';
    this.el.setAttribute('aria-hidden', 'true');
    this.el.hidden = true;
    parent.appendChild(this.el);
  }

  toggle(): void {
    this.visible = !this.visible;
    this.el.hidden = !this.visible;
  }

  setExtra(text: string): void {
    this.extra = text;
  }

  private extra = '';

  tick(now: number): void {
    if (this.last > 0) {
      this.samples.push(now - this.last);
      if (this.samples.length > 90) this.samples.shift();
    }
    this.last = now;
    if (!this.visible || this.samples.length < 10) return;

    const sorted = [...this.samples].sort((a, b) => a - b);
    const avg = this.samples.reduce((s, v) => s + v, 0) / this.samples.length;
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    this.el.textContent = `${avg.toFixed(1)} ms avg · ${p95.toFixed(1)} ms p95 · ${(
      1000 / avg
    ).toFixed(0)} fps${this.extra ? ` · ${this.extra}` : ''}`;
  }
}
