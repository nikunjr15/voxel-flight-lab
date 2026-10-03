import { Group, Mesh, Vector3 } from 'three';
import { Stage } from '../engine/renderer/Renderer';
import { setupLighting, LightingHandles } from '../engine/renderer/Lighting';
import { createContactShadow } from '../engine/renderer/ContactShadow';
import { BackdropClouds } from '../engine/renderer/BackdropClouds';
import { buildClient } from '../engine/build/client';
import { VoxelModel } from '../engine/voxel/VoxelModel';
import { Rig } from '../scenes/rig/Rig';
import { Gallery, GALLERY_SETS } from '../scenes/rig/Gallery';
import { PARTS } from '../engine/voxel/parts';
import { CameraRig, CameraPreset } from '../scenes/CameraRig';
import { AIRCRAFT, byId } from '../aircraft';
import type { AircraftConfig } from '../aircraft/types';
import { DevStats } from '../ui/devstats';
import { Chrome } from '../ui/Chrome';
import { MODES } from '../ui/Toolbar';
import { createViewerStore } from './store';
import { ModeManager } from '../scenes/ModeManager';
import { RadarView } from '../scenes/RadarView';
import { radarCards } from '../ui/modeCopy';
import type { AssembleResult } from '../engine/build/assemble';

/** `?rig=1` swaps the exhibit for the primitive test bench. Review builds only. */
const RIG_MODE = __REVIEW__ && new URLSearchParams(location.search).get('rig') === '1';

/** `?gallery=2b` lays a batch out at true relative scale. Review builds only. */
const GALLERY_SET = __REVIEW__ ? new URLSearchParams(location.search).get('gallery') : null;

type ViewName =
  | 'hero'
  | 'hero34'
  | 'plan'
  | 'side'
  | 'port'
  | 'rear'
  | 'front'
  | 'rear34'
  | 'under';

/** Fixed inspection directions, so a screenshot is reproducible. */
const VIEW_DIRS: Record<ViewName, [number, number, number]> = {
  hero: [0.52, 0.3, 1],
  // Closer to level than the hero shot, which is roughly what a visitor sees.
  hero34: [0.78, 0.34, 0.86],
  plan: [0, 1, 0],
  side: [1, 0.06, 0],
  port: [-1, 0.06, 0],
  front: [0.12, 0.1, 1],
  rear: [0.1, 0.08, -1],
  rear34: [0.65, 0.4, -1],
  under: [0.15, -1, 0.25],
};

/**
 * Up vector per view. Straight up or down leaves the roll undefined against
 * the default +Y, so those name it explicitly. Plan view follows the
 * three-view convention: nose to the top of the frame.
 */
const VIEW_UPS: Partial<Record<ViewName, [number, number, number]>> = {
  plan: [0, 0, 1],
  under: [0, 0, -1],
};

/**
 * Distance needed to fit a box of `size` seen from `dir`. The eight corners
 * are projected onto the camera's own right and up axes, which is exact for
 * any angle -- a bounding sphere is wildly conservative for a long thin row,
 * and axis-aligned extents only work for a dead-on view.
 */
function fitDistance(
  size: Vector3,
  dir: Vector3,
  up: [number, number, number] | undefined,
  hFov: number,
  vFov: number,
): number {
  const forward = dir.clone().normalize();
  const upVec = new Vector3(...(up ?? [0, 1, 0]));
  let right = new Vector3().crossVectors(upVec, forward);
  if (right.lengthSq() < 1e-6) right = new Vector3(1, 0, 0);
  right.normalize();
  const screenUp = new Vector3().crossVectors(forward, right).normalize();

  let halfW = 0;
  let halfH = 0;
  const h = size.clone().multiplyScalar(0.5);
  for (let i = 0; i < 8; i++) {
    const corner = new Vector3(
      i & 1 ? h.x : -h.x,
      i & 2 ? h.y : -h.y,
      i & 4 ? h.z : -h.z,
    );
    halfW = Math.max(halfW, Math.abs(corner.dot(right)));
    halfH = Math.max(halfH, Math.abs(corner.dot(screenUp)));
  }
  return Math.max(halfW / Math.tan(hFov / 2), halfH / Math.tan(vFov / 2));
}

