import { Camera, Object3D, Vector3 } from 'three';

export interface LabelTarget {
  /** Model-space point the line points at. */
  point: Vector3;
  text: string;
}

const NS = 'http://www.w3.org/2000/svg';
/** Minimum vertical gap between labels on the same side, in pixels. */
const ROW = 20;
/** How far a label sits out from its point, in pixels. */
const REACH = 64;

/**
 * Leader lines for the exploded view: a mono label per part, tied to the
 * part's exploded centroid with a thin line. Labels go out to the left or the
 * right of the model, whichever side their part is on, and are spaced so no
 * two overlap -- the line bends to reach them rather than the text stacking.
 */
export class XrayLabels {
  readonly el: HTMLElement;
  private readonly svg: SVGSVGElement;
  private readonly lines: SVGPolylineElement[] = [];
  private readonly dots: SVGCircleElement[] = [];
  private readonly labels: HTMLElement[] = [];
  private targets: LabelTarget[] = [];
  /** Label widths, measured once per text: reading them every frame forces a layout. */
  private widths: number[] = [];
  private readonly v = new Vector3();
  private shown = false;

  constructor(parent: HTMLElement = document.body) {
    this.el = document.createElement('div');
    this.el.className = 'xray';
    this.el.setAttribute('aria-hidden', 'true');
    this.svg = document.createElementNS(NS, 'svg');
    this.svg.setAttribute('class', 'xray__lines');
    this.el.appendChild(this.svg);
    parent.appendChild(this.el);
    this.setVisible(false);
  }

  setTargets(targets: LabelTarget[]): void {
    this.targets = targets;
    this.widths = [];
    while (this.labels.length < targets.length) {
      const line = document.createElementNS(NS, 'polyline');
      const dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('r', '2.2');
      const label = document.createElement('span');
      label.className = 'xray__label';
      this.svg.append(line, dot);
      this.el.appendChild(label);
      this.lines.push(line);
      this.dots.push(dot);
      this.labels.push(label);
    }
    this.labels.forEach((l, i) => {
      const on = i < targets.length;
      l.hidden = !on;
      this.lines[i].style.display = on ? '' : 'none';
      this.dots[i].style.display = on ? '' : 'none';
      if (on) l.textContent = targets[i].text;
    });
  }

  setVisible(on: boolean): void {
    this.shown = on;
    this.el.classList.toggle('is-on', on);
  }

  /**
   * Projects every target, displaced by its explode offset, through `frame`
   * (the model's group, so the points follow its transform) and lays the
   * labels out either side of the parts' mean screen position.
   */
  update(camera: Camera, frame: Object3D, width: number, height: number, offsets: Vector3[]): void {
    if (!this.shown || this.targets.length === 0) return;
    const pts = this.targets.map((t, i) => {
      this.v.copy(t.point);
      const off = offsets[i];
      if (off) this.v.add(off);
      frame.localToWorld(this.v);
      this.v.project(camera);
      return { i, x: (this.v.x * 0.5 + 0.5) * width, y: (-this.v.y * 0.5 + 0.5) * height, z: this.v.z };
    });
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    // Columns stand clear of the parts. The points are part centres, and the
    // silhouette runs well past them -- a wing's centre is half a semi-span
    // in from its tip -- so the margin grows with the spread.
    const xs = pts.map((p) => p.x);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const margin = (maxX - minX) * 0.22 + 16;

    for (const side of [-1, 1]) {
      const group = pts.filter((p) => (side < 0 ? p.x < cx : p.x >= cx)).sort((a, b) => a.y - b.y);
      let lastY = -Infinity;
      for (const p of group) {
        const ly = Math.max(p.y, lastY + ROW);
        lastY = ly;
        const label = this.labels[p.i];
        // Keep the whole label on screen: pull the elbow in rather than let
        // the text run off the edge.
        const w = (this.widths[p.i] ||= label.offsetWidth) + 6;
        const lx =
          side < 0
            ? Math.max(8 + w, Math.min(p.x - REACH, minX - margin))
            : Math.min(width - 8 - w, Math.max(p.x + REACH, maxX + margin));
        const elbow = p.x + (lx - p.x) * 0.45;
        this.lines[p.i].setAttribute('points', `${p.x},${p.y} ${elbow},${ly} ${lx},${ly}`);
        this.dots[p.i].setAttribute('cx', p.x.toFixed(1));
        this.dots[p.i].setAttribute('cy', p.y.toFixed(1));
        label.style.transform = `translate(${(side < 0 ? lx - 6 : lx + 6).toFixed(1)}px, ${(ly - 7).toFixed(1)}px) translateX(${side < 0 ? '-100%' : '0'})`;
        const behind = p.z > 1;
        label.style.opacity = behind ? '0' : '';
      }
    }
  }

  dispose(): void {
    this.el.remove();
  }
}
