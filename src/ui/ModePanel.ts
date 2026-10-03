import type { AircraftConfig } from '../aircraft/types';
import type { Store, ViewerState } from '../app/store';

/**
 * The controls that belong to one mode or one aircraft, on a small strip just
 * above the toolbar: the x-ray separation slider, the wing-sweep slider on a
 * variable-geometry aircraft, and the radar-signature toggle on a stealth one.
 * Each shows only when it applies, so the toolbar itself never changes shape.
 */
export class ModePanel {
  readonly el: HTMLElement;
  private readonly xray: HTMLLabelElement;
  private readonly xrayInput: HTMLInputElement;
  private readonly sweep: HTMLLabelElement;
  private readonly sweepInput: HTMLInputElement;
  private readonly sweepValue: HTMLElement;
  private readonly radar: HTMLButtonElement;
  private config: AircraftConfig | null = null;

  constructor(
    mount: HTMLElement,
    private readonly store: Store<ViewerState>,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'modepanel';
    mount.prepend(this.el);

    [this.xray, this.xrayInput] = this.slider('Separation', 0, 1, 0.01);
    this.xrayInput.addEventListener('input', () => store.set('xray', Number(this.xrayInput.value)));

    [this.sweep, this.sweepInput] = this.slider('Wing sweep', 16, 72, 1);
    this.sweepValue = document.createElement('output');
    this.sweepValue.className = 'modepanel__value';
    this.sweep.appendChild(this.sweepValue);
    this.sweepInput.addEventListener('input', () => store.set('sweep', Number(this.sweepInput.value)));

    this.radar = document.createElement('button');
    this.radar.type = 'button';
    this.radar.className = 'chip';
    this.radar.innerHTML = '<span class="chip__dot" aria-hidden="true"></span><span>Radar view</span>';
    this.radar.setAttribute('aria-label', 'Radar signature view, illustrative');
    this.radar.addEventListener('click', () => store.set('radar', !store.get('radar')));

    this.el.append(this.xray, this.sweep, this.radar);

    store.on('mode', () => this.sync());
    store.on('xray', (v) => (this.xrayInput.value = String(v)));
    store.on('sweep', (v) => this.syncSweep(v));
    store.on('radar', (on) => {
      this.radar.classList.toggle('is-on', on);
      this.radar.setAttribute('aria-pressed', String(on));
    });
    this.radar.setAttribute('aria-pressed', 'false');
    this.sync();
  }

  show(config: AircraftConfig): void {
    this.config = config;
    const vg = config.geometry.wing.vg;
    if (vg) {
      this.sweepInput.min = String(vg.sweepMin);
      this.sweepInput.max = String(vg.sweepMax);
    }
    this.sync();
  }

  private sync(): void {
    const c = this.config;
    const xrayOn = this.store.get('mode') === 'xray';
    const vg = !!c?.geometry.wing.vg;
    const stealth = !!c && (c.spec.generation === '5' || c.spec.generation === '6-concept');
    this.xray.hidden = !xrayOn;
    this.sweep.hidden = !vg;
    this.radar.hidden = !stealth;
    this.el.hidden = !xrayOn && !vg && !stealth;
    this.xrayInput.value = String(this.store.get('xray'));
    this.syncSweep(this.store.get('sweep'));
  }

  private syncSweep(v: number): void {
    if (!Number.isFinite(v)) return;
    this.sweepInput.value = String(v);
    this.sweepValue.textContent = `${Math.round(v)}°`;
  }

  private slider(label: string, min: number, max: number, step: number): [HTMLLabelElement, HTMLInputElement] {
    const wrap = document.createElement('label');
    wrap.className = 'modepanel__slider';
    const text = document.createElement('span');
    text.textContent = label;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    wrap.append(text, input);
    return [wrap, input];
  }
}
