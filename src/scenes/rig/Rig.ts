import { Box3, Group, Vector3 } from 'three';
import { buildClient } from '../../engine/build/client';
import { VoxelModel } from '../../engine/voxel/VoxelModel';
import { SKIN_PARTS } from '../../engine/voxel/parts';
import { SPECIMENS, type RigSpecimen } from './specimens';

interface Placed {
  specimen: RigSpecimen;
  model: VoxelModel;
  centre: Vector3;
}

/**
 * Dev-only bench. Lays every new primitive out on its own plinth so a defect
 * shows up before it is baked into a dozen aircraft configs.
 */
export class Rig {
  readonly group = new Group();
  readonly placed: Placed[] = [];
  private readonly labelLayer: HTMLElement;

  constructor(parent: HTMLElement) {
    this.group.name = 'test-rig';
    this.labelLayer = document.createElement('div');
    this.labelLayer.className = 'rig-labels';
    parent.appendChild(this.labelLayer);
  }

  /** Builds one specimen, centred at the origin, for close inspection. */
  async loadOne(index: number, density = 1): Promise<void> {
    const s = SPECIMENS[index];
    if (!s) throw new Error(`no specimen ${index}`);
    const data = await buildClient.build(s.config, { density, ...s.opts });
    const model = new VoxelModel(s.config.id, data);
    const centre = model.center;
    model.group.position.set(-centre.x, -centre.y, -centre.z);
    const holder = new Group();
    holder.add(model.group);
    this.group.add(holder);
    if (s.reveal) {
      for (const part of SKIN_PARTS) {
        if (s.reveal.includes(part)) model.setOpacity(part, 0.22);
      }
    }
    this.placed.push({ specimen: s, model, centre: holder.position.clone() });
    this.addLabel(s, index);
  }

  async load(columns = 5, density = 0.85): Promise<void> {
    // Each specimen carries its own options (sweep angle, door position), so
    // they are built one at a time rather than through a shared batch.
    const results = [];
    for (const s of SPECIMENS) {
      results.push(await buildClient.build(s.config, { density, ...s.opts }));
    }

    const cell = 16;
    const rowGap = 13;
    for (let i = 0; i < SPECIMENS.length; i++) {
      const s = SPECIMENS[i];
      const model = new VoxelModel(s.config.id, results[i]);
      const centre = model.center;
      model.group.position.set(-centre.x, -centre.y, -centre.z);

      const holder = new Group();
      holder.add(model.group);
      const col = i % columns;
      const row = Math.floor(i / columns);
      holder.position.set((col - (columns - 1) / 2) * cell, 0, row * rowGap);
      // Three-quarter presentation angle, same for every plinth.
      holder.rotation.y = -0.6;
      this.group.add(holder);

      if (s.reveal) {
        for (const part of SKIN_PARTS) {
          if (s.reveal.includes(part)) model.setOpacity(part, 0.22);
        }
      }

      this.placed.push({ specimen: s, model, centre: holder.position.clone() });
      this.addLabel(s, i);
    }
  }

  private addLabel(s: RigSpecimen, index: number): void {
    const el = document.createElement('div');
    el.className = 'rig-label';
    el.dataset.index = String(index);
    el.innerHTML = `<b>${String(index + 1).padStart(2, '0')} — ${s.label}</b><span>${s.note}</span>`;
    this.labelLayer.appendChild(el);
  }

  /** Projects each plinth to screen space so the caption tracks the model. */
  updateLabels(project: (p: Vector3) => { x: number; y: number; visible: boolean }): void {
    const children = this.labelLayer.children;
    for (let i = 0; i < this.placed.length; i++) {
      const el = children[i] as HTMLElement | undefined;
      if (!el) continue;
      const p = this.placed[i].centre.clone();
      p.y -= 3.4;
      const s = project(p);
      el.style.transform = `translate(-50%, 0) translate(${s.x}px, ${s.y}px)`;
      el.style.opacity = s.visible ? '1' : '0';
    }
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
