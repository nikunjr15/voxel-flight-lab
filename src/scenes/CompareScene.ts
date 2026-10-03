import { Group, Mesh, MeshBasicMaterial, RingGeometry, Vector3 } from 'three';
import gsap from 'gsap';
import type { AircraftConfig } from '../aircraft/types';
import { VoxelModel } from '../engine/voxel/VoxelModel';
import { createContactShadow } from '../engine/renderer/ContactShadow';
import { Gallery } from './rig/Gallery';
import type { BuildCache } from '../app/BuildCache';

/** Per-jet surface cap for a pair; the same figure the review gallery uses. */
const COMPARE_MAX_VOXELS = 21000;
/** Clear air between the two airframes, metres. */
const GAP = 2.4;

export type CompareLayout = 'side' | 'stack';

interface Slot {
  config: AircraftConfig;
  voxelSize: number;
  density: number;
  holder: Group;
  model: VoxelModel;
  shadow: Mesh;
}

export interface CompareHost {
  reduced(): boolean;
  density(): number;
  /** A slot's airframe started to scatter or crossfade out. */
  onLeave(): void;
}

/**
 * The hangar: two aircraft on one turntable at true relative scale. Both are
 * built at one shared block size -- the compare rule from the review gallery,
 * sized to the smaller jet and coarsened once if the larger one overruns the
 * budget -- so the difference in size on screen is the real one.
 *
 * Changing a slot morphs that aircraft out and the new one in, and slides
 * the other across to its new place. If the shared block size changes, both
 * are rebuilt, so the two never stand at different resolutions.
 */
export class CompareScene {
  readonly group = new Group();
  private slots: (Slot | null)[] = [null, null];
  private readonly ring: Mesh;
  private token = 0;
  layout: CompareLayout = 'side';
  /** Combined extent of the pair as laid out: x across, z deep, y up. */
  readonly size = new Vector3(1, 1, 1);

