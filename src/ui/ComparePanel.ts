import { AIRCRAFT, byId, CHAPTERS, hasJets, SUGGESTED_PAIRS, type AircraftConfig } from '../aircraft';

/**
 * Compare-mode controls, in two pieces that take the placard's and the
 * notes' places on screen: the head (two aircraft pickers, the suggested
 * pairs, and the note that goes with a suggested pair) and the stat bars.
 *
 * Nothing here is drawn from anything but the aircraft data. A figure the
 * data does not have is shown as "not published" -- or "not flown", for a
 * concept that has no first flight to give -- and its bar as an empty
 * dashed track, never as a zero.
 */

const GEN: Record<AircraftConfig['spec']['generation'], { label: string; v: number }> = {
  '1': { label: 'First', v: 1 },
  '2': { label: 'Second', v: 2 },
  '3': { label: 'Third', v: 3 },
  '4': { label: 'Fourth', v: 4 },
  '4.5': { label: '4.5', v: 4.5 },
  '5': { label: 'Fifth', v: 5 },
  '6-concept': { label: 'Sixth, concept', v: 6 },
};

const ENGINE: Record<AircraftConfig['spec']['engines']['type'], string> = {
  turbojet: 'turbojet',
  'afterburning-turbojet': 'afterburning turbojet',
  turbofan: 'turbofan',
  'afterburning-turbofan': 'afterburning turbofan',
};

/** First-flight bars run along one timeline, so the two can be read against each other. */
const YEAR_FROM = 1935;
const YEAR_TO = 2030;

interface Stat {
  key: string;
  label: string;
  /** Text and bar length 0..1 for one aircraft, or null when the data has no figure. */
  read: (c: AircraftConfig, other: AircraftConfig) => { text: string; bar: number | null };
}

const missing = (text = 'not published') => ({ text, bar: null });

const STATS: Stat[] = [
  {
    key: 'length',
    label: 'Length',
    read: (c, o) =>
      c.spec.lengthM === undefined
        ? missing()
        : { text: `${c.spec.lengthM} m`, bar: c.spec.lengthM / Math.max(c.spec.lengthM, o.spec.lengthM ?? 0) },
  },
  {
    key: 'span',
    label: 'Span',
    read: (c, o) =>
      c.spec.spanM === undefined
        ? missing()
        : { text: `${c.spec.spanM} m`, bar: c.spec.spanM / Math.max(c.spec.spanM, o.spec.spanM ?? 0) },
  },
  {
    key: 'first-flight',
    label: 'First flight',
    read: (c) =>
      c.spec.firstFlight === undefined
        ? missing(c.spec.status === 'concept' ? 'not flown' : 'not published')
        : { text: String(c.spec.firstFlight), bar: (c.spec.firstFlight - YEAR_FROM) / (YEAR_TO - YEAR_FROM) },
  },
  {
    key: 'engines',
    label: 'Engines',
    read: (c) => ({
      text: `${c.spec.engines.count} × ${ENGINE[c.spec.engines.type]}`,
      bar: c.spec.engines.count / 2,
    }),
  },
  {
    key: 'generation',
    label: 'Generation',
    read: (c) => ({ text: GEN[c.spec.generation].label, bar: GEN[c.spec.generation].v / 6 }),
  },
];

const pairLabel = (a: AircraftConfig, b: AircraftConfig) => `${a.designation} vs ${b.designation}`;

export class ComparePanel {
  readonly head: HTMLElement;
  readonly stats: HTMLElement;
  private readonly pickers: Picker[];
  private readonly chips: HTMLButtonElement[] = [];
  private readonly note: HTMLElement;
  private readonly live: HTMLElement;
  private readonly rows = new Map<string, { a: HTMLElement[]; b: HTMLElement[] }>();
  private pair: [AircraftConfig, AircraftConfig] | null = null;

