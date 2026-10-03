import type { Annotation } from '../aircraft/types';
import type { Store, ViewerState } from '../app/store';

/**
 * Numbered note cards, bottom left. Three sit side by side when there is room;
 * on a narrow or short screen one card shows at a time with an index of numbers
 * above it. The switch is pure CSS -- this class only keeps track of which card
 * is the active one -- so a resize never re-renders anything.
 *
 * In cockpit mode the view runs the full height of a phone screen, so there the
 * notes fold down to the row of numbers, and a number opens its card. The fold
 * is CSS too: this class only marks the notes as foldable, and open or shut.
 */
export class Annotations {
  readonly el: HTMLElement;
  private readonly index: HTMLElement;
  private readonly cards: HTMLElement;
  private count = 0;
  private foldable = false;
  private open = false;

  constructor(
    mount: HTMLElement,
    private readonly store: Store<ViewerState>,
  ) {
    this.el = mount;
    this.el.classList.add('notes');
    this.el.setAttribute('aria-label', 'Exhibit notes');
    this.el.innerHTML = '';

    this.index = document.createElement('div');
    this.index.className = 'notes__index';
    this.index.setAttribute('role', 'group');
    this.index.setAttribute('aria-label', 'Choose a note');

    this.cards = document.createElement('div');
    this.cards.className = 'notes__cards';

    this.el.append(this.index, this.cards);
    store.on('note', (i) => this.sync(i));
    store.on('mode', (m) => this.setFoldable(m === 'cockpit'));
    this.setFoldable(store.get('mode') === 'cockpit');
  }

  show(notes: Annotation[]): void {
    this.count = notes.length;
    this.index.innerHTML = '';
    this.cards.innerHTML = '';

    notes.forEach((a, i) => {
      const id = `note-${i}`;
      const card = document.createElement('article');
      card.className = 'note';
      card.id = id;
      const h = document.createElement('h2');
      h.className = 'note__title';
      h.innerHTML = `<span class="note__n">${a.n} —</span> `;
      h.append(a.title);
      const p = document.createElement('p');
      p.textContent = a.body;
      card.append(h, p);
      this.cards.appendChild(card);

      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'notes__num';
      b.textContent = a.n;
      b.setAttribute('aria-controls', id);
      b.setAttribute('aria-label', `Note ${a.n}: ${a.title}`);
      b.addEventListener('click', () => {
        // Folded, a number opens its card, and the open card's number shuts it.
        if (this.foldable) this.setOpen(!(this.open && this.store.get('note') === i));
        this.store.set('note', i);
      });
      this.index.appendChild(b);
    });

    // A new aircraft starts at its first note.
    if (this.store.get('note') !== 0) this.store.set('note', 0);
    else this.sync(0);
  }

  /** Steps the single visible card, wrapping. */
  step(delta: number): void {
    if (this.count === 0) return;
    this.store.set('note', (this.store.get('note') + delta + this.count) % this.count);
  }

  private setFoldable(on: boolean): void {
    this.foldable = on;
    this.el.classList.toggle('is-foldable', on);
    this.setOpen(false);
  }

  private setOpen(on: boolean): void {
    this.open = on;
    this.el.classList.toggle('is-open', on);
    for (const b of this.index.children) {
      if (this.foldable) b.setAttribute('aria-expanded', String(on && b.getAttribute('aria-current') === 'true'));
      else b.removeAttribute('aria-expanded');
    }
  }

  private sync(active: number): void {
    [...this.cards.children].forEach((c, i) => c.classList.toggle('is-active', i === active));
    [...this.index.children].forEach((b, i) => {
      if (i === active) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    });
    this.setOpen(this.open);
  }
}
