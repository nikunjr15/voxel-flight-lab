import { Group, PerspectiveCamera, Vector3 } from 'three';
import type { AircraftConfig, Annotation } from '../aircraft/types';
import type { AssembleResult } from '../engine/build/assemble';
import { AirflowEffect, PlumeEffect, SpeedLines, type Exit, type Vec3 } from '../engine/particles/Particles';
import { VoxelModel } from '../engine/voxel/VoxelModel';
import { buildClient } from '../engine/build/client';
import {
  DEFAULT_HIDDEN,
  PART_EXPLODE_DIR,
  PART_LABEL,
  PARTS,
  PROPULSION_PARTS,
  type PartId,
} from '../engine/voxel/parts';
import type { ModeId, Store, ViewerState } from '../app/store';
import { modeCards } from '../ui/modeCopy';
import { XrayLabels } from '../ui/XrayLabels';
import type { CameraPreset, CameraRig } from './CameraRig';

const DEG = Math.PI / 180;
/** Every glide between modes. Expo ease, set in the rig. */
const GLIDE = 1.2;
/** Bay doors swing this far, measured from shut. */
const DOOR_OPEN = 95 * DEG;

type Channel = 'opacity' | 'highlight' | 'explode' | 'emissive' | 'heat' | 'hinge';

interface Anim {
  part: PartId;
  ch: Channel;
  from: number;
  to: number;
  start: number;
  dur: number;
}

/** What the mode manager needs from the app, and nothing more. */
export interface ModeHost {
  rig: CameraRig;
  camera: PerspectiveCamera;
  store: Store<ViewerState>;
  reduced(): boolean;
  heroPreset(): CameraPreset;
  planPreset(): CameraPreset;
  setIdle(v: boolean): void;
  showCards(cards: Annotation[]): void;
  viewport(): { width: number; height: number };
}

const HIDDEN = new Set<PartId>(DEFAULT_HIDDEN);
const PROPULSION = new Set<PartId>(PROPULSION_PARTS);
/** Channels the thrust toggle owns; modes leave them alone. */
const THRUST_OWNED = new Set(['nozzle:emissive', 'nozzle:heat', 'engine:heat']);
/** Parts labelled in the exploded view, most important first. */
const LABEL_ORDER: PartId[] = [
  'radome',
  'canopy-glass',
  'cockpit',
  'wing-r',
  'canard-r',
  'levcon-r',
  'tail-v',
  'tail-v-r',
  'tail-h-r',
  'engine',
  'nozzle',
  'intake-r',
  'intake-c',
  'spine',
  'seat',
];
const MAX_LABELS = 9;
/** Cockpit section resolution, relative to the airframe it sits in. */
const SECTION_SCALE = 3.2;

/** Cockpit-mode state for the section: glazing nearly gone, seats ghosted, displays and sight lit. */
const SECTION_STATE: Partial<Record<PartId, { opacity?: number; emissive?: number }>> = {
  'canopy-glass': { opacity: 0.08 },
  'canopy-frame': { opacity: 0.5 },
  seat: { opacity: 0.3 },
  // Lit, but not so hot that tone mapping bleaches the sight's colour out.
  'hud-symbology': { opacity: 1, emissive: 1.2 },
  display: { emissive: 1.3 },
  hud: { emissive: 0.25 },
};

const expoOut = (t: number): number => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * The toolbar modes. Each is a camera preset plus a target state for every
 * part on the existing part-state texture -- opacity, highlight, explode
 * offset, emissive, heat and hinge angle -- reached by easing from wherever
 * the part is now. Nothing is rebuilt and nothing snaps.
 */