  constructor(
    root: HTMLElement,
    private readonly onPick: (a: string, b: string) => void,
  ) {
    this.head = document.createElement('section');
    this.head.className = 'compare-head';
    this.head.setAttribute('aria-label', 'Compare two aircraft');
    this.stats = document.createElement('section');
    this.stats.className = 'compare-stats';
    this.stats.setAttribute('aria-label', 'Side by side figures');

    const title = document.createElement('h2');
    title.className = 'compare-head__title';
    title.textContent = 'Compare';
    const pickRow = document.createElement('div');
    pickRow.className = 'compare-head__pickers';
    this.pickers = (['a', 'b'] as const).map(
      (slot) =>
        new Picker(slot, (id) => {
          if (!this.pair) return;
          const [a, b] = this.pair;
          // Picking the aircraft already in the other slot swaps the two.
          if (slot === 'a') this.onPick(id, id === b.id ? a.id : b.id);
          else this.onPick(id === a.id ? b.id : a.id, id);
        }),
    );
    const vs = document.createElement('span');
    vs.className = 'compare-head__vs';
    vs.setAttribute('aria-hidden', 'true');
    vs.textContent = 'vs';
    pickRow.append(this.pickers[0].el, vs, this.pickers[1].el);

    const chipRow = document.createElement('div');
    chipRow.className = 'compare-head__chips';
    chipRow.setAttribute('role', 'group');
    chipRow.setAttribute('aria-label', 'Suggested pairs');
    for (const s of SUGGESTED_PAIRS) {
      const a = byId(s.a);
      const b = byId(s.b);
      if (!a || !b) continue;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'compare-chip';
      chip.dataset.pair = `${a.id}|${b.id}`;
      chip.textContent = pairLabel(a, b);
      chip.setAttribute('aria-pressed', 'false');
      chip.addEventListener('click', () => this.onPick(a.id, b.id));
      chipRow.appendChild(chip);
      this.chips.push(chip);
    }

    this.note = document.createElement('p');
    this.note.className = 'compare-head__note';
    this.head.append(title, pickRow, chipRow, this.note);

    // Stat rows: a label, then one bar and figure per aircraft.
    const list = document.createElement('dl');
    list.className = 'compare-stats__list';
    for (const st of STATS) {
      const dt = document.createElement('dt');
      dt.textContent = st.label;
      const dd = document.createElement('dd');
      const make = (slot: 'a' | 'b') => {
        const row = document.createElement('div');
        row.className = `stat stat--${slot}`;
        const track = document.createElement('span');
        track.className = 'stat__track';
        track.setAttribute('aria-hidden', 'true');
        const fill = document.createElement('span');
        fill.className = 'stat__fill';
        track.appendChild(fill);
        const value = document.createElement('span');
        value.className = 'stat__value';
        row.append(track, value);
        dd.appendChild(row);
        return [row, fill, value];
      };
      const [rowA, fillA, valA] = make('a');
      const [rowB, fillB, valB] = make('b');
      list.append(dt, dd);
      this.rows.set(st.key, { a: [rowA, fillA, valA], b: [rowB, fillB, valB] });
    }
    this.stats.appendChild(list);

    this.live = document.createElement('p');
    this.live.className = 'sr-only';
    this.live.setAttribute('aria-live', 'polite');
    this.stats.appendChild(this.live);

    root.append(this.head, this.stats);
    document.addEventListener('pointerdown', (e) => {
      for (const p of this.pickers) if (!p.el.contains(e.target as Node)) p.close(false);
    });
  }

  show(a: AircraftConfig, b: AircraftConfig): void {
    this.pair = [a, b];
    this.pickers[0].set(a);
    this.pickers[1].set(b);
    for (const chip of this.chips) {
      const [x, y] = (chip.dataset.pair ?? '').split('|');
      chip.setAttribute('aria-pressed', String((x === a.id && y === b.id) || (x === b.id && y === a.id)));
    }
    const s = SUGGESTED_PAIRS.find((p) => (p.a === a.id && p.b === b.id) || (p.a === b.id && p.b === a.id));
    this.note.textContent = s?.note ?? '';
    this.note.hidden = !s;

    for (const st of STATS) {
      const row = this.rows.get(st.key);
      if (!row) continue;
      const write = ([el, fill, value]: HTMLElement[], c: AircraftConfig, other: AircraftConfig) => {
        const r = st.read(c, other);
        value.textContent = r.text;
        el.classList.toggle('is-missing', r.bar === null);
        fill.style.transform = `scaleX(${r.bar === null ? 0 : Math.max(0.02, Math.min(1, r.bar)).toFixed(3)})`;
      };
      write(row.a, a, b);
      write(row.b, b, a);
    }
    this.live.textContent = `Comparing ${a.name} and ${b.name}.`;
  }
}

/**
 * One aircraft picker: a button showing the current choice, opening a
 * searchable list grouped by era. The search field is an ARIA combobox over
 * the list; arrows move, Enter picks, Escape closes.
 */
class Picker {
  readonly el: HTMLElement;
  private readonly button: HTMLButtonElement;
  private readonly name: HTMLElement;
  private readonly pop: HTMLElement;
  private readonly input: HTMLInputElement;
  private readonly list: HTMLElement;
  private readonly options: HTMLElement[] = [];
  private active = -1;
  private current = '';

