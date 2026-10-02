import { Box3, Group, Vector3 } from 'three';
import { buildClient } from '../../engine/build/client';
import { VoxelModel } from '../../engine/voxel/VoxelModel';
import { AIRCRAFT } from '../../aircraft';
import { TARGET_PLANFORM_VOXELS } from '../../engine/build/assemble';
import type { AircraftConfig } from '../../aircraft/types';

interface Placed {
  config: AircraftConfig;
  model: VoxelModel;
  at: Vector3;
  voxels: number;
  buildMs: number;
}

/** Named batches, so a review can pull up exactly the set under discussion. */
export const GALLERY_SETS: Record<string, string[]> = {
  // Era 1 and 2, with a fourth-generation reference for scale.
  '2b': ['me-262', 'f-86', 'mig-15', 'mig-21', 'f-104', 'mirage-3', 'f-16'],
  era1: ['me-262', 'f-86', 'mig-15'],
  era2: ['mig-21', 'f-104', 'mirage-3', 'gnat'],
  '2c': ['f-4', 'mig-23', 'f-15', 'su-27', 'mig-29', 'mirage-2000', 'f-16'],
  era3: ['f-4', 'mig-23'],
  era4: ['f-15', 'f-16', 'su-27', 'mig-29', 'mirage-2000'],
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
    // A compare pair takes it from the smaller one instead: with only two
    // models on screen the budget is there, and sizing to the larger leaves a
    // small jet like the Gnat as unreadable mush beside it.
    return (from === 'largest' ? Math.max(...planforms) : Math.min(...planforms)) /
      TARGET_PLANFORM_VOXELS;
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
    const configs = reverse ? [...found].reverse() : found;

    const voxelSize = shared ? Gallery.sharedVoxelSize(configs, sizeFrom) : undefined;
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
      // Half this model's span, plus a constant gutter, from the last one.
      const step = size.x / 2 + 2.9;
      cursor += inRow === 0 ? 0 : step;
      holder.position.set(cursor, 0, -rowIndex * rowDepth);
      cursor += size.x / 2 + 2.9;
      inRow++;

      this.group.add(holder);
      this.placed.push({
        config,
        model,
        at: holder.position.clone(),
        voxels: data.total,
        buildMs: data.buildMs,
      });
      this.addLabel(config, size);
    }

    // Re-centre so the camera can simply look at the origin. Each row is
    // centred on the widest one, and the block as a whole on its depth.
    widest = Math.max(widest, cursor);
    this.group.position.x = -widest / 2;
    this.group.position.z = ((rows - 1) * rowDepth) / 2;
    for (const p of this.placed) {
      // Rows shorter than the widest get nudged back to centre.
      const rowOf = Math.round(-p.at.z / rowDepth);
      const rowWidth = this.placed
        .filter((q) => Math.round(-q.at.z / rowDepth) === rowOf)
        .reduce((max, q) => Math.max(max, q.at.x + q.model.size.x / 2), 0);
      const shift = (widest - rowWidth) / 2;
      p.at.x += shift;
      const holder = this.group.children[this.placed.indexOf(p)] as Group | undefined;
      if (holder) holder.position.x += shift;
    }
  }

  /** Two fixed spec lines, so no caption wraps differently from its neighbour. */
  private addLabel(config: AircraftConfig, size: Vector3): void {
    const { spec } = config;
    const el = document.createElement('div');
    el.className = 'rig-label';
    el.innerHTML =
      `<b>${config.exhibitNo} — ${config.designation}</b>` +
      `<span>${spec.lengthM} m · ${spec.spanM} m span</span>` +
      `<span>gen ${spec.generation} · ${spec.firstFlight}</span>`;
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
      el.style.transform = `translate(-50%, 0) translate(${s.x}px, ${s.y}px)`;
      el.style.opacity = s.visible ? '1' : '0';
    }
  }

  /** Per-jet voxel table, printed to the console for the review notes. */
  table(): string {
    const head = this.voxelSize
      ? `shared block size ${(this.voxelSize * 100).toFixed(1)} cm`
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
