import { Object3D, PerspectiveCamera, Quaternion, Vector3 } from 'three';

const AXES = [
  { key: 'x', dir: new Vector3(1, 0, 0), colour: '#c0472b' },
  { key: 'y', dir: new Vector3(0, 1, 0), colour: '#2f6f52' },
  { key: 'z', dir: new Vector3(0, 0, 1), colour: '#36506e' },
] as const;

const SIZE = 44;
const C = SIZE / 2;
const LEN = 15;

/**
 * Three-axis gizmo, bottom right. It shows the airframe's own axes as the
 * camera sees them, so it turns with the idle rotation and with orbit; a
 * static icon would only be decoration. Axes pointing away are drawn first
 * and dimmed, the way a real view gizmo reads depth.
 */
export class Gizmo {
  readonly svg: SVGSVGElement;
  private readonly lines: SVGLineElement[] = [];
  private readonly tips: SVGTextElement[] = [];
  private readonly last = new Quaternion();
  private primed = false;
  private readonly q = new Quaternion();
  private readonly inv = new Quaternion();
  private readonly v = new Vector3();
  /** Last values written, per element and attribute: the gizmo turns every idle frame, and re-sorting or re-writing unchanged SVG each frame kept the page's style dirty. */
  private readonly written = new Map<Element, Record<string, string>>();
  private lastOrder = '';

  constructor(mount: HTMLElement) {
    const NS = 'http://www.w3.org/2000/svg';
    this.svg = document.createElementNS(NS, 'svg');
    this.svg.setAttribute('class', 'gizmo');
    this.svg.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
    this.svg.setAttribute('width', String(SIZE));
    this.svg.setAttribute('height', String(SIZE));
    this.svg.setAttribute('aria-hidden', 'true');

    const ring = document.createElementNS(NS, 'circle');
    ring.setAttribute('cx', String(C));
    ring.setAttribute('cy', String(C));
    ring.setAttribute('r', String(LEN + 4));
    ring.setAttribute('class', 'gizmo__ring');
    this.svg.appendChild(ring);

    for (const a of AXES) {
      const line = document.createElementNS(NS, 'line');
      line.setAttribute('x1', String(C));
      line.setAttribute('y1', String(C));
      line.setAttribute('stroke', a.colour);
      line.setAttribute('stroke-width', '1.6');
      line.setAttribute('stroke-linecap', 'round');
      const tip = document.createElementNS(NS, 'text');
      tip.textContent = a.key.toUpperCase();
      tip.setAttribute('fill', a.colour);
      tip.setAttribute('class', 'gizmo__tip');
      this.lines.push(line);
      this.tips.push(tip);
    }
    const hub = document.createElementNS(NS, 'circle');
    hub.setAttribute('cx', String(C));
    hub.setAttribute('cy', String(C));
    hub.setAttribute('r', '1.8');
    hub.setAttribute('class', 'gizmo__hub');

    this.svg.append(...this.lines, ...this.tips, hub);
    mount.prepend(this.svg);
  }

  /** Called every frame; does nothing unless the relative orientation moved. */
  update(camera: PerspectiveCamera, model: Object3D): void {
    // Model axes into camera space: model world rotation, then the inverse
    // of the camera's.
    model.getWorldQuaternion(this.q);
    this.q.premultiply(this.inv.copy(camera.quaternion).invert());
    if (this.primed && this.q.angleTo(this.last) < 0.002) return;
    this.primed = true;
    this.last.copy(this.q);

    const order = AXES.map((a, i) => {
      this.v.copy(a.dir).applyQuaternion(this.q);
      return { i, x: this.v.x, y: this.v.y, z: this.v.z };
    }).sort((a, b) => a.z - b.z);

    for (const o of order) {
      const line = this.lines[o.i];
      const tip = this.tips[o.i];
      // Away from the viewer: thinner and faded.
      const away = o.z < -0.15;
      this.attr(line, 'x2', (C + o.x * LEN).toFixed(1));
      this.attr(line, 'y2', (C - o.y * LEN).toFixed(1));
      this.attr(line, 'opacity', away ? '0.4' : '1');
      this.attr(tip, 'x', (C + o.x * (LEN + 4.5)).toFixed(1));
      this.attr(tip, 'y', (C - o.y * (LEN + 4.5) + 2.2).toFixed(1));
      this.attr(tip, 'opacity', away ? '0.35' : '0.9');
    }
    // Re-append in depth order so near axes draw over far ones -- only when
    // the order has actually changed.
    const key = order.map((o) => o.i).join('');
    if (key !== this.lastOrder) {
      this.lastOrder = key;
      for (const o of order) this.svg.insertBefore(this.lines[o.i], this.tips[0]);
    }
  }

  private attr(el: Element, name: string, value: string): void {
    let w = this.written.get(el);
    if (!w) this.written.set(el, (w = {}));
    if (w[name] === value) return;
    w[name] = value;
    el.setAttribute(name, value);
  }
}
