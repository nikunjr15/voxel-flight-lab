import { AIRCRAFT, CHAPTERS, hasJets, type AircraftConfig } from '../aircraft';
import { SpecTable } from './SpecTable';

const DISCLAIMER =
  'A design concept. Not affiliated with or endorsed by any manufacturer or air force. Specifications are approximate public figures.';

/** Makes the page usable again if the loader is still up when we give up on 3D. */
function releaseLoader(): void {
  document.querySelector('.loader')?.remove();
  document.documentElement.classList.remove('is-loading');
  document.documentElement.classList.add('is-entered');
  for (const el of document.querySelectorAll('[inert]')) el.removeAttribute('inert');
}

function aircraft(c: AircraftConfig): HTMLElement {
  const art = document.createElement('article');
  art.className = 'fallback__aircraft';
  const h3 = document.createElement('h3');
  h3.textContent = c.name;
  if (c.spec.status === 'concept') {
    const tag = document.createElement('span');
    tag.className = 'tag-concept';
    tag.textContent = 'Concept';
    h3.append(' ', tag);
  }
  const cat = document.createElement('p');
  cat.className = 'fallback__category';
  cat.textContent = `Exhibit ${c.exhibitNo} · ${c.copy.category}`;
  const sub = document.createElement('p');
  sub.textContent = `${c.copy.subtitle[0]} ${c.copy.subtitle[1]}`;
  art.append(h3, cat, sub);
  new SpecTable(art).show(c);
  const notes = document.createElement('dl');
  notes.className = 'fallback__notes';
  for (const a of c.copy.annotations) {
    const dt = document.createElement('dt');
    dt.textContent = a.title;
    const dd = document.createElement('dd');
    dd.textContent = a.body;
    notes.append(dt, dd);
  }
  art.appendChild(notes);
  return art;
}

/**
 * The whole collection as a document, for a browser or device that cannot
 * run WebGL: every chapter's text, and every aircraft's specification table
 * and notes. Nothing is lost but the models themselves.
 */
export function renderFallback(): void {
  releaseLoader();
  document.documentElement.classList.add('is-no-gl');
  for (const sel of ['#stage', '.chrome', '[data-mount="chapters"]']) document.querySelector(sel)?.remove();

  const main = document.createElement('main');
  main.className = 'fallback';
  main.id = 'exhibit';
  const h1 = document.createElement('h1');
  h1.textContent = 'Voxel Flight Lab';
  const note = document.createElement('p');
  note.className = 'fallback__note';
  note.setAttribute('role', 'status');
  note.textContent =
    'The 3D exhibit needs WebGL 2, which this browser or device has not made available. Here is the collection as text. Turning on hardware acceleration, or trying another browser, usually brings the models back.';
  main.append(h1, note);

  for (const ch of CHAPTERS) {
    if (!hasJets(ch.n)) continue;
    const s = document.createElement('section');
    s.className = 'fallback__chapter';
    const h2 = document.createElement('h2');
    h2.textContent = `${ch.label} · ${ch.title}`;
    const era = document.createElement('p');
    era.className = 'fallback__category';
    era.textContent = ch.era;
    const summary = document.createElement('p');
    summary.textContent = ch.summary;
    const inn = document.createElement('p');
    inn.innerHTML = '<strong></strong> ';
    (inn.firstChild as HTMLElement).textContent = `Key innovation: ${ch.innovation.title}.`;
    inn.append(ch.innovation.body);
    s.append(h2, era, summary, inn);
    for (const c of AIRCRAFT.filter((a) => a.chapter === ch.n)) s.appendChild(aircraft(c));
    main.appendChild(s);
  }
  const foot = document.createElement('footer');
  foot.className = 'fallback__foot';
  foot.textContent = DISCLAIMER;
  main.appendChild(foot);
  document.body.appendChild(main);
}

/**
 * The graphics context went away mid-visit (a GPU reset, a driver update, the
 * system reclaiming memory). Say so, keep the current aircraft's figures on
 * screen, and reload once the browser offers the context back.
 */
export function watchContextLoss(canvas: HTMLCanvasElement): void {
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    releaseLoader();
    document.documentElement.classList.add('is-gl-lost');
    if (document.querySelector('.gl-lost')) return;
    const box = document.createElement('div');
    box.className = 'gl-lost';
    box.setAttribute('role', 'alert');
    const p = document.createElement('p');
    p.textContent = 'The 3D view stopped: the graphics context was lost. The figures for this aircraft are below.';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'loader__btn loader__btn--primary';
    b.textContent = 'Reload the view';
    b.addEventListener('click', () => location.reload());
    box.append(p, b);
    document.body.appendChild(box);
    b.focus();
  });
  // Coming back, the cleanest state is a fresh page at the same address.
  canvas.addEventListener('webglcontextrestored', () => location.reload());
}