export class ModeManager {
  readonly fx = new Group();
  private model: VoxelModel | null = null;
  private config: AircraftConfig | null = null;
  private readonly airflow: AirflowEffect;
  private readonly plume: PlumeEffect;
  private readonly speed: SpeedLines;
  private readonly labels = new XrayLabels();
  private anims = new Map<string, Anim>();
  private readonly values = new Map<string, number>();
  private readonly hinges = new Map<PartId, { pivot: Vec3; open: number }>();
  private labelParts: PartId[] = [];
  private readonly labelPoints: Vector3[] = [];
  private readonly labelOffsets: Vector3[] = [];
  private time = 0;
  private mode: ModeId = 'overview';
  private thrust = false;
  private explodeBase = 1;
  private voxelSize = 0.1;
  private bayDrop = 0.6;
  private airTarget = 0;
  /** High-resolution cockpit section, built on first entry to cockpit mode. */
  private section: VoxelModel | null = null;
  private sectionFor: string | null = null;
  private sectionLevel = 0;
  private sectionToken = 0;
  /** Set when the airframe under a live section was replaced. */
  private sectionStale = false;
  private plumeTarget = 0;
  private speedTarget = 0;

  constructor(
    private readonly host: ModeHost,
    parent: Group,
  ) {
    this.fx.name = 'mode-fx';
    parent.add(this.fx);
    this.airflow = new AirflowEffect(this.fx);
    this.plume = new PlumeEffect(this.fx);
    this.speed = new SpeedLines(this.fx);
  }

  get current(): ModeId {
    return this.mode;
  }

  /** A new model is on the turntable: rebuild effects and land in the current state. */
  attach(model: VoxelModel, config: AircraftConfig, data: AssembleResult): void {
    this.model = model;
    this.config = config;
    this.fx.position.copy(model.group.position);
    if (this.sectionFor !== config.id) this.dropSection();
    if (this.section) {
      // Same aircraft rebuilt in place (wing sweep): keep the section, but the
      // pivot was cleared, so hang it back on.
      this.fx.parent?.add(this.section.group);
      this.section.group.position.copy(model.group.position);
      // The new airframe starts fully opaque; fade it to match the section.
      this.sectionStale = true;
    }
    this.voxelSize = data.voxelSize;
    this.anims.clear();
    this.values.clear();

    const size = model.size;
    this.explodeBase = Math.max(size.x, size.y, size.z) * 0.12;

    const exits = this.exits(config);
    this.plume.setExits(exits, data.voxelSize);
    this.airflow.setPaths(this.airPaths(config, data, exits), data.voxelSize);
    this.speed.setExtent(size.z, size.x);

    this.hinges.clear();
    const bay = config.geometry.bays?.[0];
    if (bay) {
      const y = bay.atY - bay.depth;
      this.hinges.set('bay-door-r', { pivot: [bay.halfWidth, y, 0], open: DOOR_OPEN });
      this.hinges.set('bay-door-l', { pivot: [-bay.halfWidth, y, 0], open: -DOOR_OPEN });
      for (const [part, h] of this.hinges) model.setPartHinge(part, h.pivot, [0, 0, 1], 0);
      this.bayDrop = bay.depth + 0.35;
    }

    this.labelParts = LABEL_ORDER.filter((p) => model.hasPart(p) && PART_EXPLODE_DIR[p]).slice(0, MAX_LABELS);
    this.labelPoints.length = 0;
    this.labelOffsets.length = 0;
    for (const p of this.labelParts) {
      this.labelPoints.push(model.partCentroid(p) ?? new Vector3());
      this.labelOffsets.push(new Vector3());
    }
    this.labels.setTargets(this.labelParts.map((p, i) => ({ point: this.labelPoints[i], text: PART_LABEL[p] })));

    this.applyParts(this.mode, null, false);
    this.applyThrust(this.thrust, false);
    this.showCards();
  }

  setMode(mode: ModeId): void {
    const prev = this.mode;
    this.mode = mode;
    if (!this.model) return;
    this.applyParts(mode, prev, true);
    this.applyCamera(mode);
    this.showCards();
    if (mode === 'cockpit') void this.ensureSection();
  }