/** Direction the hero shot looks from: three-quarter, slightly above. */
const HERO_DIR = new Vector3(0.52, 0.3, 1).normalize();
const HERO_FOV = 31;
const PLAN_FOV = 30;

const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Mobile gets fewer, larger voxels; the silhouette survives, the cost does not.
 * The pane can report a zero viewport before first layout, so fall back to the
 * screen width rather than silently building everything at mobile density.
 */
const densityForViewport = (): number => {
  const override = Number(new URLSearchParams(location.search).get('density'));
  if (Number.isFinite(override) && override > 0) return override;
  const w = window.innerWidth || document.documentElement.clientWidth || window.screen?.width || 1280;
  return w < 760 ? 0.65 : 1;
};

export class App {
  private readonly stage: Stage;
  private readonly rig: CameraRig;
  private readonly lighting: LightingHandles;
  private readonly clouds = new BackdropClouds();
  private readonly pivot = new Group();
  private readonly stats = new DevStats();
  private readonly store = createViewerStore();
  private chrome: Chrome | null = null;
  private modes: ModeManager | null = null;
  private radar: RadarView | null = null;
  private sweepTimer = 0;
  private sweepBusy = false;
  /** Set while load() resets the sweep for a new aircraft, so that is not a rebuild request. */
  private sweepQuiet = false;

  private model: VoxelModel | null = null;
  private bench: Rig | null = null;
  private gallery: Gallery | null = null;
  private shadow: Mesh | null = null;
  private config: AircraftConfig;
  private reduced = prefersReducedMotion();
  private idle = true;
  private spin = 0;
  private lastTime = 0;
  private running = false;

  constructor(canvas: HTMLCanvasElement) {
    // A phone renders at 1.5x at most: past that the MSAA target costs more
    // fill than the eye gets back at that size.
    const phone = (window.innerWidth || 1280) < 760;
    this.stage = new Stage({ canvas, background: '#e9eced', maxPixelRatio: phone ? 1.5 : 2 });
    this.lighting = setupLighting(this.stage.scene, this.stage.renderer);
    this.stats.attachGl(this.stage.renderer.getContext());
    // Review builds expose the frame summary, for measuring each mode's cost.
    if (__REVIEW__) (window as unknown as { __stats: DevStats }).__stats = this.stats;
    this.stage.scene.add(this.clouds.mesh);
    this.stage.scene.add(this.pivot);

    this.rig = new CameraRig({
      camera: this.stage.camera,
      domElement: canvas,
      reducedMotion: this.reduced,
    });

    // `?id=` opens a particular exhibit; chapters will replace this in phase 5.
    this.config = byId(new URLSearchParams(location.search).get('id') ?? '') ?? AIRCRAFT[0];
    this.resize();
    this.rig.set(this.heroPreset());
    if (!GALLERY_SET && !RIG_MODE) {
      const root = document.querySelector<HTMLElement>('.chrome');
      if (root) this.chrome = new Chrome(root, this.store);
      this.modes = new ModeManager(
        {
          rig: this.rig,
          camera: this.stage.camera,
          store: this.store,
          reduced: () => this.reduced,
          heroPreset: () => this.heroPreset(),
          planPreset: () => this.planPreset(),
          setIdle: (v) => (this.idle = v && !this.store.get('orbit')),
          showCards: (cards) => this.chrome?.notes.show(cards),
          viewport: () => this.stage.size,
        },
        this.pivot,
      );
      this.radar = new RadarView();
      this.stage.scene.add(this.radar.group);
    }
    this.bindEvents();

    if (GALLERY_SET) void this.loadGallery(GALLERY_SET);
    else if (RIG_MODE) void this.loadRig();
    else void this.load(this.config).then(() => this.modes?.reframe(0.9));
  }