  constructor(
    private readonly slot: 'a' | 'b',
    private readonly onPick: (id: string) => void,
  ) {
    this.el = document.createElement('div');
    this.el.className = `picker picker--${slot}`;
    const listId = `picker-${slot}-list`;

    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'picker__button';
    this.button.setAttribute('aria-haspopup', 'listbox');
    this.button.setAttribute('aria-expanded', 'false');
    this.button.innerHTML = `<span class="picker__dot" aria-hidden="true"></span><span class="picker__name"></span><svg class="picker__chev" viewBox="0 0 10 6" width="10" height="6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`;
    this.name = this.button.querySelector('.picker__name') as HTMLElement;
    this.button.addEventListener('click', () => (this.pop.hidden ? this.open() : this.close(true)));

    this.pop = document.createElement('div');
    this.pop.className = 'picker__pop';
    this.pop.hidden = true;
    this.input = document.createElement('input');
    this.input.type = 'search';
    this.input.className = 'picker__search';
    this.input.placeholder = 'Search aircraft';
    this.input.setAttribute('role', 'combobox');
    this.input.setAttribute('aria-controls', listId);
    this.input.setAttribute('aria-expanded', 'true');
    this.input.setAttribute('aria-autocomplete', 'list');
    this.input.setAttribute('aria-label', `Aircraft ${slot === 'a' ? 'one' : 'two'}`);
    this.input.addEventListener('input', () => this.filter());
    this.input.addEventListener('keydown', (e) => this.key(e));

    this.list = document.createElement('ul');
    this.list.className = 'picker__list';
    this.list.id = listId;
    this.list.setAttribute('role', 'listbox');
    for (const ch of CHAPTERS) {
      if (!hasJets(ch.n)) continue;
      const group = document.createElement('li');
      group.className = 'picker__group';
      group.setAttribute('role', 'presentation');
      group.textContent = `${ch.label} · ${ch.title}`;
      this.list.appendChild(group);
      for (const c of AIRCRAFT.filter((x) => x.chapter === ch.n)) {
        const li = document.createElement('li');
        li.className = 'picker__option';
        li.id = `picker-${slot}-${c.id}`;
        li.dataset.id = c.id;
        li.dataset.chapter = String(ch.n);
        li.dataset.search = `${c.name} ${c.designation} ${c.exhibitNo}`.toLowerCase();
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', 'false');
        li.innerHTML = `<span class="picker__no">${c.exhibitNo}</span> `;
        li.append(c.name);
        li.addEventListener('pointerdown', (e) => e.preventDefault());
        li.addEventListener('click', () => this.choose(c.id));
        this.list.appendChild(li);
        this.options.push(li);
      }
    }
    this.pop.append(this.input, this.list);
    this.el.append(this.button, this.pop);
  }

  set(c: AircraftConfig): void {
    this.current = c.id;
    this.name.textContent = c.name;
    this.button.setAttribute('aria-label', `Aircraft ${this.slot === 'a' ? 'one' : 'two'}: ${c.name}. Change`);
    for (const o of this.options) o.setAttribute('aria-selected', String(o.dataset.id === c.id));
  }

  open(): void {
    this.pop.hidden = false;
    this.button.setAttribute('aria-expanded', 'true');
    this.input.value = '';
    this.filter();
    this.move(this.visible().findIndex((o) => o.dataset.id === this.current));
    this.input.focus();
  }

  close(returnFocus: boolean): void {
    if (this.pop.hidden) return;
    this.pop.hidden = true;
    this.button.setAttribute('aria-expanded', 'false');
    if (returnFocus) this.button.focus();
  }

  private visible(): HTMLElement[] {
    return this.options.filter((o) => !o.hidden);
  }

  private filter(): void {
    const q = this.input.value.trim().toLowerCase();
    for (const o of this.options) o.hidden = q !== '' && !(o.dataset.search ?? '').includes(q);
    // An era heading stays only while something under it does.
    for (const g of this.list.querySelectorAll<HTMLElement>('.picker__group')) {
      let n = g.nextElementSibling as HTMLElement | null;
      let any = false;
      while (n && !n.classList.contains('picker__group')) {
        if (!n.hidden) any = true;
        n = n.nextElementSibling as HTMLElement | null;
      }
      g.hidden = !any;
    }
    this.move(0);
  }

  private move(i: number): void {
    const vis = this.visible();
    for (const o of this.options) o.classList.remove('is-active');
    if (vis.length === 0) {
      this.active = -1;
      this.input.removeAttribute('aria-activedescendant');
      return;
    }
    this.active = Math.max(0, Math.min(vis.length - 1, i));
    const o = vis[this.active];
    o.classList.add('is-active');
    this.input.setAttribute('aria-activedescendant', o.id);
    o.scrollIntoView({ block: 'nearest' });
  }

  private key(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown') this.move(this.active + 1);
    else if (e.key === 'ArrowUp') this.move(this.active - 1);
    else if (e.key === 'Enter') {
      const o = this.visible()[this.active];
      if (o?.dataset.id) this.choose(o.dataset.id);
    } else if (e.key === 'Escape') this.close(true);
    else return;
    e.preventDefault();
    e.stopPropagation();
  }

  private choose(id: string): void {
    this.close(true);
    if (id !== this.current) this.onPick(id);
  }
}
