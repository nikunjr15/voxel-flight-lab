import { AIRCRAFT, CHAPTERS, hasJets, type AircraftConfig } from '../aircraft';
import type { Silhouette } from '../engine/build/silhouette';

/** Icon box, CSS pixels. */
const ICON = 30;

/**
 * The evolution ribbon: every aircraft as a small plan-view silhouette,
 * grouped by chapter, oldest on the left. It is how the visitor picks an
 * aircraft, and it shows where the current one sits in the whole story.
 *
 * Icons are 2D masks from the build worker, drawn once into small canvases.
 * Highlighting the current aircraft is CSS only, so nothing is redrawn as
 * the visitor moves.
 */
export class Ribbon {
  readonly el: HTMLElement;
  private readonly track: HTMLElement;
  private readonly buttons = new Map<string, HTMLButtonElement>();
  private readonly groups = new Map<number, HTMLElement>();
  private current = '';

  constructor(
    mount: HTMLElement,
    private readonly onSelect: (id: string) => void,
  ) {
    this.el = mount;
    this.el.classList.add('ribbon');
    this.el.setAttribute('aria-label', 'Aircraft, by chapter');
    this.track = document.createElement('div');
    this.track.className = 'ribbon__track';
    this.el.appendChild(this.track);
    this.track.addEventListener('keydown', (e) => this.key(e));
    new ResizeObserver(() => this.measure()).observe(this.track);

    for (const ch of CHAPTERS) {
      if (!hasJets(ch.n)) continue;
      const group = document.createElement('div');
      group.className = 'ribbon__group';
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', `Chapter ${ch.label}, ${ch.title}`);
      const label = document.createElement('span');
      label.className = 'ribbon__ch';
      label.setAttribute('aria-hidden', 'true');
      label.textContent = ch.label;
      group.appendChild(label);
      for (const c of AIRCRAFT.filter((a) => a.chapter === ch.n)) group.appendChild(this.button(c));
      this.track.appendChild(group);
      this.groups.set(ch.n, group);
    }
  }

  private button(c: AircraftConfig): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ribbon__jet';
    b.dataset.id = c.id;
    b.title = c.name;
    b.setAttribute('aria-label', `${c.name}, exhibit ${c.exhibitNo}${c.spec.status === 'concept' ? ', concept' : ''}`);
    const canvas = document.createElement('canvas');
    canvas.className = 'ribbon__icon';
    canvas.setAttribute('aria-hidden', 'true');
    b.appendChild(canvas);
    b.tabIndex = -1;
    b.addEventListener('click', () => this.onSelect(c.id));
    this.buttons.set(c.id, b);
    return b;
  }

  /** Draws one aircraft's mask, fitted to the icon box with the nose up. */
  setMask(s: Silhouette): void {
    const canvas = this.buttons.get(s.id)?.querySelector('canvas');
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(ICON * dpr);
    canvas.height = Math.round(ICON * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // The mask at one pixel per cell, then scaled down with smoothing: a
    // soft-edged silhouette for the price of one drawImage.
    const src = document.createElement('canvas');
    src.width = s.w;
    src.height = s.h;
    const sctx = src.getContext('2d');
    if (!sctx) return;
    const img = sctx.createImageData(s.w, s.h);
    for (let i = 0; i < s.cells.length; i++) {
      const v = s.cells[i];
      if (v === 0) continue;
      // Ink for the airframe, a lighter grey for the canopy.
      const [r, g, b] = v === 2 ? [134, 142, 149] : [22, 25, 28];
      img.data[i * 4] = r;
      img.data[i * 4 + 1] = g;
      img.data[i * 4 + 2] = b;
      img.data[i * 4 + 3] = 255;
    }
    sctx.putImageData(img, 0, 0);

    const box = canvas.width * 0.92;
    const k = Math.min(box / s.w, box / s.h);
    const dw = s.w * k;
    const dh = s.h * k;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
    canvas.classList.add('is-drawn');
  }

  /**
   * One tab stop for the whole strip -- twenty-seven buttons in the tab order
   * would be a wall -- with the arrow keys moving between aircraft inside it
   * and Enter or Space choosing one.
   */
  private key(e: KeyboardEvent): void {
    const list = [...this.buttons.values()];
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    let j = i;
    if (e.key === 'ArrowRight') j = Math.min(list.length - 1, i + 1);
    else if (e.key === 'ArrowLeft') j = Math.max(0, i - 1);
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = list.length - 1;
    else return;
    e.preventDefault();
    e.stopPropagation();
    this.rove(list[j]);
    list[j].focus();
  }

  private rove(to: HTMLButtonElement): void {
    for (const b of this.buttons.values()) b.tabIndex = b === to ? 0 : -1;
  }

  /** Marks the aircraft on show and the chapter it belongs to. */
  setCurrent(id: string, chapter: number): void {
    if (this.current) this.buttons.get(this.current)?.removeAttribute('aria-current');
    this.current = id;
    const b = this.buttons.get(id);
    b?.setAttribute('aria-current', 'true');
    // The tab stop follows the current aircraft, unless focus is already in the strip.
    if (b && !this.track.contains(document.activeElement)) this.rove(b);
    this.setChapter(chapter);
    if (b) this.queueReveal(b);
  }

  /** Dims every chapter but the one on screen. */
  setChapter(chapter: number): void {
    for (const [n, g] of this.groups) g.classList.toggle('is-active', n === chapter);
  }

  private revealFrame = 0;

  private queueReveal(b: HTMLElement): void {
    cancelAnimationFrame(this.revealFrame);
    this.revealFrame = requestAnimationFrame(() => this.reveal(b));
  }

  /**
   * The strip's geometry, read in a ResizeObserver callback -- after layout,
   * where reading costs nothing -- and kept. Read on demand, mid aircraft
   * change, it forced a full layout of a page that had just had its placard
   * and notes rebuilt: 25-35 ms on a throttled phone.
   */
  private geometry: { client: number; scroll: number; at: Map<string, { left: number; width: number }> } | null = null;

  private measure(): void {
    const at = new Map<string, { left: number; width: number }>();
    for (const [id, b] of this.buttons) at.set(id, { left: b.offsetLeft, width: b.offsetWidth });
    this.geometry = { client: this.track.clientWidth, scroll: this.track.scrollWidth, at };
  }

  /** Scrolls the strip, not the page, so the current icon sits near the middle. */
  private reveal(b: HTMLElement): void {
    const g = this.geometry;
    const at = g?.at.get(b.dataset.id ?? '');
    if (!g || !at || g.scroll <= g.client + 1) return;
    const left = at.left - (g.client - at.width) / 2;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.track.scrollTo({ left, behavior: reduced ? 'auto' : 'smooth' });
  }
}
