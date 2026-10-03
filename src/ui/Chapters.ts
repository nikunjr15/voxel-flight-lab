import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { byChapter, CHAPTERS, hasJets, type ChapterInfo } from '../aircraft';

gsap.registerPlugin(ScrollTrigger);

export interface ChapterEvents {
  /** The chapter under the middle of the screen changed. */
  onActive(n: number): void;
  /** 0..1: how much of the screen chapter text covers. The exhibit placard fades by it. */
  onIntro(cover: number): void;
  /** 0 at the top of the page, 1 once the introduction has scrolled away. */
  onCover(progress: number): void;
  /** A visitor picked an aircraft from a chapter's list. */
  onSelect(id: string): void;
}

/**
 * The scrolling story. Each chapter is a section in the page: its text first,
 * a screen-high run of exhibit after it, so the text scrolls up over the
 * stage and then leaves the aircraft alone with its placard. The aircraft
 * itself is the fixed canvas behind; this class only reports where the
 * reader is and lets the app decide what to show.
 *
 * Everything here is real HTML in document order, so the chapters read
 * correctly with no script-driven layout at all; ScrollTrigger only watches.
 */
export class Chapters {
  readonly el: HTMLElement;
  private readonly sections = new Map<number, HTMLElement>();
  private readonly intros: HTMLElement[] = [];
  private readonly triggers: ScrollTrigger[] = [];
  private active = -1;
  private resolveQueued = false;
  private reduced = false;
  /** Last visibility written per element, so unchanged ones are left alone. */
  private readonly shown = new WeakMap<HTMLElement, number>();

  constructor(
    mount: HTMLElement,
    private readonly events: ChapterEvents,
    reduced: boolean,
  ) {
    this.el = mount;
    this.el.classList.add('chapters');
    for (const ch of CHAPTERS) this.el.appendChild(this.section(ch));
    this.el.appendChild(this.siteFooter());
    this.watch(reduced);
  }

  get current(): number {
    return this.active;
  }

  private section(ch: ChapterInfo): HTMLElement {
    const s = document.createElement('section');
    s.className = `chapter chapter--${ch.n}`;
    s.id = `chapter-${ch.n}`;
    s.dataset.chapter = String(ch.n);
    s.setAttribute('aria-labelledby', `chapter-${ch.n}-title`);

    const intro = document.createElement('div');
    intro.className = 'chapter__intro';
    const inner = document.createElement('div');
    inner.className = 'chapter__inner';

    const label = document.createElement('p');
    label.className = 'chapter__label';
    label.textContent = ch.n === 0 ? ch.era : `Chapter ${ch.label} · ${ch.era}`;

    const title = document.createElement('h2');
    title.className = 'chapter__title';
    title.id = `chapter-${ch.n}-title`;
    title.textContent = ch.title;

    const summary = document.createElement('p');
    summary.className = 'chapter__summary';
    summary.textContent = ch.summary;

    const callout = document.createElement('aside');
    callout.className = 'chapter__innovation';
    callout.setAttribute('aria-label', 'Key innovation');
    callout.innerHTML = '<p class="chapter__kicker">Key innovation</p>';
    const h3 = document.createElement('h3');
    h3.textContent = ch.innovation.title;
    const body = document.createElement('p');
    body.textContent = ch.innovation.body;
    callout.append(h3, body);

    inner.append(label, title, summary, callout);

    if (hasJets(ch.n)) {
      const list = document.createElement('ul');
      list.className = 'chapter__jets';
      list.setAttribute('aria-label', `Aircraft in ${ch.title}`);
      for (const c of byChapter(ch.n)) {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'chapter__jet';
        b.innerHTML = `<span class="chapter__jet-no">${c.exhibitNo}</span> `;
        b.append(c.name);
        if (c.spec.status === 'concept') {
          const tag = document.createElement('span');
          tag.className = 'tag-concept';
          tag.textContent = 'Concept';
          b.append(' ', tag);
        }
        b.addEventListener('click', () => this.events.onSelect(c.id));
        li.appendChild(b);
        list.appendChild(li);
      }
      inner.appendChild(list);
    }
    if (ch.n === 0) {
      const cue = document.createElement('p');
      cue.className = 'chapter__cue';
      cue.setAttribute('aria-hidden', 'true');
      cue.textContent = 'Scroll';
      inner.appendChild(cue);
    }

    intro.appendChild(inner);
    s.appendChild(intro);
    this.intros.push(inner);

    // The exhibit run: a screen of scrolling with nothing over the aircraft
    // but its own placard. The introduction has none; it hands straight on.
    if (ch.n !== 0) {
      const run = document.createElement('div');
      run.className = 'chapter__exhibit';
      run.setAttribute('aria-hidden', 'true');
      s.appendChild(run);
    }
    this.sections.set(ch.n, s);
    return s;
  }

  /**
   * The page's closing words. It joins the chapter text in the sequencing, so
   * the placard or the compare panels make way for it like any chapter.
   */
  private siteFooter(): HTMLElement {
    const foot = document.createElement('footer');
    foot.className = 'site-foot';
    const inner = document.createElement('div');
    inner.className = 'chapter__inner site-foot__inner';
    inner.innerHTML = `
      <p class="chapter__label">About this exhibit</p>
      <p class="site-foot__legal">A design concept. Not affiliated with or endorsed by any manufacturer or air force. Specifications are approximate public figures; where a figure is not published, it is left out.</p>
      <p class="site-foot__credit">Every airframe, icon and sound is generated in code. Built with Three.js and GSAP; set in Space Grotesk and JetBrains Mono.</p>`;
    foot.appendChild(inner);
    this.intros.push(inner);
    return foot;
  }