  /** Re-runs the current mode's camera, after a resize or leaving orbit. */
  reframe(duration = 0.6): void {
    if (this.model) this.applyCamera(this.mode, duration);
  }

  setThrust(on: boolean): void {
    this.thrust = on;
    if (this.model) this.applyThrust(on, true);
  }

  setXray(v: number): void {
    if (this.mode !== 'xray' || !this.model) return;
    for (const part of PARTS) {
      const dir = PART_EXPLODE_DIR[part];
      if (!dir) continue;
      this.target(part, 'explode', this.xrayAmount(part, v), 0, 0.18, true);
    }
  }

  update(dt: number): void {
    this.time += dt;
    const model = this.model;
    if (!model) return;

    for (const [key, a] of this.anims) {
      const t = (this.time - a.start) / Math.max(1e-6, a.dur);
      if (t < 0) continue;
      const v = a.from + (a.to - a.from) * expoOut(Math.min(1, t));
      this.write(a.part, a.ch, v);
      if (t >= 1) this.anims.delete(key);
    }

    this.updateSection(dt);

    if (this.mode === 'weapons' && model.hasPart('gun')) {
      // Through write(), so leaving the mode eases down from wherever the
      // pulse happened to be rather than leaving the guns lit.
      this.write('gun', 'highlight', 0.45 + 0.3 * Math.sin(this.time * 4.2));
    }

    const k = 1 - Math.exp(-dt * 3.5);
    this.airflow.level += (this.airTarget - this.airflow.level) * k;
    this.plume.level += (this.plumeTarget - this.plume.level) * k;
    this.speed.level += (this.speedTarget - this.speed.level) * k;
    this.airflow.update(dt);
    this.plume.update(dt);
    this.speed.update(dt);

    if (this.mode === 'xray') {
      this.labelParts.forEach((p, i) => {
        const d = PART_EXPLODE_DIR[p];
        const amount = this.values.get(`${p}:explode`) ?? 0;
        if (d) this.labelOffsets[i].set(d[0], d[1], d[2]).normalize().multiplyScalar(amount);
      });
      const { width, height } = this.host.viewport();
      this.labels.update(this.host.camera, model.group, width, height, this.labelOffsets);
    }
  }

  /** Hides everything the mode manager draws, for the radar view. */
  setSuppressed(on: boolean): void {
    this.fx.visible = !on;
    if (on) this.labels.setVisible(false);
    else this.labels.setVisible(this.mode === 'xray');
  }

  dispose(): void {
    this.dropSection();
    this.airflow.dispose();
    this.plume.dispose();
    this.speed.dispose();
    this.labels.dispose();
  }

  // ---------------------------------------------------------------- parts

