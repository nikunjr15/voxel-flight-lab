import type { Object3D, PerspectiveCamera } from 'three';
import type { AircraftConfig, ChapterInfo } from '../aircraft';
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

    // Touch screens swipe rather than scroll.
    const coarse = window.matchMedia('(pointer: coarse)');
    const hint = q(root, '[data-field="scroll-verb"]');
    const egg = q(root, '[data-field="egg"]');
    const setHint = () => {
      hint.textContent = coarse.matches ? 'Swipe' : 'Scroll';
      egg.textContent = coarse.matches ? 'Psst — hold the gizmo.' : 'Psst — hold Space.';
    };
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

  setChapter(info: ChapterInfo): void {
    this.title.setChapter(info);
  }

  /**
   * 0..1, how much chapter text covers the screen. The placard and notes fade
   * by it, and stop taking clicks once the text is the thing being read.
   */
  setIntro(v: number): void {
    this.root.style.setProperty('--intro', v.toFixed(3));
    this.root.classList.toggle('is-intro', v > 0.5);
  }

  /**
   * Compare swaps the placard and notes for the compare panels. View modes
   * and thrust belong to a single aircraft, so they are switched off there;
   * orbit and sound still work.
   */
  setCompare(on: boolean): void {
    this.root.classList.toggle('is-compare', on);
    for (const b of this.root.querySelectorAll<HTMLButtonElement>('[data-mode], [data-toggle="thrust"]')) {
      b.disabled = on;
    }
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