  private watch(reduced: boolean): void {
    this.reduced = reduced;
    for (const s of this.sections.values()) {
      this.triggers.push(
        ScrollTrigger.create({
          trigger: s,
          start: 'top 50%',
          end: 'bottom 50%',
          onToggle: () => this.queueResolve(),
        }),
      );
    }

    const cover = this.sections.get(0);
    if (cover) {
      this.triggers.push(
        ScrollTrigger.create({
          trigger: cover,
          start: 'top top',
          end: 'bottom 30%',
          onUpdate: (self) => this.events.onCover(self.progress),
          onRefresh: (self) => this.events.onCover(self.progress),
        }),
      );
    }

    this.triggers.push(
      ScrollTrigger.create({
        start: 0,
        end: 'max',
        onUpdate: () => this.measure(),
        onRefresh: () => {
          this.measure();
          this.queueResolve();
        },
      }),
    );
  }

  /**
   * A fast scroll can toggle several sections in one frame. Settle on the one
   * actually under the middle of the screen, once, after the dust clears.
   */
  private queueResolve(): void {
    if (this.resolveQueued) return;
    this.resolveQueued = true;
    requestAnimationFrame(() => {
      this.resolveQueued = false;
      const mid = window.innerHeight * 0.5;
      // The chapter under the middle of the screen; below the last one, in
      // the closing footer, the last chapter passed, so a jump to the end of
      // the page lands where scrolling there would have.
      let found = -1;
      let passed = -1;
      for (const [n, s] of this.sections) {
        const r = s.getBoundingClientRect();
        if (r.top <= mid && r.bottom > mid) found = n;
        if (r.height > 0 && r.top <= mid) passed = n;
      }
      if (found < 0) found = passed;
      if (found < 0 || found === this.active) return;
      this.active = found;
      this.events.onActive(found);
    });
  }

  /**
   * Chapter text and the exhibit placard take turns; they never share the
   * screen. Both are scrubbed by scroll position, in fractions of the
   * viewport height, on fixed marks:
   *
   *   on the way in   placard clears as the text's top rises 1.02 -> 0.92;
   *                   text appears as its top rises 0.86 -> 0.68
   *   on the way out  text clears as its bottom rises 0.36 -> 0.18;
   *                   placard returns as it rises 0.14 -> 0.04
   *
   * The gaps between the marks are the pause between one leaving and the
   * other arriving. The placard also needs an exhibit run under the middle
   * of the screen, so it cannot surface between the introduction and
   * chapter one, which have none between them.
   */
  private measure(): void {
    const vh = window.innerHeight || 1;
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    // Read everything first, then write, so the styles never force a layout.
    const boxes = this.intros.map((el) => el.getBoundingClientRect());
    const runs = [...this.el.querySelectorAll<HTMLElement>('.chapter__exhibit')].map((el) => el.getBoundingClientRect());

    let hold = 0;
    boxes.forEach((r, k) => {
      const top = r.top / vh;
      const bottom = r.bottom / vh;
      // How much this text holds the placard back.
      hold = Math.max(hold, Math.min(clamp((1.02 - top) / 0.1), clamp((bottom - 0.04) / 0.1)));
      const leave = clamp((bottom - 0.18) / 0.18);
      const children = this.intros[k].children;
      for (let i = 0; i < children.length; i++) {
        // Lines arrive one after another, a few hundredths of a screen apart.
        const enter = clamp((0.86 - i * 0.025 - top) / 0.18);
        const v = Math.round(Math.min(enter, leave) * 100) / 100;
        const el = children[i] as HTMLElement;
        // Writing a style, even an unchanged one, dirties it for the next
        // recalc; nine chapters of it on every scroll frame was most of the
        // cost of the frame. Only what changed is written.
        if (this.shown.get(el) === v) continue;
        this.shown.set(el, v);
        el.style.opacity = String(v);
        // Opacity only: visibility would take the text out of the tab order and
        // the accessibility tree, and screen readers read every chapter.
        el.style.transform = this.reduced || v >= 1 ? '' : `translateY(${((1 - v) * 24).toFixed(1)}px)`;
      }
      // The panel behind the text on a phone fades with it.
      const panel = Math.round(Math.min(clamp((0.86 - top) / 0.18), leave) * 100) / 100;
      if (this.shown.get(this.intros[k]) !== panel) {
        this.shown.set(this.intros[k], panel);
        this.intros[k].style.setProperty('--text', String(panel));
      }
    });

    let run = 0;
    for (const r of runs) {
      run = Math.max(run, Math.min(clamp((vh * 0.6 - r.top) / (vh * 0.1)), clamp((r.bottom - vh * 0.4) / (vh * 0.1))));
    }
    this.events.onIntro(Math.max(hold, 1 - run));
  }

  /**
   * Moves the page to a chapter at once: to the top of its text, or to its
   * exhibit run with the text already scrolled away. Programmatic moves are
   * instant; the voxel morph is the transition.
   */
  jumpTo(n: number, where: 'intro' | 'exhibit'): void {
    const s = this.sections.get(n);
    if (!s) return;
    const intro = s.querySelector<HTMLElement>('.chapter__intro');
    const y = s.getBoundingClientRect().top + window.scrollY;
    const top = where === 'exhibit' && intro ? y + intro.offsetHeight : y;
    window.scrollTo({ top, behavior: 'instant' as ScrollBehavior });
    ScrollTrigger.update();
    this.queueResolve();
  }

  refresh(): void {
    ScrollTrigger.refresh();
  }

  dispose(): void {
    for (const t of this.triggers) t.kill();
    this.el.innerHTML = '';
  }
}