  private applyParts(mode: ModeId, prev: ModeId | null, animate: boolean): void {
    const xray = this.host.store.get('xray');
    for (const part of PARTS) {
      if (part === 'none') continue;
      const hidden = HIDDEN.has(part);
      let opacity = hidden ? 0 : 1;
      let highlight = 0;
      let explode = 0;
      let emissive = 0;

      switch (mode) {
        case 'cockpit':
          // Through the canopy: glazing nearly gone, frame softened, the
          // sight or HUD symbology and the displays lit.
          if (part === 'canopy-glass') opacity = 0.1;
          if (part === 'canopy-frame') opacity = 0.55;
          // The ejection seat stands as tall as the canopy and sits square in
          // front of the dials from any angle that faces them. Ghosted, it
          // still reads as a seat and the panel shows through.
          if (part === 'seat') opacity = 0.4;
          if (part === 'hud-symbology') {
            opacity = 1;
            emissive = 2.4;
          }
          if (part === 'display') emissive = 1.3;
          if (part === 'hud') emissive = 0.25;
          break;
        case 'engines':
          opacity = PROPULSION.has(part) ? 1 : hidden ? 0 : 0.14;
          if (part === 'engine') highlight = 0.32;
          if (part === 'duct') highlight = 0.22;
          if (part === 'nozzle') highlight = 0.14;
          break;
        case 'weapons':
          if (part === 'load') opacity = 1;
          break;
        case 'xray':
          explode = this.xrayAmount(part, xray);
          break;
        default:
          break;
      }

      this.target(part, 'opacity', opacity, 0, 0.7, animate);
      this.target(part, 'highlight', highlight, 0, 0.6, animate);
      this.target(part, 'explode', explode, 0, mode === 'xray' ? 1.1 : 0.7, animate);
      if (!THRUST_OWNED.has(`${part}:emissive`)) this.target(part, 'emissive', emissive, 0, 0.6, animate);
    }

    // Weapons: stores rise onto their pylons from below, bay doors swing,
    // then the internal missiles drop on their arms. Leaving, the order runs
    // backwards so nothing passes through a closing door.
    const leaving = prev === 'weapons' && mode !== 'weapons';
    if (mode === 'weapons') {
      this.target('load', 'opacity', 1, 0.05, 0.35, animate, 0);
      this.target('load', 'explode', 0, 0.12, 1.0, animate, 1.6);
      for (const [part, h] of this.hinges) this.target(part, 'hinge', h.open, 0, 0.85, animate);
      this.target('bay-store', 'explode', this.bayDrop, 0.7, 0.8, animate);
    } else {
      if (leaving) {
        this.target('load', 'explode', 0.9, 0, 0.45, animate);
        this.target('load', 'opacity', 0, 0.1, 0.35, animate);
      }
      this.target('bay-store', 'explode', 0, 0, 0.5, animate);
      for (const part of this.hinges.keys()) this.target(part, 'hinge', 0, leaving ? 0.45 : 0, 0.6, animate);
    }

    this.airTarget = mode === 'engines' ? 1 : 0;
    this.labels.setVisible(mode === 'xray');
  }

  private applyThrust(on: boolean, animate: boolean): void {
    this.target('nozzle', 'emissive', on ? 3.6 : 0, 0, on ? 0.7 : 0.5, animate);
    this.target('nozzle', 'heat', on ? 0.5 : 0, 0, on ? 0.9 : 0.6, animate);
    this.target('engine', 'heat', on ? 0.45 : 0, 0, 0.9, animate);
    const reduced = this.host.reduced();
    this.plumeTarget = on ? 1 : 0;
    // Reduced motion keeps the glow and the plume, and drops the movement
    // that is there only for sensation: shake and speed lines.
    this.speedTarget = on && !reduced ? 1 : 0;
    this.host.rig.setShake(on && !reduced ? 1 : 0);
  }

  private xrayAmount(part: PartId, v: number): number {
    if (!PART_EXPLODE_DIR[part]) return 0;
    // Small interior parts travel further so they clear the parts around them.
    const far = part === 'seat' || part === 'hud' || part === 'hud-symbology' || part === 'display' ? 1.6 : 1;
    return v * this.explodeBase * far;
  }

  /**
   * Starts an eased change for one channel of one part. `from` forces the
   * starting value, for an entrance that begins somewhere else -- stores
   * rising from below their pylons.
   */
  private target(part: PartId, ch: Channel, to: number, delay: number, dur: number, animate: boolean, from?: number): void {
    if (ch === 'hinge' && !this.hinges.has(part)) return;
    const key = `${part}:${ch}`;
    if (from !== undefined) this.write(part, ch, from);
    const now = this.values.get(key) ?? this.defaultValue(part, ch);
    if (!animate) {
      this.anims.delete(key);
      this.write(part, ch, to);
      return;
    }
    if (now === to) {
      this.anims.delete(key);
      return;
    }
    this.anims.set(key, { part, ch, from: now, to, start: this.time + delay, dur });
  }

  private defaultValue(part: PartId, ch: Channel): number {
    return ch === 'opacity' ? (HIDDEN.has(part) ? 0 : 1) : 0;
  }

