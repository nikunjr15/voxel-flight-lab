import { Box3, Group, Vector3 } from 'three';
import { buildClient } from '../../engine/build/client';
import { VoxelModel } from '../../engine/voxel/VoxelModel';
import { AIRCRAFT } from '../../aircraft';
import { TARGET_PLANFORM_VOXELS } from '../../engine/build/assemble';
import type { AircraftConfig } from '../../aircraft/types';

interface Placed {
  config: AircraftConfig;
  /** World width this jet owns in the row; the caption is sized to match. */
  slot: number;
  model: VoxelModel;
  at: Vector3;
  voxels: number;
  buildMs: number;
}

/** Roughly what a jet costs at TARGET_PLANFORM_VOXELS, measured across the roster. */
/**
 * Ceiling for the larger jet in a compare pair. The mobile cap of about 9k is
 * the binding one: mobile builds at density 0.65, and surface count scales
 * with density squared, so 9k on mobile is about 21k on desktop -- under the
 * 25k desktop ceiling, and therefore the number that actually applies.
 */
const COMPARE_MAX_VOXELS = 21000;

/** Minimum world width a gallery slot occupies, so captions never collide. */
const MIN_SLOT = 9.5;

/** Named batches, so a review can pull up exactly the set under discussion. */
export const GALLERY_SETS: Record<string, string[]> = {
  // Era 1 and 2, with a fourth-generation reference for scale.
  '2b': ['me-262', 'f-86', 'mig-15', 'mig-21', 'f-104', 'mirage-3', 'f-16'],
  era1: ['me-262', 'f-86', 'mig-15'],
  era2: ['mig-21', 'f-104', 'mirage-3', 'gnat'],
  '2c': ['f-4', 'mig-23', 'f-15', 'su-27', 'mig-29', 'mirage-2000', 'f-16'],
  era3: ['f-4', 'mig-23'],
  era4: ['f-15', 'f-16', 'su-27', 'mig-29', 'mirage-2000'],
  '2d': ['rafale', 'gripen', 'typhoon', 'su-30mki', 'tejas'],
  'compare-canards': ['rafale', 'typhoon', 'gripen'],
  su30: ['su-27', 'su-30mki'],
  '2e': ['f-22', 'f-35', 'su-57', 'j-20', 'amca', 'gcap', 'ngad', 'vajra'],
  era5: ['f-22', 'f-35', 'su-57', 'j-20'],
  era6: ['amca', 'gcap', 'ngad', 'vajra'],
  // Acceptance test for chapter 6: the stealth pair must read as faceted and
  // planar beside the rounded fourth-generation pair.
  'compare-stealth': ['f-15', 'f-22', 'su-27', 'su-57'],
  all: AIRCRAFT.map((a) => a.id),
};

/**
 * Lays a batch out side by side at true relative scale. The models are already
 * built in metres, so spacing by span is all it takes for the sizes to be
 * directly comparable -- which is the entire point of the view.
 */
export class Gallery {
  readonly group = new Group();
  readonly placed: Placed[] = [];
  /** Shared world block size in metres; 0 when each jet uses its own grid. */
  voxelSize = 0;
  /** Set when a compare pair had to be coarsened after measuring. */
  rebuilt: { from: number; voxelSize: number } | null = null;
  private readonly labelLayer: HTMLElement;

  constructor(parent: HTMLElement) {
    this.group.name = 'gallery';
    this.labelLayer = document.createElement('div');
    this.labelLayer.className = 'rig-labels rig-labels--gallery';
    parent.appendChild(this.labelLayer);
  }

  /**
   * One block size for the whole row. Derived from the largest airframe in the
   * set under the normal planform rule, so nothing in the row ends up finer
   * than that aircraft would have been on its own -- and no jet gets quantised
   * to a different grid, which is what made relative scale read wrong.
   */
  static sharedVoxelSize(configs: AircraftConfig[], from: 'largest' | 'smallest' = 'largest'): number {
    const planforms = configs.map((c) =>
      Math.sqrt(c.geometry.fuselage.length * c.geometry.bbox.span),
    );
    // An era row takes its block size from the largest airframe, so nothing in
    // it is finer than that jet would have been alone and the row stays cheap.
    if (from === 'largest') return Math.max(...planforms) / TARGET_PLANFORM_VOXELS;

    // A compare pair sizes to the smaller jet, because sizing to the larger
    // leaves something like the Gnat as unreadable mush beside it. If that
    // turns out to overrun the budget, `load` measures the built result and
    // rebuilds once at a coarser block -- no estimate to keep tuned.
    return Math.min(...planforms) / TARGET_PLANFORM_VOXELS;
  }

