import { ICONS } from './icons';
import type { ModeId, Store, ToggleId, ViewerState } from '../app/store';

interface ModeDef {
  id: ModeId;
  label: string;
}

interface ToggleDef {
  id: ToggleId;
  label: string;
  /** Accessible name; the visible label alone does not say what it toggles. */
  name: string;
}

/** Order matters: it is the number-key order as well as the visual order. */
export const MODES: ModeDef[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'plan', label: 'Plan view' },
  { id: 'cockpit', label: 'Cockpit' },
  { id: 'engines', label: 'Engines' },
  { id: 'weapons', label: 'Weapons' },
  { id: 'xray', label: 'X-ray' },
];

const TOGGLES: ToggleDef[] = [
  { id: 'orbit', label: 'Orbit', name: 'Free orbit' },
  { id: 'thrust', label: 'Thrust', name: 'Afterburner' },
  { id: 'sound', label: 'Sound', name: 'Engine sound' },
];

/**
 * The floating pill at the bottom of the screen: one dark pill for the active
 * view mode, and toggle chips whose state is carried by a status dot. Only the
 * mode is ever a filled pill, so there is one strong mark on screen at a time.
 *
 * Buttons with aria-pressed rather than a tab list: the modes change how the
 * same exhibit is shown, they do not switch between panels of content.
 */
export class Toolbar {
  readonly el: HTMLElement;
  private readonly modeButtons = new Map<ModeId, HTMLButtonElement>();
  private readonly toggleButtons = new Map<ToggleId, HTMLButtonElement>();

  constructor(
    mount: HTMLElement,
    store: Store<ViewerState>,
  ) {
    this.el = mount;
    this.el.classList.add('toolbar');
    this.el.setAttribute('aria-label', 'Viewer controls');
    this.el.innerHTML = '';

    const modes = document.createElement('div');
    modes.className = 'toolbar__group';
    modes.setAttribute('role', 'group');
    modes.setAttribute('aria-label', 'View mode');
    MODES.forEach((m, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tab';
      b.dataset.mode = m.id;
      b.setAttribute('aria-keyshortcuts', String(i + 1));
      b.innerHTML = `${ICONS[m.id]}<span>${m.label}</span>`;
      b.addEventListener('click', () => store.set('mode', m.id));
      modes.appendChild(b);
      this.modeButtons.set(m.id, b);
    });

    const rule = document.createElement('span');
    rule.className = 'toolbar__rule';
    rule.setAttribute('aria-hidden', 'true');

    const toggles = document.createElement('div');
    toggles.className = 'toolbar__group';
    toggles.setAttribute('role', 'group');
    toggles.setAttribute('aria-label', 'Toggles');
    for (const t of TOGGLES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.dataset.toggle = t.id;
      b.setAttribute('aria-label', t.name);
      b.innerHTML = `<span class="chip__dot" aria-hidden="true"></span><span>${t.label}</span>`;
      b.addEventListener('click', () => store.set(t.id, !store.get(t.id)));
      toggles.appendChild(b);
      this.toggleButtons.set(t.id, b);
    }

    this.el.append(modes, rule, toggles);

    store.on('mode', (mode) => this.syncMode(mode));
    for (const t of TOGGLES) store.on(t.id, (on) => this.syncToggle(t.id, on));
    this.syncMode(store.get('mode'));
    for (const t of TOGGLES) this.syncToggle(t.id, store.get(t.id));
  }

  private syncMode(mode: ModeId): void {
    for (const [id, b] of this.modeButtons) {
      const on = id === mode;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    }
    // Keep the active tab in view when the pill is scrolling on a phone.
    const active = this.modeButtons.get(mode);
    if (active && this.el.scrollWidth > this.el.clientWidth) {
      active.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }
  }

  private syncToggle(id: ToggleId, on: boolean): void {
    const b = this.toggleButtons.get(id);
    if (!b) return;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-pressed', String(on));
  }
}