  private write(part: PartId, ch: Channel, v: number): void {
    const m = this.model;
    if (!m) return;
    this.values.set(`${part}:${ch}`, v);
    switch (ch) {
      case 'opacity':
        m.setOpacity(part, v);
        break;
      case 'highlight':
        m.setHighlight(part, v);
        break;
      case 'explode':
        m.setPartExplode(part, v);
        break;
      case 'emissive':
        m.setPartEmissive(part, v);
        break;
      case 'heat':
        m.setPartHeat(part, v);
        break;
      case 'hinge': {
        const h = this.hinges.get(part);
        if (h) m.setPartHinge(part, h.pivot, [0, 0, 1], v);
        break;
      }
    }
  }

  // ---------------------------------------------------------------- cockpit section

  /**
   * The airframe is too coarse for its cockpit to read: on an early jet the
   * whole tub is about six voxels wide. So cockpit mode builds just a box
   * round the cockpit at SECTION_SCALE times the resolution, in the same model
   * coordinates, and cross-fades it in over the airframe: a cutaway section.
   */
  private async ensureSection(): Promise<void> {
    const c = this.config;
    const model = this.model;
    if (!c || !model || this.sectionFor === c.id) return;
    const token = ++this.sectionToken;
    this.sectionFor = c.id;
    const cp = c.geometry.canopy;
    const L = c.geometry.fuselage.length;
    const zFront = L / 2 - cp.fromZ;
    const zBack = L / 2 - cp.toZ;
    const span = zFront - zBack;
    const w = cp.halfWidth * 2.4;
    const data = await buildClient.build(c, {
      voxelSize: this.voxelSize / SECTION_SCALE,
      crop: {
        min: [-w, cp.baseY - Math.max(1.0, span * 0.45), zBack - span * 0.35],
        max: [w, cp.topY + 0.25, zFront + span * 0.3],
      },
    });
    if (token !== this.sectionToken || this.config?.id !== c.id || !this.model) return;
    const section = new VoxelModel(`${c.id}:cockpit`, data);
    section.setAccent(c.palette.accent ?? '#ff6a2b');
    section.group.position.copy(this.model.group.position);
    section.partState.setAllOpacity(0);
    this.fx.parent?.add(section.group);
    this.section = section;
    this.sectionLevel = 0;
  }

  private updateSection(dt: number): void {
    const section = this.section;
    const model = this.model;
    if (!section || !model) return;
    const target = this.mode === 'cockpit' ? 1 : 0;
    const prev = this.sectionLevel;
    this.sectionLevel += (target - this.sectionLevel) * (1 - Math.exp(-dt * 4));
    if (Math.abs(target - this.sectionLevel) < 0.002) this.sectionLevel = target;
    if (this.sectionLevel === prev && !this.sectionStale) return;
    this.sectionStale = false;
    const level = this.sectionLevel;
    for (const part of PARTS) {
      if (part === 'none') continue;
      const st = SECTION_STATE[part];
      const base = st?.opacity ?? (HIDDEN.has(part) ? 0 : 1);
      section.setOpacity(part, base * level);
      if (st?.emissive) section.setPartEmissive(part, st.emissive * level);
    }
    // The airframe makes way for the section, and comes back as it goes.
    for (const part of PARTS) {
      if (part === 'none') continue;
      const key = `${part}:opacity`;
      if (this.anims.has(key)) continue;
      const v = this.values.get(key) ?? this.defaultValue(part, 'opacity');
      model.setOpacity(part, v * (1 - level));
    }
    section.group.visible = level > 0.002;
    // Fully faded, the airframe would still cost a full draw for nothing.
    model.group.visible = level < 0.998;
  }

  private dropSection(): void {
    this.sectionToken++;
    if (this.section) {
      this.section.group.removeFromParent();
      this.section.dispose();
    }
    this.section = null;
    this.sectionFor = null;
    this.sectionLevel = 0;
  }