  /**
   * `reverse` lays the row out right to left in world space. A plan view
   * looking down with the nose up necessarily mirrors the X axis, so this is
   * what keeps the row reading left to right on screen in both views.
   */
  async load(
    ids: string[],
    density = 1,
    shared = true,
    reverse = false,
    sizeFrom: 'largest' | 'smallest' = 'largest',
    perRow = Infinity,
  ): Promise<void> {
    const found = ids
      .map((id) => AIRCRAFT.find((a) => a.id === id))
      .filter((a): a is AircraftConfig => Boolean(a));
    // Rows read chronologically, which is the whole point of an era row.
    // Chronological, with anything that has not flown at the end of the row.
    const year = (c: AircraftConfig): number => c.spec.firstFlight ?? Infinity;
    const ordered = [...found].sort((a, b) => year(a) - year(b));
    const configs = reverse ? ordered.reverse() : ordered;

    let voxelSize = shared ? Gallery.sharedVoxelSize(configs, sizeFrom) : undefined;

    // A compare pair sizes to the smaller jet, which can push the larger one
    // past budget. Rather than predict that, build once, measure, and if the
    // worst case overruns by more than a tenth, coarsen by the measured ratio
    // and rebuild. Surface count scales with the square of resolution, so one
    // correction lands it.
    if (voxelSize !== undefined && sizeFrom === 'smallest') {
      // Count falls faster than the inverse square of block size, because
      // thin features drop out entirely, so one correction lands under the
      // cap rather than on it. A second pass recovers the resolution that
      // overshoot gave away.
      for (let pass = 0; pass < 2; pass++) {
        const probe = await Promise.all(
          configs.map((c) => buildClient.build(c, { density, voxelSize })),
        );
        const worst = Math.max(...probe.map((p) => p.total));
        if (pass === 0) this.rebuilt = null;
        if (worst > COMPARE_MAX_VOXELS * 1.1) {
          voxelSize *= Math.sqrt(worst / COMPARE_MAX_VOXELS);
          this.rebuilt = { from: worst, voxelSize };
          continue;
        }
        // Under budget with room to spare: step back toward the cap once.
        if (pass === 1 && worst < COMPARE_MAX_VOXELS * 0.8) {
          voxelSize *= Math.sqrt(worst / COMPARE_MAX_VOXELS) ** 0.5;
          this.rebuilt = { from: worst, voxelSize };
        }
        break;
      }
    }
    this.voxelSize = voxelSize ?? 0;

    // A single row of eight is so wide that an oblique view has to pull back
    // until each jet is a few pixels. Wrapping keeps them legible.
    const rows = Math.max(1, Math.ceil(configs.length / Math.min(perRow, configs.length)));
    const rowDepth = 26;
    let cursor = 0;
    let rowIndex = 0;
    let inRow = 0;
    let widest = 0;

    for (const config of configs) {
      const data = await buildClient.build(config, { density, voxelSize });
      const model = new VoxelModel(config.id, data);
      const centre = model.center;
      model.group.position.set(-centre.x, -centre.y, -centre.z);

      const size = model.size;
      const holder = new Group();
      holder.add(model.group);

      if (inRow >= perRow) {
        widest = Math.max(widest, cursor);
        cursor = 0;
        inRow = 0;
        rowIndex++;
      }
      // Each jet gets at least MIN_SLOT of width whatever its span, because
      // the caption underneath is a fixed size and two narrow jets side by
      // side would otherwise have their captions run together.
      const halfSlot = Math.max(size.x / 2 + 2.4, MIN_SLOT / 2);
      cursor += inRow === 0 ? 0 : halfSlot;
      holder.position.set(cursor, 0, -rowIndex * rowDepth);
      cursor += halfSlot;
      inRow++;

      this.group.add(holder);
      this.placed.push({
        config,
        slot: halfSlot * 2,
        model,
        at: holder.position.clone(),
        voxels: data.total,
        buildMs: data.buildMs,
      });
      this.addLabel(config, size);
    }

    // Centre each row on the widest one, then centre the whole block on its
    // own bounds. Deriving the offset from the bounds rather than from the
    // running cursor keeps world coordinates honest, which matters because
    // the review camera aims at points in that space.
    widest = Math.max(widest, cursor);
    for (let i = 0; i < this.placed.length; i++) {
      const p = this.placed[i];
      const rowOf = Math.round(-p.at.z / rowDepth);
      const rowWidth = this.placed
        .filter((q) => Math.round(-q.at.z / rowDepth) === rowOf)
        .reduce((max, q) => Math.max(max, q.at.x + q.model.size.x / 2), 0);
      const shift = (widest - rowWidth) / 2;
      p.at.x += shift;
      const holder = this.group.children[i] as Group | undefined;
      if (holder) holder.position.x += shift;
    }

    this.group.position.set(0, 0, 0);
    const box = new Box3().setFromObject(this.group);
    const mid = box.getCenter(new Vector3());
    this.group.position.set(-mid.x, 0, -mid.z);
    void rows;
  }

