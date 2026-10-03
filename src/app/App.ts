import { Group, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import gsap from 'gsap';
import { Stage } from '../engine/renderer/Renderer';
import { setupLighting, LightingHandles } from '../engine/renderer/Lighting';
import { createContactShadow } from '../engine/renderer/ContactShadow';
import { BackdropClouds } from '../engine/renderer/BackdropClouds';
import { buildClient } from '../engine/build/client';
import { VoxelModel } from '../engine/voxel/VoxelModel';
import { setMorphAvoid, setMorphBounds } from '../engine/voxel/material';
import { Rig } from '../scenes/rig/Rig';
import { Gallery, GALLERY_SETS } from '../scenes/rig/Gallery';
import { PARTS } from '../engine/voxel/parts';
import { CameraRig, CameraPreset } from '../scenes/CameraRig';
import { AIRCRAFT, byChapter, byId, chapterInfo, hasJets } from '../aircraft';
import type { AircraftConfig } from '../aircraft/types';
import { DevStats } from '../ui/devstats';
import { Chrome } from '../ui/Chrome';
import { MODES } from '../ui/Toolbar';
import { createViewerStore } from './store';
import { ModeManager } from '../scenes/ModeManager';
import { RadarView } from '../scenes/RadarView';
import { radarCards } from '../ui/modeCopy';
import type { AssembleOptions, AssembleResult } from '../engine/build/assemble';
import { BuildCache } from './BuildCache';
import { Chapters } from '../ui/Chapters';
import { Ribbon } from '../ui/Ribbon';

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

/** Where the visitor is: a chapter, and in chapters with aircraft, which one. */
interface Route {
  ch: number;
  id: string | null;
}

/**
 * Reads `#ch3/mig-23`. An aircraft in the link decides the chapter, so a
 * link that names the wrong chapter still opens the right exhibit; the
 * introduction and Compare carry no aircraft.
 */
function parseRoute(hash: string): Route | null {
  const m = /^#ch(\d)(?:\/([a-z0-9-]+))?$/i.exec(hash);
  if (!m) return null;
  const ch = Number(m[1]);
  if (!chapterInfo(ch)) return null;
  const c = m[2] ? byId(m[2].toLowerCase()) : undefined;
  if (c && hasJets(ch)) return { ch: c.chapter, id: c.id };
  return { ch, id: null };
}

const routeHash = (r: Route): string => `#ch${r.ch}${r.id && hasJets(r.ch) ? `/${r.id}` : ''}`;

/**
 * The aircraft a chapter opens on when nothing else has been picked there.
 * The introduction opens on the first aircraft, Compare on the last.
 */
const firstOf = (ch: number): AircraftConfig =>
  hasJets(ch) ? byChapter(ch)[0] : ch === 0 ? AIRCRAFT[0] : AIRCRAFT[AIRCRAFT.length - 1];

type Transition = 'initial' | 'morph' | 'fade' | 'cut';

/**
 * How far the first aircraft is blown apart at the top of the page. Fully
 * scattered, the cloud fills the screen and buries the introduction; part
 * way, it reads as an airframe coming apart.
 */
const COVER_SCATTER = 0.3;

/** Outgoing airframe during a morph, until its voxels have scattered away. */
interface Leaving {
  model: VoxelModel;
  shadow: Mesh;
}

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
  private readonly cache = new BuildCache();
  private readonly leaving: Leaving[] = [];
  private chapters: Chapters | null = null;
  private ribbon: Ribbon | null = null;
  /** Chapter under the middle of the screen; -1 before the first scroll check. */
  private chapter = -1;
  /** The aircraft last shown in each chapter, so scrolling back returns to it. */
  private readonly remembered = new Map<number, string>();
  /** 0..1, how much chapter text covers the screen. */
  private introCover = 0;
  /** Scroll progress through the introduction: 0 at the top of the page. */
  private coverProgress = 1;
  private historyTimer = 0;
  private prefetchTimer = 0;
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

    // `#ch3/mig-23` opens a chapter and an aircraft. `?id=` is the older
    // form, kept so review links still work: it opens that aircraft's chapter.
    const legacy = byId(new URLSearchParams(location.search).get('id') ?? '');
    const route: Route = parseRoute(location.hash) ?? (legacy ? { ch: legacy.chapter, id: legacy.id } : { ch: 0, id: null });
    this.config = (route.id && byId(route.id)) || firstOf(route.ch);
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
      this.pivot.add(this.modes.fx);
      this.setupChapters(route);
    }
    this.bindEvents();

    if (GALLERY_SET) void this.loadGallery(GALLERY_SET);
    else if (RIG_MODE) void this.loadRig();
    else void this.present(this.config, 'initial').then(() => this.buildSilhouettes());
  }

  /**
   * The scrolling story and the ribbon. The page opens at the chapter the
   * address names, with the text already scrolled away when it names an
   * aircraft too.
   */
  private setupChapters(route: Route): void {
    const ribbonMount = document.querySelector<HTMLElement>('[data-mount="ribbon"]');
    if (ribbonMount) this.ribbon = new Ribbon(ribbonMount, (id) => this.navigate(id, 'pick'));
    const mount = document.querySelector<HTMLElement>('[data-mount="chapters"]');
    if (!mount) return;
    this.chapters = new Chapters(
      mount,
      {
        onActive: (n) => this.onChapter(n),
        onIntro: (v) => {
          this.introCover = v;
          this.chrome?.setIntro(v);
        },
        onCover: (p) => {
          this.coverProgress = p;
          this.applyCover();
        },
        onSelect: (id) => this.navigate(id, 'pick'),
      },
      this.reduced,
    );
    for (let ch = 1; ch <= 7; ch++) this.remembered.set(ch, firstOf(ch).id);
    if (route.id) this.remembered.set(route.ch, route.id);
    this.ribbon?.setCurrent(this.config.id, this.config.chapter);

    // Scroll positions are this page's to restore, from the address.
    history.scrollRestoration = 'manual';
    history.replaceState(null, '', this.urlFor(route));
    const land = () => {
      if (route.ch !== 0 || route.id) this.chapters?.jumpTo(route.ch, route.id ? 'exhibit' : 'intro');
      else window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    };
    land();
    const landedAt = window.scrollY;
    // Web fonts can change the height of the chapter text; land again once
    // they are in, so a deep link still opens on its exhibit -- unless the
    // visitor has already scrolled away from where it put them.
    void document.fonts?.ready.then(() => {
      this.chapters?.refresh();
      if (Math.abs(window.scrollY - landedAt) < 2) land();
    });
    window.addEventListener('popstate', this.onPopState);
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
      void this.present(this.config, 'cut', { keepChrome: true }).finally(() => (this.sweepBusy = false));
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

  /**
   * Steps to the previous or next aircraft in exhibit order, across chapter
   * boundaries. From the introduction the first step is the first aircraft;
   * from Compare, back is the last.
   */
  private step(delta: number): void {
    if (this.chapter === 0 && delta > 0) return this.navigate(AIRCRAFT[0].id, 'key');
    if (this.chapter === 8 && delta < 0) return this.navigate(AIRCRAFT[AIRCRAFT.length - 1].id, 'key');
    const next = AIRCRAFT[AIRCRAFT.indexOf(this.config) + delta];
    if (next) this.navigate(next.id, 'key');
  }

  /**
   * Shows an aircraft. A pick or a key press in another chapter moves the
   * page there; a scroll has already moved it. Either way the toolbar goes
   * back to the overview, and the airframe morphs into the new one.
   */
  private navigate(id: string, source: 'pick' | 'key' | 'scroll' | 'history'): void {
    const c = byId(id);
    if (!c) return;
    this.remembered.set(c.chapter, c.id);
    if (source === 'pick' || source === 'key') {
      // Land on the exhibit run, so the placard is not under chapter text.
      if (this.chapter !== c.chapter || this.introCover > 0.5) {
        this.chapter = c.chapter;
        this.chapters?.jumpTo(c.chapter, 'exhibit');
      }
    }
    if (c !== this.config) {
      this.resetView();
      void this.present(c, this.reduced ? 'fade' : 'morph');
    }
    this.ribbon?.setCurrent(c.id, this.chapter >= 0 ? this.chapter : c.chapter);
    if (source !== 'history') this.scheduleHistory();
  }

  /** The chapter under the middle of the screen changed, by scrolling or a jump. */
  private onChapter(n: number): void {
    const changed = n !== this.chapter;
    this.chapter = n;
    this.ribbon?.setChapter(n);
    const info = chapterInfo(n);
    if (info) this.chrome?.setChapter(info);
    if (n === 8) {
      // Compare has no aircraft of its own: whatever is on show stays.
      if (changed) this.resetView();
    } else {
      const id = hasJets(n) ? (this.remembered.get(n) ?? firstOf(n).id) : firstOf(n).id;
      if (id !== this.config.id) this.navigate(id, 'scroll');
      else if (changed) this.resetView();
      this.ribbon?.setCurrent(this.config.id, n);
    }
    this.applyCover();
    this.scheduleHistory();
    this.scheduleMorphBounds();
  }

  private boundsTimer = 0;

  private scheduleMorphBounds(): void {
    window.clearTimeout(this.boundsTimer);
    this.boundsTimer = window.setTimeout(() => this.updateMorphBounds(), 380);
  }

  /**
   * Tells the voxel shader where a morph's flying voxels may go: right of the
   * text column on a wide screen, and between the top strip and the toolbar;
   * on a phone, the band between the placard and the notes. Measured from
   * the live layout, so a long name or a resize moves the line with it.
   */
  private updateMorphBounds(): void {
    if (!this.chrome) return;
    const W = window.innerWidth || 1;
    const H = window.innerHeight || 1;
    const rect = (sel: string): DOMRect | null => document.querySelector(sel)?.getBoundingClientRect() ?? null;
    const nx = (px: number) => (px / W) * 2 - 1;
    const ny = (py: number) => 1 - (py / H) * 2;
    const top = rect('.chrome__top');
    const tools = rect('.chrome__tools');
    const yMax = top ? ny(top.bottom + 8) : 1;
    const yMin = tools ? ny(tools.top - 8) : -1;
    if (W >= 760 && W / H > 1.25) {
      // The text column: the placard, or chapter text, whichever is wider.
      const title = rect('.chrome__main');
      const inner = rect('.chapter__inner');
      const right = Math.max(title?.right ?? 0, inner ? inner.left + inner.width : 0) + 24;
      setMorphBounds(nx(right), 9, yMin, yMax);
      // The note cards run further right than the title, along the bottom.
      const notes = rect('.chrome__notes');
      if (notes && notes.width > 0) setMorphAvoid(nx(notes.right + 16), ny(notes.top - 12));
      else setMorphAvoid(-9, -9);
    } else {
      setMorphAvoid(-9, -9);
      const title = rect('.chrome__main');
      const notes = rect('.chrome__notes');
      setMorphBounds(-9, 9, notes ? ny(notes.top - 8) : yMin, title ? ny(title.bottom + 8) : yMax);
    }
  }

  /** Back to the overview: changing aircraft or chapter starts from the top. */
  private resetView(): void {
    this.store.set('orbit', false);
    this.store.set('radar', false);
    this.store.set('thrust', false);
    if (this.store.get('mode') !== 'overview') this.store.set('mode', 'overview');
    else this.modes?.reframe(1.2);
  }

  private currentRoute(): Route {
    return { ch: Math.max(0, this.chapter), id: hasJets(this.chapter) ? this.config.id : null };
  }

  /** The address for a route, dropping the older ?id= form. */
  private urlFor(route: Route): string {
    const url = new URL(location.href);
    url.searchParams.delete('id');
    url.hash = route.ch === 0 && !route.id ? '' : routeHash(route);
    return url.pathname + url.search + url.hash;
  }

  /**
   * One history entry per place the visitor settles, not per chapter scrolled
   * past: the address updates a moment after things stop changing.
   */
  private scheduleHistory(): void {
    window.clearTimeout(this.historyTimer);
    this.historyTimer = window.setTimeout(() => {
      if (this.chapter < 0) return;
      const url = this.urlFor(this.currentRoute());
      if (url === location.pathname + location.search + location.hash) return;
      history.pushState(null, '', url);
    }, 450);
  }

  /** Back and forward: go where the address says, without adding an entry. */
  private readonly onPopState = (): void => {
    window.clearTimeout(this.historyTimer);
    const route = parseRoute(location.hash) ?? { ch: 0, id: null };
    const id = route.id ?? (hasJets(route.ch) ? (this.remembered.get(route.ch) ?? firstOf(route.ch).id) : null);
    this.chapter = route.ch;
    if (route.ch === 0 && !route.id) window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    else this.chapters?.jumpTo(route.ch, route.id ? 'exhibit' : 'intro');
    if (id) this.navigate(id, 'history');
    else if (route.ch === 0) this.navigate(firstOf(0).id, 'history');
  };

  /**
   * The introduction opens on the first aircraft as a cloud of voxels, which
   * gathers into the airframe as the introduction scrolls away.
   */
  private applyCover(): void {
    const model = this.model;
    if (!model || !this.chapters || this.reduced) return;
    if (model.info.id !== firstOf(0).id || gsap.isTweening(model.uniforms.uMorph)) return;
    model.setMorph(this.chapter <= 0 ? COVER_SCATTER * Math.max(0, 1 - this.coverProgress) : 0);
  }

  private buildOpts(c: AircraftConfig): AssembleOptions {
    const vg = c.geometry.wing.vg;
    const sweep = this.store.get('sweep');
    return {
      density: densityForViewport(),
      wingSweep: vg ? (c === this.config && Number.isFinite(sweep) ? sweep : vg.sweepMin) : undefined,
    };
  }

  /**
   * After a change settles, build what the visitor is most likely to ask for
   * next: either neighbour in exhibit order, and the aircraft each
   * neighbouring chapter would open on.
   */
  private prefetchAround(c: AircraftConfig): void {
    window.clearTimeout(this.prefetchTimer);
    this.prefetchTimer = window.setTimeout(() => {
      const i = AIRCRAFT.indexOf(c);
      const list: (AircraftConfig | undefined)[] = [AIRCRAFT[i + 1], AIRCRAFT[i - 1]];
      for (const n of [c.chapter + 1, c.chapter - 1]) {
        if (hasJets(n)) list.push(byId(this.remembered.get(n) ?? '') ?? firstOf(n));
      }
      const unique = [...new Set(list.filter((x): x is AircraftConfig => !!x && x !== c))];
      void this.cache.prefetch(unique, (x) => this.buildOpts(x));
    }, 1300);
  }

  /** Plan-view masks for the ribbon, one at a time behind the real builds. */
  private async buildSilhouettes(): Promise<void> {
    if (!this.ribbon) return;
    for (const c of AIRCRAFT) {
      try {
        this.ribbon.setMask(await buildClient.silhouette(c));
      } catch {
        // An icon that fails to build stays blank; the name is still there.
      }
    }
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
    this.scheduleMorphBounds();
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
    // A focused slider or field owns its keys: the arrows move the wing
    // sweep, not the exhibit.
    if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
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
   * Puts an aircraft on the turntable. The build comes from the cache --
   * usually prefetched, so nothing waits on the worker -- and arrives by
   * `how`:
   *   morph   the old airframe scatters into its voxel cloud as the new one
   *           gathers out of its own
   *   fade    a plain crossfade, for reduced motion
   *   initial the first aircraft on the page assembling out of its cloud
   *   cut     an in-place rebuild (the wing-sweep slider), no transition
   * The worker can answer out of order; the token drops anything the visitor
   * has already moved past.
   */
  async present(config: AircraftConfig, how: Transition, opts: { keepChrome?: boolean } = {}): Promise<void> {
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

    const data: AssembleResult = await this.cache.get(config, this.buildOpts(config));
    // A prefetched build resolves at once, which would run everything below
    // inside the click or key handler that asked for it. Yield first, so the
    // placard update and the model swap are two short tasks, not one long one.
    await new Promise((r) => setTimeout(r, 0));
    if (token !== this.loadToken) return;
    const t0 = performance.now();

    const model = new VoxelModel(config.id, data);
    model.setAccent(config.palette.accent ?? '#ff6a2b');
    // Re-centre so the turntable spins about the airframe, not the grid origin.
    const centre = model.center;
    model.group.position.set(-centre.x, -centre.y, -centre.z);
    const size = model.size;
    const shadow = createContactShadow(Math.max(size.x, size.z) * 0.62, 0.34);
    shadow.position.y = -size.y * 0.5 - 0.35;

    const prev = this.model && this.shadow ? { model: this.model, shadow: this.shadow } : null;
    this.pivot.add(model.group, shadow);
    this.model = model;
    this.shadow = shadow;
    this.voxelsPerMetre = 1 / data.voxelSize;
    this.modes?.attach(model, config, data);

    if (prev) this.retire(prev, how);
    this.arrive(model, shadow, how);
    if (how !== 'cut') {
      this.modes?.reframe(how === 'initial' ? 0.9 : 1.2);
      this.prefetchAround(config);
    }
    this.stats.task(`present ${config.id}`, performance.now() - t0);
    this.scheduleMorphBounds();

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

  /** The incoming airframe: gathers out of its cloud, fades in, or simply appears. */
  private arrive(model: VoxelModel, shadow: Mesh, how: Transition): void {
    const shade = shadow.material as MeshBasicMaterial;
    if (how === 'cut') return;
    if (how === 'fade' || (how === 'initial' && this.reduced)) {
      const fade = { v: 0 };
      model.setFade(0);
      shade.opacity = 0;
      gsap.to(fade, { v: 1, duration: 0.5, delay: 0.15, ease: 'power2.out', onUpdate: () => model.setFade(fade.v) });
      gsap.to(shade, { opacity: 1, duration: 0.5, delay: 0.15 });
      return;
    }
    // On the introduction the cloud only half gathers: the scroll finishes it.
    const cover = how === 'initial' && this.chapter <= 0 && model.info.id === firstOf(0).id;
    const to = cover ? COVER_SCATTER * Math.max(0, 1 - this.coverProgress) : 0;
    model.setMorph(1.3);
    shade.opacity = 0;
    gsap.to(model.uniforms.uMorph, {
      value: to,
      duration: how === 'initial' ? 1.6 : 1.15,
      delay: how === 'initial' ? 0.1 : 0.28,
      ease: 'power3.out',
      onComplete: () => this.applyCover(),
    });
    gsap.to(shade, { opacity: 1, duration: 0.8, delay: 0.45 });
  }

  /**
   * The outgoing airframe scatters from wherever it is -- even half gathered,
   * if the visitor moved on mid-morph -- and is dropped once it is gone.
   */
  private retire(prev: Leaving, how: Transition): void {
    const { model, shadow } = prev;
    if (how === 'cut') {
      this.drop(prev);
      return;
    }
    // Whatever mode left it in -- hidden under a cockpit section, exploded,
    // doors open -- it leaves as the plain airframe; the scatter hides the snap.
    model.partState.reset();
    model.setExplode(1);
    model.group.visible = true;
    gsap.killTweensOf(model.uniforms.uMorph);
    this.leaving.push(prev);
    // Two on the way out is plenty; a third means the visitor is racing.
    while (this.leaving.length > 2) this.drop(this.leaving[0]);

    gsap.to(shadow.material as MeshBasicMaterial, { opacity: 0, duration: 0.45 });
    if (how === 'fade' || this.reduced) {
      const fade = { v: model.uniforms.uFade.value };
      gsap.to(fade, {
        v: 0,
        duration: 0.4,
        ease: 'power2.in',
        onUpdate: () => model.setFade(fade.v),
        onComplete: () => this.drop(prev),
      });
      return;
    }
    const from = Math.min(1.3, model.morph);
    gsap.to(model.uniforms.uMorph, {
      value: 1.3,
      duration: 0.25 + 0.6 * (1 - from / 1.3),
      ease: 'power2.in',
      onComplete: () => this.drop(prev),
    });
  }

  private drop(item: Leaving): void {
    const i = this.leaving.indexOf(item);
    if (i >= 0) this.leaving.splice(i, 1);
    gsap.killTweensOf(item.model.uniforms.uMorph);
    gsap.killTweensOf(item.shadow.material);
    item.model.group.removeFromParent();
    item.shadow.removeFromParent();
    item.model.dispose();
    // The shadow's map is shared; only its own material and geometry go.
    (item.shadow.material as MeshBasicMaterial).dispose();
    item.shadow.geometry.dispose();
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
    window.removeEventListener('popstate', this.onPopState);
    this.chapters?.dispose();
    for (const l of [...this.leaving]) this.drop(l);
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