  // ---------------------------------------------------------------- camera

  private applyCamera(mode: ModeId, duration = GLIDE): void {
    const host = this.host;
    const model = this.model;
    if (!model) return;
    host.setIdle(mode === 'overview');
    host.rig.setParallax(mode === 'overview');
    switch (mode) {
      case 'overview':
        host.rig.apply(host.heroPreset(), duration);
        break;
      case 'plan':
        host.rig.apply(host.planPreset(), duration);
        break;
      case 'cockpit':
        host.rig.apply(this.cockpitPreset(), duration);
        break;
      case 'engines':
        host.rig.apply(this.framed([1, 0.78, 0.14], 1.25), duration);
        break;
      case 'weapons':
        host.rig.apply(this.framed([0.62, -0.5, 0.72], 1.3), duration);
        break;
      case 'xray':
        host.rig.apply(this.framed([0.52, 0.42, 1], 1.55), duration);
        break;
    }
  }

  /**
   * Down into the cockpit through glazing faded almost to nothing. Single
   * seat: the eye sits above the seat pan, in front of the seat back, looking
   * forward and down at the panel and the sight. Two seats: a raised three-
   * quarter from the side, so both cockpits are in one frame. From the hero
   * shot the glide passes over the nose and in through the glass.
   */
  private cockpitPreset(): CameraPreset {
    const c = this.config!;
    const model = this.model!;
    const cp = c.geometry.canopy;
    const L = c.geometry.fuselage.length;
    const centre = model.center;
    const seats = cp.seats ?? 1;
    const zFront = L / 2 - cp.fromZ;
    const zBack = L / 2 - cp.toZ;
    const span = zFront - zBack;
    const h = cp.topY - cp.baseY;
    // The cockpit is only a handful of voxels across, so a camera actually
    // inside it sees a few giant blocks. The glide ends just above the faded
    // glazing instead, looking down and forward into the tub from behind and
    // a little to the side, close enough to fill the frame and far enough
    // that the seat, panel and lit sight read as one picture.
    const two = seats > 1;
    const zSeat = zBack + span * (two ? 0.5 : 0.42);
    // The builder sets the panel 3.4 interior units ahead of the seat; a unit is
    // one voxel, or a ninth of a metre if the voxel is smaller.
    const zPanel = zSeat + 3.4 * Math.max(this.voxelSize, 1 / 9);
    const look = new Vector3(0, cp.baseY - h * 0.1, two ? zSeat : zPanel - (zPanel - zSeat) * 0.25);
    // Portrait screens are narrow for the same vertical field, so stand back
    // until the section fits across them as well.
    const aspect = this.host.camera.aspect || 1;
    const dist = (span * (two ? 0.85 : 0.5) + h * 1.1) * 1.5 * Math.max(1, 0.9 / aspect);
    // From behind and above: high enough that the faded seat back does not
    // fill the frame, low enough to face the aft side of the panel where the
    // dials and screens are. From the side they are edge-on; from straight
    // above, the coaming hides them.
    const eye = look.clone().add(new Vector3(0.3, 0.62, -0.72).normalize().multiplyScalar(dist));
    eye.sub(centre);
    look.sub(centre);
    return this.shiftForChrome({ position: [eye.x, eye.y, eye.z], target: [look.x, look.y, look.z], fov: 50 });
  }

  /** Fits the model from a direction, origin-centred, then clears the placard. */
  private framed(dir: Vec3, margin: number): CameraPreset {
    const size = this.model!.size;
    const fov = 32;
    const aspect = this.host.camera.aspect || 1;
    const vFov = fov * DEG;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const r = Math.max(size.x, size.y, size.z) * 0.5;
    const dist = (r / Math.sin(Math.min(vFov, hFov) / 2)) * margin;
    const p = new Vector3(...dir).normalize().multiplyScalar(dist);
    return this.shiftForChrome({ position: [p.x, p.y, p.z], target: [0, 0, 0], fov });
  }

