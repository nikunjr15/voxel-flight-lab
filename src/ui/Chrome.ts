import type { Object3D, PerspectiveCamera } from 'three';
import type { AircraftConfig } from '../aircraft';
import type { Store, ViewerState } from '../app/store';
import { Annotations } from './Annotations';
import { Gizmo } from './Gizmo';
import { SpecTable } from './SpecTable';
import { Title } from './Title';
import { MODES, Toolbar } from './Toolbar';
import { ModePanel } from './ModePanel';

const q = <T extends HTMLElement>(root: ParentNode, sel: string): T => {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`Missing ${sel}`);
  return el;
};

/**
 * Everything drawn over the canvas. The markup lives in index.html so the page
 * has its structure and text before any script runs; this class fills it in
 * and keeps it in step with the viewer store.
 */
export class Chrome {
  readonly root: HTMLElement;
  readonly notes: Annotations;
  private readonly title: Title;
  private readonly gizmo: Gizmo;
  private readonly spec: SpecTable;
  private readonly blocks: HTMLElement;
  private readonly live: HTMLElement;
  private readonly inspect: HTMLButtonElement;
  private readonly panel: ModePanel;

  constructor(
    root: HTMLElement,
    store: Store<ViewerState>,
  ) {
    this.root = root;
    this.title = new Title(root);
    this.notes = new Annotations(q(root, '[data-mount="notes"]'), store);
    new Toolbar(q(root, '[data-mount="toolbar"]'), store);
    this.panel = new ModePanel(q(root, '[data-mount="panel"]'), store);
    this.inspect = q<HTMLButtonElement>(root, '.inspect');
    this.gizmo = new Gizmo(this.inspect);
    this.spec = new SpecTable(q(root, '[data-mount="spec"]'));
    this.blocks = q(root, '[data-field="blocks"]');
    this.live = q(root, '[data-field="live"]');

    // "Inspect in 360" is the orbit toggle under another name.
    this.inspect.addEventListener('click', () => store.set('orbit', !store.get('orbit')));
    store.on('orbit', (on) => {
      this.inspect.setAttribute('aria-pressed', String(on));
      this.inspect.classList.toggle('is-on', on);
    });

    store.on('mode', (mode) => {
      const label = MODES.find((m) => m.id === mode)?.label ?? mode;
      this.announce(label);
    });

    // Touch screens pinch rather than scroll.
    const coarse = window.matchMedia('(pointer: coarse)');
    const hint = q(root, '[data-field="zoom-verb"]');
    const setHint = () => (hint.textContent = coarse.matches ? 'Pinch' : 'Scroll');
    coarse.addEventListener('change', setHint);
    setHint();
  }

  show(config: AircraftConfig): void {
    this.title.show(config);
    this.notes.show(config.copy.annotations);
    this.spec.show(config);
    this.panel.show(config);
    this.announce(`${config.name}, exhibit ${config.exhibitNo}`);
  }

  setBlocks(n: number): void {
    this.blocks.textContent = `${n.toLocaleString('en-US')} blocks`;
  }

  /** Per frame: only the gizmo moves. */
  update(camera: PerspectiveCamera, model: Object3D): void {
    this.gizmo.update(camera, model);
  }

  setHidden(hidden: boolean): void {
    this.root.hidden = hidden;
  }

  private announce(text: string): void {
    // Clearing first makes a repeated message announce again.
    this.live.textContent = '';
    window.setTimeout(() => (this.live.textContent = text), 40);
  }
}