  constructor(
    private readonly cache: BuildCache,
    private readonly host: CompareHost,
  ) {
    this.group.name = 'compare';
    // The turntable: a hairline ring on the floor round both aircraft.
    this.ring = new Mesh(
      new RingGeometry(0.985, 1, 128),
      new MeshBasicMaterial({ color: 0x16191c, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.renderOrder = -1;
    this.group.add(this.ring);
  }

  get pair(): [AircraftConfig, AircraftConfig] | null {
    const [a, b] = this.slots;
    return a && b ? [a.config, b.config] : null;
  }

  /** Blocks on the turntable, both aircraft together. */
  get blocks(): number {
    return this.slots.reduce((n, s) => n + (s ? s.model.info.surfaceVoxels : 0), 0);
  }

  /**
   * Where each aircraft's tag goes, in the group: under it when the pair
   * stands side by side, beside it when stacked, where under the first would
   * be on top of the second.
   */
  anchors(): Vector3[] {
    return this.slots.map((s) => {
      if (!s) return new Vector3();
      const size = s.model.size;
      const p = s.holder.position;
      return this.layout === 'stack'
        ? new Vector3(p.x + size.x * 0.5 + 0.8, p.y - size.y * 0.5, p.z)
        : new Vector3(p.x, p.y - size.y * 0.5 - 0.6, p.z);
    });
  }

  /** The shared block size for a pair, under the per-jet budget. */
  private async sizeFor(a: AircraftConfig, b: AircraftConfig): Promise<number> {
    let vs = Gallery.sharedVoxelSize([a, b], 'smallest');
    const density = this.host.density();
    const probe = await Promise.all([a, b].map((c) => this.cache.get(c, { voxelSize: vs, density })));
    const worst = Math.max(...probe.map((p) => p.total));
    // Surface count goes with the square of resolution; one step lands it.
    if (worst > COMPARE_MAX_VOXELS * 1.1) vs *= Math.sqrt(worst / COMPARE_MAX_VOXELS);
    return vs;
  }

  /** Builds the pair's airframes ahead of time; resolves when both are cached. */
  async prefetch(a: AircraftConfig, b: AircraftConfig): Promise<void> {
    const vs = await this.sizeFor(a, b);
    const density = this.host.density();
    await Promise.all([a, b].map((c) => this.cache.get(c, { voxelSize: vs, density })));
  }

  async show(a: AircraftConfig, b: AircraftConfig): Promise<void> {
    const token = ++this.token;
    const vs = await this.sizeFor(a, b);
    const density = this.host.density();
    const data = await Promise.all([a, b].map((c) => this.cache.get(c, { voxelSize: vs, density })));
    if (token !== this.token) return;

    const next: Slot[] = [a, b].map((config, i) => {
      const cur = this.slots[i];
      // Same aircraft at the same block size and density stays exactly where it is.
      if (cur && cur.config === config && cur.voxelSize === vs && cur.density === density) return cur;
      if (cur) this.leave(cur);
      return this.enter(config, data[i], vs, density);
    });
    this.slots = next;
    this.place(true);
  }

  /** Scatters both away; the scene is empty once they have gone. */
  hide(): void {
    this.token++;
    for (const s of this.slots) if (s) this.leave(s);
    this.slots = [null, null];
    gsap.to(this.ring.material, { opacity: 0, duration: 0.5 });
  }

  setLayout(layout: CompareLayout): void {
    if (layout === this.layout) return;
    this.layout = layout;
    this.place(false);
  }

  private enter(config: AircraftConfig, data: Awaited<ReturnType<BuildCache['get']>>, voxelSize: number, density: number): Slot {
    const model = new VoxelModel(`${config.id}:compare`, data);
    model.setAccent(config.palette.accent ?? '#ff6a2b');
    const centre = model.center;
    model.group.position.set(-centre.x, -centre.y, -centre.z);
    const size = model.size;
    const shadow = createContactShadow(Math.max(size.x, size.z) * 0.62, 0.3);
    shadow.position.y = -size.y * 0.5 - 0.35;
    const holder = new Group();
    holder.add(model.group, shadow);
    this.group.add(holder);

    const shade = shadow.material as MeshBasicMaterial;
    shade.opacity = 0;
    if (this.host.reduced()) {
      const f = { v: 0 };
      model.setFade(0);
      gsap.to(f, { v: 1, duration: 0.5, delay: 0.15, onUpdate: () => model.setFade(f.v) });
    } else {
      model.setMorph(1.3);
      gsap.to(model.uniforms.uMorph, { value: 0, duration: 1.15, delay: 0.28, ease: 'power3.out' });
    }
    gsap.to(shade, { opacity: 1, duration: 0.8, delay: 0.45 });
    return { config, voxelSize, density, holder, model, shadow };
  }

  private leave(s: Slot): void {
    this.host.onLeave();
    gsap.killTweensOf(s.model.uniforms.uMorph);
    gsap.to(s.shadow.material as MeshBasicMaterial, { opacity: 0, duration: 0.45 });
    const done = () => {
      gsap.killTweensOf(s.holder.position);
      s.holder.removeFromParent();
      s.model.dispose();
      (s.shadow.material as MeshBasicMaterial).dispose();
      s.shadow.geometry.dispose();
    };
    if (this.host.reduced()) {
      const f = { v: s.model.uniforms.uFade.value };
      gsap.to(f, { v: 0, duration: 0.4, onUpdate: () => s.model.setFade(f.v), onComplete: done });
    } else {
      const from = Math.min(1.3, s.model.morph);
      gsap.to(s.model.uniforms.uMorph, { value: 1.3, duration: 0.25 + 0.6 * (1 - from / 1.3), ease: 'power2.in', onComplete: done });
    }
  }

  /**
   * Lays the pair out on the floor: side by side across X, or one behind the
   * other along Z, which a camera from above turns into a stack on a tall
   * screen. Both stand on the same floor, and the pair is centred on the
   * turntable.
   */
  private place(animate: boolean): void {
    const [a, b] = this.slots;
    if (!a || !b) return;
    const sa = a.model.size;
    const sb = b.model.size;
    const floor = -Math.max(sa.y, sb.y) * 0.5;
    const side = this.layout === 'side';
    // A on the left (or at the top of a stack), B on the right (or below).
    const ea = side ? sa.x : sa.z;
    const eb = side ? sb.x : sb.z;
    const pa = -(GAP + eb) * 0.5;
    const pb = (GAP + ea) * 0.5;
    const shift = (pa - ea * 0.5 + (pb + eb * 0.5)) * 0.5;
    const at = (s: Slot, p: number, h: number) => {
      const v = side ? { x: p - shift, y: floor + h * 0.5, z: 0 } : { x: 0, y: floor + h * 0.5, z: p - shift };
      if (animate) gsap.to(s.holder.position, { ...v, duration: this.host.reduced() ? 0 : 0.9, ease: 'expo.out' });
      else s.holder.position.set(v.x, v.y, v.z);
    };
    at(a, pa, sa.y);
    at(b, pb, sb.y);

    const across = ea + GAP + eb;
    const other = Math.max(side ? sa.z : sa.x, side ? sb.z : sb.x);
    this.size.set(side ? across : other, Math.max(sa.y, sb.y), side ? other : across);
    const r = Math.hypot(this.size.x, this.size.z) * 0.5 * 1.02;
    this.ring.scale.set(r, r, 1);
    this.ring.position.y = floor - 0.34;
    gsap.to(this.ring.material, { opacity: 0.16, duration: 0.8, delay: 0.3 });
  }

  dispose(): void {
    this.token++;
    for (const s of this.slots) {
      if (!s) continue;
      s.model.dispose();
      (s.shadow.material as MeshBasicMaterial).dispose();
      s.shadow.geometry.dispose();
    }
    this.slots = [null, null];
    this.ring.geometry.dispose();
    (this.ring.material as MeshBasicMaterial).dispose();
    this.group.clear();
  }
}