  /**
   * On a wide screen the left of the view belongs to the title and notes, so
   * slide the camera sideways until the subject sits right of centre -- the
   * same rule the hero shot follows.
   */
  private shiftForChrome(p: CameraPreset): CameraPreset {
    const cam = this.host.camera;
    const aspect = cam.aspect || 1;
    if (aspect <= 1.25) return p;
    const pos = new Vector3(...p.position);
    const tgt = new Vector3(...p.target);
    const fwd = tgt.clone().sub(pos);
    const dist = fwd.length();
    fwd.normalize();
    const up = new Vector3(...(p.up ?? [0, 1, 0]));
    const right = fwd.clone().cross(up).normalize();
    const vFov = (p.fov ?? cam.fov) * DEG;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const shift = right.multiplyScalar(-2 * dist * Math.tan(hFov / 2) * 0.15);
    pos.add(shift);
    tgt.add(shift);
    return { ...p, position: [pos.x, pos.y, pos.z], target: [tgt.x, tgt.y, tgt.z] };
  }

  // ---------------------------------------------------------------- effects

  /** Nozzle exits in model space: the plume starts here, the airflow ends here. */
  private exits(c: AircraftConfig): Exit[] {
    const L = c.geometry.fuselage.length;
    const n = c.geometry.nozzle;
    if (n) {
      const z = L / 2 - n.atZ;
      const y = n.atY ?? 0;
      const xs = n.kind === 'twin-round' || (n.separation ?? 0) > 0 ? [-(n.separation ?? 0), n.separation ?? 0] : [0];
      return xs.map((x) => ({ at: [x, y, z] as Vec3, radius: n.radius }));
    }
    const out: Exit[] = [];
    for (const nc of c.geometry.nacelles ?? []) {
      for (const s of nc.mirror ? [1, -1] : [1]) {
        out.push({
          at: [nc.at[0] * s, nc.at[1], L / 2 - (nc.at[2] + nc.length / 2)],
          radius: nc.exhaustRadius ?? nc.radius * 0.8,
        });
      }
    }
    return out;
  }

  /**
   * Intake to exhaust. The builder records each duct from lip to engine face;
   * those are carried on through the engine to the nearest nozzle. Podded
   * engines get a straight run through their nacelle.
   */
  private airPaths(c: AircraftConfig, data: AssembleResult, exits: Exit[]): Vec3[][] {
    const L = c.geometry.fuselage.length;
    const n = c.geometry.nozzle;
    const paths: Vec3[][] = [];
    for (const duct of data.ductPaths) {
      if (duct.length < 2) continue;
      const last = duct[duct.length - 1];
      const ex = exits.reduce((best, e) => (Math.abs(e.at[0] - last[0]) < Math.abs(best.at[0] - last[0]) ? e : best), exits[0]);
      const path: Vec3[] = duct.map((p) => [p[0], p[1], p[2]] as Vec3);
      if (ex) {
        if (n?.engineFromZ !== undefined) path.push([ex.at[0], ex.at[1], L / 2 - n.engineFromZ]);
        path.push([ex.at[0], ex.at[1], ex.at[2]]);
      }
      paths.push(path);
    }
    for (const nc of c.geometry.nacelles ?? []) {
      for (const s of nc.mirror ? [1, -1] : [1]) {
        const x = nc.at[0] * s;
        paths.push([
          [x, nc.at[1], L / 2 - (nc.at[2] - nc.length / 2)],
          [x, nc.at[1], L / 2 - (nc.at[2] + nc.length / 2)],
        ]);
      }
    }
    return paths;
  }

  private showCards(): void {
    const c = this.config;
    const m = this.model;
    if (!c || !m) return;
    const parts = PARTS.filter((p) => p !== 'none' && m.isPartVisible(p)).length;
    this.host.showCards(modeCards(this.mode, c, { voxels: m.info.surfaceVoxels, parts }));
  }
}