  /** Two fixed spec lines, so no caption wraps differently from its neighbour. */
  private addLabel(config: AircraftConfig, size: Vector3): void {
    const { spec } = config;
    const el = document.createElement('div');
    el.className = 'rig-label';
    // A concept is labelled as one everywhere it appears. Nothing in the
    // roster should be mistakable for an aircraft that has actually flown.
    const concept = spec.status === 'concept' ? '<i>concept</i>' : '';
    el.innerHTML =
      `<b>${config.exhibitNo} — <u>${config.designation}</u>${concept}</b>` +
      `<span>${
        spec.lengthM !== undefined && spec.spanM !== undefined
          ? `${spec.lengthM} m · ${spec.spanM} m span`
          : 'dimensions not published'
      }</span>` +
      `<span>gen ${spec.generation} · ${spec.firstFlight ?? 'not flown'}</span>`;
    el.dataset.span = size.x.toFixed(1);
    this.labelLayer.appendChild(el);
  }

  /**
   * `offset` is in world space because what counts as "below the model"
   * depends on the view: -Y under a three-quarter shot, +Z under a plan view
   * where -Y points straight at the camera and would move nothing.
   */
  updateLabels(
    project: (p: Vector3) => { x: number; y: number; visible: boolean },
    offset: Vector3 = new Vector3(0, -3.2, 0),
  ): void {
    const children = this.labelLayer.children;
    for (let i = 0; i < this.placed.length; i++) {
      const el = children[i] as HTMLElement | undefined;
      if (!el) continue;
      const p = this.placed[i].at.clone().add(this.group.position).add(offset);
      const s = project(p);
      // The row is fitted to the frame, so how many pixels a metre is worth
      // is only known now. Size each caption to its own slot rather than to a
      // fixed pixel width, or neighbours overlap as soon as the row is long.
      const edge = project(p.clone().setX(p.x + this.placed[i].slot / 2));
      // 0.84 of the slot, not all of it: sized to the full slot, adjacent
      // captions meet edge to edge and read as one line of text.
      const width = Math.max(70, Math.abs(edge.x - s.x) * 2 * 0.84);
      el.style.width = `${width}px`;
      el.style.fontSize = width < 104 ? '0.9em' : '';
      el.style.transform = `translate(-50%, 0) translate(${s.x}px, ${s.y}px)`;
      el.style.opacity = s.visible ? '1' : '0';
    }
  }

  /** Per-jet voxel table, printed to the console for the review notes. */
  table(): string {
    const head = this.voxelSize
      ? `shared block size ${(this.voxelSize * 100).toFixed(1)} cm` +
        (this.rebuilt ? ` (coarsened from a ${this.rebuilt.from} voxel build)` : '')
      : 'per-jet block size';
    const rows = this.placed.map(
      (p) =>
        `${p.config.exhibitNo} ${p.config.designation.padEnd(16)} ${String(p.voxels).padStart(6)} voxels  ${p.model.info.drawCalls} draws  ${p.buildMs.toFixed(0)} ms`,
    );
    return [head, ...rows].join('\n');
  }

  bounds(): Box3 {
    return new Box3().setFromObject(this.group);
  }

  dispose(): void {
    for (const p of this.placed) p.model.dispose();
    this.placed.length = 0;
    this.group.clear();
    this.labelLayer.remove();
  }
}
