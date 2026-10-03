import { chapterInfo, COUNTRIES, type AircraftConfig, type ChapterInfo } from '../aircraft';

const q = <T extends HTMLElement>(root: ParentNode, sel: string): T => {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`Missing ${sel}`);
  return el;
};

/** Names longer than this get the smaller display size, so they wrap in two. */
const LONG_NAME = 14;

/**
 * The placard: top-right metadata, then the category line, the display title
 * with its superscript exhibit number, the two-line subtitle and the national
 * colour bar. Swapping aircraft slides the old text out and the new text in
 * on the expo curve; with reduced motion it is a plain crossfade.
 */
export class Title {
  private readonly block: HTMLElement;
  private readonly eyebrow: HTMLElement;
  private readonly name: HTMLElement;
  private readonly sup: HTMLElement;
  private readonly subA: HTMLElement;
  private readonly subB: HTMLElement;
  private readonly bar: HTMLElement;
  private readonly metaExhibit: HTMLElement;
  private readonly metaCountry: HTMLElement;
  private readonly metaChapter: HTMLElement;
  private swapTimer = 0;
  private first = true;
  /** The chapter on screen, which can differ from the aircraft's own. */
  private chapter: ChapterInfo | null = null;

  constructor(root: HTMLElement) {
    this.block = q(root, '.chrome__main');
    this.eyebrow = q(root, '[data-field="category"]');
    this.name = q(root, '[data-field="name"]');
    this.sup = q(root, '.display__sup');
    this.subA = q(root, '[data-field="subtitle-a"]');
    this.subB = q(root, '[data-field="subtitle-b"]');
    this.bar = q(root, '[data-field="colourbar"]');
    this.metaExhibit = q(root, '.meta [data-field="exhibit"]');
    this.metaCountry = q(root, '.meta [data-field="country"]');
    this.metaChapter = q(root, '.meta [data-field="chapter"]');
  }

  show(c: AircraftConfig): void {
    const apply = () => this.fill(c);
    if (this.first) {
      this.first = false;
      apply();
      return;
    }
    // Out, swap, in. The CSS owns the curves and durations.
    window.clearTimeout(this.swapTimer);
    this.block.classList.add('is-leaving');
    this.swapTimer = window.setTimeout(() => {
      apply();
      this.block.classList.remove('is-leaving');
    }, 260);
  }

  /** Names the chapter on screen in the top-right metadata. */
  setChapter(info: ChapterInfo): void {
    this.chapter = info;
    this.metaChapter.textContent = info.n === 0 ? `${info.label} ${info.era}` : `${info.label} ${info.title}`;
  }

  private fill(c: AircraftConfig): void {
    const country = COUNTRIES[c.spec.country];
    const concept = c.spec.status === 'concept';

    this.eyebrow.textContent = c.copy.category;
    if (concept) {
      // Labelled wherever the aircraft is named. Nothing here should be
      // mistakable for something that has flown.
      const tag = document.createElement('span');
      tag.className = 'tag-concept';
      tag.textContent = 'Concept';
      this.eyebrow.append(' ', tag);
    }

    this.name.textContent = c.name;
    this.block.classList.toggle('is-long', c.name.length > LONG_NAME);
    // Read as "Su-27 Flanker, exhibit 012"; seen as a bare superscript number.
    this.sup.innerHTML = '<span class="sr-only">, exhibit </span>';
    this.sup.append(c.exhibitNo);
    this.subA.textContent = c.copy.subtitle[0];
    this.subB.textContent = c.copy.subtitle[1];

    this.bar.innerHTML = '';
    for (const colour of country.bar) {
      const seg = document.createElement('span');
      seg.style.background = colour;
      this.bar.appendChild(seg);
    }
    this.bar.setAttribute('aria-label', `${country.name} national colours`);

    this.metaExhibit.textContent = c.exhibitNo;
    this.metaCountry.textContent = country.name;
    const chapter = this.chapter ?? chapterInfo(c.chapter);
    if (chapter) this.setChapter(chapter);
    document.title = `${c.name} — Voxel Flight Lab`;
  }
}