  /**
   * Dev review view. `?gallery=2b` lays a batch out at true relative scale so
   * proportions across a whole era can be judged in one screenshot.
   */
  private async loadGallery(set: string): Promise<void> {
    const params = new URLSearchParams(location.search);
    // A named set, or an ad-hoc comma-separated id list for a close look.
    const ids = GALLERY_SETS[set] ?? set.split(',').map((s2) => s2.trim()).filter(Boolean);
    const gallery = new Gallery(document.body);
    this.gallery = gallery;
    this.pivot.add(gallery.group);
    // Dev handle for isolating parts from the console while chasing a render
    // artefact: `__gallery.placed[0].model.setOpacity('fuselage', 0)`.
    if (import.meta.env.DEV) (window as unknown as { __gallery: Gallery }).__gallery = gallery;
    this.idle = false;
    this.pivot.rotation.set(0, 0, 0);
    this.rig.setParallax(false);
    this.clouds.mesh.visible = false;
    document.querySelector('.chrome')?.setAttribute('hidden', '');

    const view = (params.get('view') ?? 'plan') as ViewName;
    const density = Number(params.get('density')) || densityForViewport();
    await gallery.load(
      ids,
      // The viewport's own density unless overridden, so a gallery opened on a
      // phone shows what the phone will actually build.
      density,
      params.get('shared') !== '0',
      view === 'plan',
      // Two jets side by side is the compare case, so size to the smaller one.
      ids.length === 2 ? 'smallest' : 'largest',
      // Plan view reads fine as one long row; an oblique view does not.
      // Wrapping plan view into rows is not an option: the caption offset is
      // one world vector for the whole gallery, so a second row puts its
      // captions on top of the first row's.
      view === 'plan' || ids.length <= 4 ? Infinity : Math.ceil(ids.length / 2),
    );
    console.info(`[gallery ${set}]\n${gallery.table()}`);
    const blocks = gallery.placed.reduce((n, pl) => n + pl.model.info.surfaceVoxels, 0);
    this.stats.setExtra(
      `density ${density} · ${blocks.toLocaleString('en-US')} blocks · ${gallery.placed.length} jets`,
    );

    const b = gallery.bounds();
    const size = b.getSize(new Vector3());
    const centre = b.getCenter(new Vector3());
    const dir = new Vector3(...(VIEW_DIRS[view] ?? VIEW_DIRS.plan));

    // Re-fit on every resize: the pane can change aspect after the build
    // finishes, and a row fitted to the old aspect ends up badly framed.
    // Captions go below the model on screen. With the nose-up plan view that
    // is -Z (toward the tail); anything oblique keeps normal -Y.
    this.labelOffset =
      view === 'plan' ? new Vector3(0, 0, -(size.z * 0.5 + 2.1)) : new Vector3(0, -4.2, 0);

    this.refit = () => {
      const fov = 34;
      const vFov = (fov * Math.PI) / 180;
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * (this.stage.camera.aspect || 1));
      // Oblique views need more slack than a dead-on one: perspective makes the
      // near end of a long row larger than the centre-based fit predicts.
      // Plan view leaves extra room below the row for the DOM captions, which
      // the 3D fit knows nothing about.
      const slack = view === 'plan' ? 1.2 : 1.08;
      const zoom = Number(params.get('zoom')) || 1;
      const at = (params.get('at') ?? '').split(',').map(Number);
      const look =
        at.length === 3 && at.every((n) => Number.isFinite(n))
          ? new Vector3(at[0], at[1], at[2])
          : centre;
      const dist = (fitDistance(size, dir, VIEW_UPS[view], hFov, vFov) * slack) / zoom;
      const p = dir.clone().normalize().multiplyScalar(dist).add(look);
      this.rig.set({
        position: [p.x, p.y, p.z],
        target: [look.x, look.y, look.z],
        fov,
        up: VIEW_UPS[view],
      });
    };
    this.refit();
  }

  /**
   * Dev bench. `?rig=1` lays every primitive out on plinths; adding
   * `&only=N&view=side` isolates one and frames it from a fixed direction,
   * which is the only way to judge a nozzle or a duct without camera fiddling.
   */
  private async loadRig(): Promise<void> {
    const params = new URLSearchParams(location.search);
    const bench = new Rig(document.body);
    this.bench = bench;
    this.pivot.add(bench.group);
    this.idle = false;
    this.pivot.rotation.set(0, 0, 0);
    this.rig.setParallax(false);
    this.clouds.mesh.visible = false;
    document.querySelector('.chrome')?.setAttribute('hidden', '');

    const only = params.get('only');
    if (only !== null) {
      await bench.loadOne(Number(only));
      const view = (params.get('view') ?? 'hero') as ViewName;
      const zoom = Number(params.get('zoom')) || 1;
      const at = (params.get('at') ?? '').split(',').map(Number);
      const model = bench.placed[0]?.model;
      if (model) {
        const preset = this.fitPreset(model.size, view, 30, zoom);
        if (at.length === 3 && at.every((n) => Number.isFinite(n))) {
          // Look at a named point on the airframe rather than its centre, for
          // close inspection of a nose, a nozzle or a bay.
          preset.position = [
            preset.position[0] + at[0],
            preset.position[1] + at[1],
            preset.position[2] + at[2],
          ];
          preset.target = [at[0], at[1], at[2]];
        }
        preset.up = VIEW_UPS[view];
        this.rig.set(preset);
      }
      return;
    }

    await bench.load();
    const b = bench.bounds();
    const size = b.getSize(new Vector3());
    const centre = b.getCenter(new Vector3());
    const dist = Math.max(size.x, size.z * 1.4) * 1.45;
    this.rig.set({
      position: [centre.x, centre.y + dist * 0.72, centre.z + dist * 0.92],
      target: [centre.x, centre.y - 1, centre.z],
      fov: 42,
    });
  }

  /** Frames a model of the given size from a named direction, origin-centred. */
  private fitPreset(size: Vector3, view: ViewName, fov = 30, zoom = 1): CameraPreset {
    const dir = VIEW_DIRS[view] ?? VIEW_DIRS.hero;
    const radius = Math.max(size.x, size.y, size.z) * 0.5;
    const aspect = this.stage.camera.aspect || 1;
    const vFov = (fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const dist = ((radius / Math.sin(Math.min(vFov, hFov) / 2)) * 1.12) / Math.max(0.05, zoom);
    const p = new Vector3(...dir).normalize().multiplyScalar(dist);
    return { position: [p.x, p.y, p.z], target: [0, 0, 0], fov };
  }

  /**
   * Fits the airframe to whatever viewport we actually have, then slides the
   * target sideways so the model lands right of centre on wide screens and
   * stays centred on narrow ones. A hard-coded camera position cannot do both.
   */
  private heroPreset(): CameraPreset {
    const size = this.model?.size ?? new Vector3(15, 5, 15);
    const radius = Math.max(size.x, size.y, size.z) * 0.5;
    const aspect = this.stage.camera.aspect || 1;
    const vFov = (HERO_FOV * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const fit = Math.min(vFov, hFov);
    const wide = aspect > 1.25;
    const margin = wide ? 1.5 : 1.22;
    const dist = (radius / Math.sin(fit / 2)) * margin;

    const pos = HERO_DIR.clone().multiplyScalar(dist);
    const right = new Vector3()
      .crossVectors(pos.clone().negate(), new Vector3(0, 1, 0))
      .normalize();
    const visibleW = 2 * dist * Math.tan(hFov / 2);
    const visibleH = 2 * dist * Math.tan(vFov / 2);
    const target = right.multiplyScalar(wide ? -visibleW * 0.15 : 0);
    // On a narrow viewport the free space is the band between the title and
    // the notes, which sits a touch below the middle of the screen.
    target.y = wide ? 0 : visibleH * 0.02;

    return {
      position: [pos.x + target.x, pos.y + target.y, pos.z + target.z],
      target: [target.x, target.y, target.z],
      fov: HERO_FOV,
    };
  }

  /**
   * Top-down, nose up, fitted to the part of the screen the chrome leaves
   * free: right of the title on a wide screen, between the title and the
   * notes on a narrow one. Centred on the whole viewport, a delta lands on the
   * note cards and runs under the toolbar.
   */
  private planPreset(): CameraPreset {
    const size = this.modelSize;
    const aspect = this.stage.camera.aspect || 1;
    const vFov = (PLAN_FOV * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const wide = aspect > 1.25;
    // Share of the screen the footprint may take: wide screens give the left
    // ~40% to the placard; every screen loses top and bottom to the chrome.
    const freeW = wide ? 0.54 : 0.9;
    // On a phone the free band between title and notes is about a third.
    const freeH = wide ? 0.62 : 0.34;
    const distW = (size.x * 0.5) / (Math.tan(hFov / 2) * freeW);
    const distH = (size.z * 0.5) / (Math.tan(vFov / 2) * freeH);
    const dist = Math.max(distW, distH);
    const visibleW = 2 * dist * Math.tan(hFov / 2);
    const visibleH = 2 * dist * Math.tan(vFov / 2);
    // Looking down with the nose up, screen right is world -X and screen up is
    // world +Z. Moving the target the other way moves the aircraft that way.
    const tx = wide ? visibleW * 0.2 : 0;
    const tz = wide ? -visibleH * 0.04 : visibleH * 0.025;
    return {
      position: [tx, dist, tz],
      target: [tx, 0, tz],
      fov: PLAN_FOV,
      up: [0, 0, 1],
    };
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.resize);
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    window.addEventListener('keydown', this.onKeyDown);

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    motion.addEventListener('change', (e) => {
      this.reduced = e.matches;
      this.rig.setReducedMotion(e.matches);
    });

    this.store.on('orbit', (on) => {
      this.rig.setOrbit(on);
      this.idle = !on && this.store.get('mode') === 'overview';
      if (!on) this.modes?.reframe(1.2);
    });
    this.store.on('mode', (mode) => {
      // Choosing a view hands the camera back from free orbit and closes the
      // radar comparison.
      if (this.store.get('orbit')) this.store.set('orbit', false);
      if (this.store.get('radar')) this.store.set('radar', false);
      this.modes?.setMode(mode);
    });
    this.store.on('thrust', (on) => this.modes?.setThrust(on));
    this.store.on('xray', (v) => this.modes?.setXray(v));
    this.store.on('sweep', () => this.scheduleSweep());
    this.store.on('radar', (on) => void this.setRadar(on));
  }

  /**
   * The wing-sweep slider rebuilds the airframe at the new angle. Throttled:
   * a build takes a few tens of milliseconds in the worker, and a drag fires
   * far more often than that.
   */
  private scheduleSweep(): void {
    if (this.sweepQuiet || !this.config.geometry.wing.vg) return;
    window.clearTimeout(this.sweepTimer);
    this.sweepTimer = window.setTimeout(() => {
      if (this.sweepBusy) {
        this.scheduleSweep();
        return;
      }
      this.sweepBusy = true;
      void this.load(this.config, { keepChrome: true }).finally(() => (this.sweepBusy = false));
    }, 40);
  }

  /**
   * Radar comparison for stealth aircraft: shells round this aircraft and a
   * fourth-generation reference beside it. Everything the modes draw is
   * hidden while it is up.
   */
  private async setRadar(on: boolean): Promise<void> {
    const radar = this.radar;
    const model = this.model;
    if (!radar || !model) return;
    if (!on) {
      radar.hide();
      this.modes?.setSuppressed(false);
      this.modes?.setMode(this.store.get('mode'));
      return;
    }
    this.idle = false;
    this.modes?.setSuppressed(true);
    this.chrome?.notes.show(radarCards());
    await radar.show(this.config, model.size, 1 / this.voxelsPerMetre);
    if (!this.store.get('radar')) return;
    const b = radar.bounds;
    const aspect = this.stage.camera.aspect || 1;
    const fov = 34;
    const hFov = 2 * Math.atan(Math.tan((fov * Math.PI) / 360) * aspect);
    // On a wide screen the pair gets the half of the frame right of the
    // placard, centred two-thirds of the way across; on a narrow one, the
    // whole width.
    const wide = aspect > 1.25;
    // The bounds are the airframes alone; the shells stand proud of them.
    const share = wide ? 0.44 : 0.62;
    const centre = wide ? 0.36 : 0;
    const dist = Math.max(b.width / (2 * share), b.depth * aspect * 0.44) / Math.tan(hFov / 2);
    // Low enough that the horizontal plane, where the edge spikes lie, crosses
    // the face of each shell instead of running round its outline.
    const dir = new Vector3(0.22, 0.48, 0.85).normalize().multiplyScalar(dist);
    const shift = dist * Math.tan(hFov / 2) * centre;
    const tx = b.centreX - shift;
    this.rig.setParallax(false);
    this.rig.apply({ position: [tx + dir.x, dir.y, dir.z], target: [tx, 0, 0], fov }, 1.2);
  }

  /** Steps to the previous or next exhibit. Chapters and morphs come in phase 5. */
  private step(delta: number): void {
    const i = AIRCRAFT.indexOf(this.config);
    const next = AIRCRAFT[(i + delta + AIRCRAFT.length) % AIRCRAFT.length];
    const url = new URL(location.href);
    url.searchParams.set('id', next.id);
    history.replaceState(null, '', url);
    if (this.store.get('radar')) this.store.set('radar', false);
    void this.load(next).then(() => this.modes?.reframe(1.2));
  }

  private reframeTimer = 0;
  /** Set by the rig and gallery views so a resize re-runs their own fit. */
  private refit: (() => void) | null = null;
  /** World-space offset from a model to where its caption sits. */
  private labelOffset = new Vector3(0, -3.4, 0);
  private loadToken = 0;
  private voxelsPerMetre = 1;

  private readonly resize = (): void => {
    this.stage.resize(window.innerWidth, window.innerHeight);
    // Re-fit after the resize settles, so a drag-resize does not retween
    // the camera on every frame.
    window.clearTimeout(this.reframeTimer);
    this.reframeTimer = window.setTimeout(() => {
      if (this.rig.orbitEnabled) return;
      // The rig and the gallery frame their own content. Re-run whichever fit
      // is in force rather than falling back to the hero shot, which would
      // override their camera and reset the up vector.
      if (this.refit) {
        this.refit();
        return;
      }
      if (RIG_MODE) return;
      if (this.store.get('radar')) {
        void this.setRadar(true);
        return;
      }
      this.modes?.reframe(0.6);
    }, 160);
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    const x = (e.clientX / window.innerWidth) * 2 - 1;
    const y = (e.clientY / window.innerHeight) * 2 - 1;
    this.rig.setPointer(x, y);
  };

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'f' || e.key === 'F') this.stats.toggle();
    if (!this.chrome) return;
    if (e.key === 'Escape') {
      this.store.set('orbit', false);
      this.store.set('radar', false);
      this.store.set('mode', 'overview');
      this.modes?.reframe(1.2);
      return;
    }
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= MODES.length) {
      this.store.set('mode', MODES[n - 1].id);
      return;
    }
    if (e.key === 'ArrowRight') this.step(1);
    if (e.key === 'ArrowLeft') this.step(-1);
  };

  /**
   * Builds a config into instance buffers and swaps it onto the turntable.
   * The build runs in a worker, so a later call can land first; the token
   * check throws away anything the user has already navigated past.
   */
  async load(config: AircraftConfig, opts: { keepChrome?: boolean } = {}): Promise<void> {
    const token = ++this.loadToken;
    const changed = config !== this.config || !this.model;
    this.config = config;
    const vg = config.geometry.wing.vg;
    if (changed) {
      this.sweepQuiet = true;
      this.store.set('sweep', vg ? vg.sweepMin : Number.NaN);
      this.sweepQuiet = false;
    }
    if (!opts.keepChrome) this.chrome?.show(config);

    const sweep = this.store.get('sweep');
    const data: AssembleResult = await buildClient.build(config, {
      density: densityForViewport(),
      wingSweep: vg && Number.isFinite(sweep) ? sweep : undefined,
    });
    if (token !== this.loadToken) return;

    this.model?.dispose();
    this.pivot.clear();

    const model = new VoxelModel(config.id, data);
    model.setAccent(config.palette.accent ?? '#ff6a2b');

    // Re-centre so the turntable spins about the airframe, not the grid origin.
    const centre = model.center;
    model.group.position.set(-centre.x, -centre.y, -centre.z);
    this.pivot.add(model.group);

    const size = model.size;
    this.shadow = createContactShadow(Math.max(size.x, size.z) * 0.62, 0.34);
    this.shadow.position.y = -size.y * 0.5 - 0.35;
    this.pivot.add(this.shadow);

    this.model = model;
    this.voxelsPerMetre = 1 / data.voxelSize;
    if (this.modes) {
      this.pivot.add(this.modes.fx);
      this.modes.attach(model, config, data);
    }
    this.chrome?.setBlocks(data.total);
    this.stats.setExtra(
      `${data.total.toLocaleString('en-US')} voxels · build ${data.buildMs.toFixed(0)} ms · ${model.info.drawCalls} draws`,
    );

    if (import.meta.env.DEV) {
      const breakdown = PARTS.map((id, i) => [id, data.partCounts[i]] as const)
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([id, n]) => `${id} ${n}`)
        .join(', ');
      console.info(
        `[lab] ${config.id}: ${data.total} surface / ${data.solid} solid voxels, grid ${data.gridDims.join('x')}, ${data.buildMs.toFixed(1)} ms, ${data.buckets.length} draw calls`,
      );
      console.info(`[lab] parts: ${breakdown}`);
    }
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.frame);
  }

  private readonly frame = (now: number): void => {
    if (!this.running) return;
    const w0 = performance.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const t = now / 1000;

    this.clouds.update(t);

    if (this.idle && !this.reduced) {
      this.spin += dt * 0.12;
      this.pivot.rotation.y = this.spin;
      // Gentle bob and roll, as if trimmed out in level flight.
      this.pivot.position.y = Math.sin(t * 0.55) * 0.13;
      this.pivot.rotation.z = Math.sin(t * 0.37) * 0.018;
      this.pivot.rotation.x = Math.sin(t * 0.29) * 0.012;
    } else if (this.chrome && !this.store.get('orbit')) {
      // Settle square to the camera, the short way round. Nothing snaps.
      const home = Math.round(this.spin / (Math.PI * 2)) * Math.PI * 2;
      const k = 1 - Math.exp(-dt * 4);
      this.spin += (home - this.spin) * k;
      this.pivot.rotation.y = this.spin;
      this.pivot.rotation.x *= 1 - k;
      this.pivot.rotation.z *= 1 - k;
      this.pivot.position.y *= 1 - k;
    }

    this.modes?.update(dt);
    if (this.radar) {
      const { width, height } = this.stage.size;
      this.radar.update(dt, this.stage.camera, width, height);
    }
    this.rig.update(dt);
    this.stats.beginGpu();
    this.stage.render(t);
    this.stats.endGpu();
    this.chrome?.update(this.stage.camera, this.pivot);

    const overlay = this.bench ?? this.gallery;
    if (overlay) {
      const cam = this.stage.camera;
      const { width, height } = this.stage.size;
      overlay.updateLabels((p) => {
        const v = p.clone().project(cam);
        return {
          x: (v.x * 0.5 + 0.5) * width,
          y: (-v.y * 0.5 + 0.5) * height,
          visible: v.z < 1,
        };
      }, this.labelOffset);
    }

    this.stats.tick(now, performance.now() - w0);
    requestAnimationFrame(this.frame);
  };

  dispose(): void {
    this.running = false;
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('keydown', this.onKeyDown);
    this.model?.dispose();
    this.bench?.dispose();
    this.gallery?.dispose();
    this.clouds.dispose();
    this.lighting.dispose();
    this.rig.dispose();
    this.stage.dispose();
  }

  /** Model-space size of the current airframe, for camera framing. */
  get modelSize(): Vector3 {
    return this.model?.size ?? new Vector3(1, 1, 1);
  }

  /** Handles for dev inspection; the console uses these to drive the view. */
  get dev(): {
    stage: Stage;
    rig: CameraRig;
    pivot: Group;
    model: VoxelModel | null;
    bench: Rig | null;
    look(preset: CameraPreset): void;
    focus(i: number, dist?: number): void;
    setIdle(v: boolean): void;
  } {
    return {
      stage: this.stage,
      rig: this.rig,
      pivot: this.pivot,
      model: this.model,
      bench: this.bench,
      look: (preset) => this.rig.set(preset),
      focus: (i: number, dist = 9) => {
        const p = this.bench?.placed[i];
        if (!p) return;
        const c = p.centre;
        this.rig.set({
          position: [c.x + dist * 0.55, c.y + dist * 0.42, c.z + dist * 0.85],
          target: [c.x, c.y - 0.3, c.z],
          fov: 34,
        });
      },
      setIdle: (v) => {
        this.idle = v;
        if (!v) this.pivot.rotation.set(0, 0, 0);
      },
    };
  }
}
