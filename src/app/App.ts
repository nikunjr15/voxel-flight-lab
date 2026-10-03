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
import { AIRCRAFT, byChapter, byId, chapterInfo, hasJets, SUGGESTED_PAIRS } from '../aircraft';
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
import { JetAudio, voiceFor } from '../engine/audio/JetAudio';
import { session } from './session';
import type { LoadTask } from '../ui/Loader';
import { Chapters } from '../ui/Chapters';
import { Ribbon } from '../ui/Ribbon';
import { CompareScene, type CompareLayout } from '../scenes/CompareScene';
import { ComparePanel } from '../ui/ComparePanel';
import { VapourCone } from '../engine/particles/Particles';

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
  /** Compare only: the two aircraft on the turntable. */
  pair?: [string, string];
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
  const tail = m[2]?.toLowerCase();
  if (ch === 8 && tail) {
    // `#ch8/gnat-vs-f-86`. Aircraft ids contain hyphens, never "-vs-".
    const [a, b] = tail.split('-vs-');
    if (a && b && a !== b && byId(a) && byId(b)) return { ch, id: null, pair: [a, b] };
    return { ch, id: null };
  }
  const c = tail ? byId(tail) : undefined;
  if (c && hasJets(ch)) return { ch: c.chapter, id: c.id };
  return { ch, id: null };
}

const routeHash = (r: Route): string => {
  if (r.ch === 8 && r.pair) return `#ch8/${r.pair[0]}-vs-${r.pair[1]}`;
  return `#ch${r.ch}${r.id && hasJets(r.ch) ? `/${r.id}` : ''}`;
};

/** The pair Compare opens on: the first suggestion, the Gnat and the Sabre. */
const DEFAULT_PAIR: [string, string] = [SUGGESTED_PAIRS[0].a, SUGGESTED_PAIRS[0].b];

/**
 * How a pair stands on a phone. `?compare=side|stack` overrides, so both can
 * be reviewed; wide screens are always side by side.
 */
const PHONE_COMPARE: CompareLayout =
  (new URLSearchParams(location.search).get('compare') as CompareLayout | null) ?? 'stack';

/**
 * The aircraft a chapter opens on when nothing else has been picked there.
 * The introduction opens on the first aircraft, Compare on the last.
 */
const firstOf = (ch: number): AircraftConfig =>
  hasJets(ch) ? byChapter(ch)[0] : ch === 0 ? AIRCRAFT[0] : AIRCRAFT[AIRCRAFT.length - 1];

type Transition = 'initial' | 'morph' | 'fade' | 'cut' | 'quality';

/**
 * Density rungs for adaptive quality. Desktop starts on the first, a phone on
 * the third; a device that cannot hold the frame rate steps down one rung at
 * a time. Each step also sheds one screen-space cost: grain, then MSAA, then
 * pixel ratio above 1.
 */
const LADDER = [1, 0.8, 0.65, 0.5];
/** Mean frame interval above this, held for SLOW_HOLD_MS, means step down. ~42 fps. */
const SLOW_FRAME_MS = 24;
const SLOW_HOLD_MS = 2000;

/**
 * How far the first aircraft is blown apart at the top of the page. Fully
 * scattered, the cloud fills the screen and buries the introduction; part
 * way, it reads as an airframe coming apart.
 */
const COVER_SCATTER = 0.3;

/** How far the hangar turntable sways either way, radians. */
const COMPARE_SWAY = 0.42;

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
  readonly audio = new JetAudio();
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
  private compare: CompareScene | null = null;
  private comparePanel: ComparePanel | null = null;
  private compareOn = false;
  private comparePair: [string, string] = DEFAULT_PAIR;
  private readonly compareLabels: HTMLElement[] = [];
  private vapour: VapourCone | null = null;
  private flyTl: gsap.core.Timeline | null = null;
  private flying = false;
  private spaceTimer = 0;
  /** `?density=` pins the density and switches adaptive quality off. */
  private readonly pinnedDensity = Number(new URLSearchParams(location.search).get('density')) || 0;
  private rung = (window.innerWidth || 1280) < 760 ? 2 : 0;
  private qualitySteps = 0;
  private avgFrame = 16.7;
  private slowMs = 0;
  /** No judging the frame rate until this time: loading and morphs are allowed to be heavy. */
  private calmUntil = performance.now() + 4000;
  private spaceShift = false;
  private swallowClick = false;
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

  private readonly onProgress: (task: LoadTask, v: number) => void;

  constructor(canvas: HTMLCanvasElement, opts: { onProgress?: (task: LoadTask, v: number) => void } = {}) {
    this.onProgress = opts.onProgress ?? (() => {});
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
    if (route.pair) this.comparePair = route.pair;
    this.setupCompare();
    this.ribbon?.setCurrent(this.config.id, this.config.chapter);

    // Scroll positions are this page's to restore, from the address.
    history.scrollRestoration = 'manual';
    history.replaceState(null, '', this.urlFor(route));
    const land = () => {
      // An aircraft or a pair in the link means the exhibit, not the chapter text.
      if (route.ch !== 0 || route.id) this.chapters?.jumpTo(route.ch, route.id || route.pair ? 'exhibit' : 'intro');
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
    if (this.compareOn) return this.comparePreset();
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
    window.addEventListener('keyup', this.onKeyUp);

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
    this.store.on('thrust', (on) => {
      this.modes?.setThrust(on);
      this.audio.setThrust(on);
    });
    // Sound follows the chip. A click is a user gesture, so starting the
    // audio context from inside this listener is allowed.
    this.store.on('sound', (on) => {
      session.set('sound', on ? '1' : '0');
      if (!on) this.audio.stop();
      else if (navigator.userActivation?.hasBeenActive ?? true) this.audio.start();
    });
    // Sound chosen earlier in the session: the store says on, but browsers
    // still need a gesture on this page before audio may play, so the engine
    // starts with the visitor's first click or key.
    if (session.get('sound') === '1') {
      this.store.set('sound', true);
      const unlock = () => {
        window.removeEventListener('pointerdown', unlock, true);
        window.removeEventListener('keydown', unlock, true);
        if (this.store.get('sound')) this.audio.start();
      };
      window.addEventListener('pointerdown', unlock, true);
      window.addEventListener('keydown', unlock, true);
    }
    // A quiet tick under every toolbar press.
    document.querySelector('[data-mount="toolbar"]')?.addEventListener('click', (e) => {
      if ((e.target as Element).closest('button')) this.audio.tick();
    });
    if (__REVIEW__) (window as unknown as { __audio: JetAudio }).__audio = this.audio;
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
    this.endFlyby();
    if (this.compareOn && source !== 'scroll') this.exitCompare(c === this.config);
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
      this.enterCompare();
    } else {
      // Leaving the hangar restyles the whole chrome; the next aircraft's
      // placard and notes rebuild it again. Done in one frame that was a 64 ms
      // stall on a throttled phone, so the second half waits a task.
      const leaving = this.compareOn;
      const id = hasJets(n) ? (this.remembered.get(n) ?? firstOf(n).id) : firstOf(n).id;
      // The stowed airframe comes back only if it is the one this chapter
      // shows. Otherwise it is replaced at once, and bringing it back first
      // would mean uploading a model -- possibly never drawn -- to throw away.
      if (leaving) this.exitCompare(id === this.config.id);
      const go = () => {
        if (this.chapter !== n) return;
        if (id !== this.config.id) this.navigate(id, 'scroll');
        else if (changed && !leaving) this.resetView();
        this.ribbon?.setCurrent(this.config.id, n);
      };
      if (leaving) window.setTimeout(go, 0);
      else go();
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
      const title = rect(this.compareOn ? '.compare-head' : '.chrome__main');
      const inner = rect('.chapter__inner');
      const right = Math.max(title?.right ?? 0, inner ? inner.left + inner.width : 0) + 24;
      setMorphBounds(nx(right), 9, yMin, yMax);
      // The note cards run further right than the title, along the bottom.
      const notes = rect(this.compareOn ? '.compare-stats' : '.chrome__notes');
      if (notes && notes.width > 0) setMorphAvoid(nx(notes.right + 16), ny(notes.top - 12));
      else setMorphAvoid(-9, -9);
    } else {
      setMorphAvoid(-9, -9);
      const title = rect(this.compareOn ? '.compare-head' : '.chrome__main');
      const notes = rect(this.compareOn ? '.compare-stats' : '.chrome__notes');
      setMorphBounds(-9, 9, notes ? ny(notes.top - 8) : yMin, title ? ny(title.bottom + 8) : yMax);
    }
  }

  /**
   * The loader's choice. Runs inside the button's click, which is the user
   * gesture the browser needs before audio may start.
   */
  enter(sound: boolean): void {
    session.set('entered', '1');
    this.store.set('sound', sound);
  }

  private setupCompare(): void {
    const root = this.chrome?.root;
    if (!root) return;
    this.compare = new CompareScene(this.cache, {
      reduced: () => this.reduced,
      density: () => this.density(),
      onLeave: () => this.audio.whoosh(),
    });
    this.pivot.add(this.compare.group);
    this.comparePanel = new ComparePanel(root, (a, b) => this.setPair(a, b));
    this.vapour = new VapourCone(this.pivot);
    this.setupLongPress(root.querySelector<HTMLElement>('.inspect'));
    for (const slot of ['a', 'b']) {
      const el = document.createElement('span');
      el.className = `compare-label compare-label--${slot}`;
      el.setAttribute('aria-hidden', 'true');
      el.hidden = true;
      root.appendChild(el);
      this.compareLabels.push(el);
    }
  }

  /**
   * The phone way to the easter egg: hold the gizmo. The click that would
   * follow the hold -- and toggle free orbit -- is swallowed.
   */
  private setupLongPress(g: HTMLElement | null): void {
    if (!g) return;
    let timer = 0;
    const cancel = () => {
      window.clearTimeout(timer);
      timer = 0;
    };
    g.addEventListener('pointerdown', () => {
      cancel();
      timer = window.setTimeout(() => {
        timer = 0;
        this.swallowClick = true;
        this.flyby();
      }, 600);
    });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) g.addEventListener(ev, cancel);
    g.addEventListener(
      'click',
      (e) => {
        if (!this.swallowClick) return;
        this.swallowClick = false;
        e.stopImmediatePropagation();
        e.preventDefault();
      },
      true,
    );
    g.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /**
   * The easter egg: full afterburner, a pass across the screen with a vapour
   * cone, and a boom if sound is on. The jet turns to face screen-right,
   * accelerates out of frame, comes back flat out from the left a little
   * closer, and then re-forms on the turntable out of its voxel cloud. With
   * reduced motion it is a calm, slower pass: no shake, no boom.
   */
  private flyby(): void {
    const model = this.model;
    const vapour = this.vapour;
    if (this.flying || !model || !vapour || this.compareOn || !this.chrome) return;
    if (this.store.get('orbit') || this.store.get('radar')) return;
    if (this.store.get('mode') !== 'overview') this.store.set('mode', 'overview');
    this.flying = true;
    this.idle = false;
    const reduced = this.reduced;
    const cam = this.stage.camera;
    const dist = cam.position.length();
    const vFov = (cam.fov * Math.PI) / 180;
    const halfW = dist * Math.tan(vFov / 2) * cam.aspect;
    const right = new Vector3().setFromMatrixColumn(cam.matrixWorld, 0).setY(0).normalize();
    const near = cam.position.clone().setY(0).normalize().multiplyScalar(dist * 0.2);
    const yaw = Math.atan2(right.x, right.z);
    const size = model.size;
    vapour.setShape(size.z, size.x);
    const p = this.pivot;
    const at = (k: number, y: number, n = 0) => ({ x: right.x * halfW * k + near.x * n, y, z: right.z * halfW * k + near.z * n });

    this.store.set('thrust', true);
    const tl = gsap.timeline();
    this.flyTl = tl;
    tl.to(p.rotation, { y: yaw, x: 0, z: 0, duration: reduced ? 0.7 : 0.45, ease: 'power2.inOut' });
    if (!reduced) {
      // Out of frame to the right, accelerating hard.
      tl.to(p.position, { ...at(1.75, 0.5), duration: 0.75, ease: 'power3.in' });
      // The pass: in from the left, nearer the camera, slightly banked.
      tl.set(p.position, at(-1.85, 1.1, 1));
      tl.set(p.rotation, { z: -0.12 });
      tl.addLabel('pass');
      tl.to(p.position, { ...at(1.85, 0.3, 1), duration: 1.05, ease: 'none' }, 'pass');
      tl.to(vapour, { level: 1, duration: 0.28, ease: 'power2.out' }, 'pass+=0.26');
      tl.call(
        () => {
          this.audio.boom();
          this.rig.setShake(2.4);
        },
        [],
        'pass+=0.44',
      );
      tl.call(() => this.rig.setShake(this.store.get('thrust') ? 1 : 0), [], 'pass+=0.8');
      tl.to(vapour, { level: 0, duration: 0.3 }, 'pass+=0.72');
      tl.addLabel('home', 'pass+=1.1');
    } else {
      // Calm: fade out, cross slowly with a light cone, fade out again.
      const f = { v: 1 };
      tl.to(f, { v: 0, duration: 0.35, onUpdate: () => model.setFade(f.v) });
      tl.set(p.position, at(-1.6, 0.6, 0.5));
      tl.to(f, { v: 1, duration: 0.35, onUpdate: () => model.setFade(f.v) });
      tl.addLabel('pass', '<');
      tl.to(p.position, { ...at(1.6, 0.6, 0.5), duration: 3.2, ease: 'sine.inOut' }, 'pass');
      tl.to(vapour, { level: 0.45, duration: 0.8 }, 'pass+=0.9');
      tl.to(vapour, { level: 0, duration: 0.8 }, 'pass+=1.9');
      tl.to(f, { v: 0, duration: 0.35, onUpdate: () => model.setFade(f.v) }, 'pass+=2.85');
      tl.addLabel('home', 'pass+=3.25');
    }
    tl.call(() => this.landFlyby(model), [], 'home');
  }

  /** Back on the turntable: the airframe re-forms where it started. */
  private landFlyby(model: VoxelModel): void {
    this.endFlyby();
    if (this.model !== model) return;
    if (this.reduced) {
      const f = { v: 0 };
      model.setFade(0);
      gsap.to(f, { v: 1, duration: 0.5, onUpdate: () => model.setFade(f.v) });
    } else {
      model.setMorph(1.3);
      gsap.to(model.uniforms.uMorph, { value: 0, duration: 1.1, ease: 'power3.out', onComplete: () => this.applyCover() });
    }
  }

  /** Stops a flyby where it is and puts the turntable back. */
  private endFlyby(): void {
    if (!this.flying) return;
    this.flyTl?.kill();
    this.flyTl = null;
    this.flying = false;
    this.pivot.position.set(0, 0, 0);
    this.pivot.rotation.set(0, this.spin, 0);
    if (this.vapour) this.vapour.level = 0;
    this.model?.setFade(1);
    this.store.set('thrust', false);
    this.idle = this.store.get('mode') === 'overview' && !this.store.get('orbit') && !this.reduced;
  }

  /** Build density: pinned by the address, or the current adaptive rung. */
  private density(): number {
    return this.pinnedDensity || LADDER[this.rung];
  }

  /**
   * Adaptive quality. A frame interval averaging over SLOW_FRAME_MS for two
   * seconds steps the exhibit down a rung, crossfaded so nothing pops. Never
   * steps back up: a device that struggled once will struggle again, and
   * see-sawing between rungs would be worse than either.
   */
  private watchFrameRate(now: number, ms: number): void {
    if (this.pinnedDensity || this.rung >= LADDER.length - 1) return;
    // A hidden tab, or a long pause, is not a slow frame.
    if (document.hidden || ms > 250) return;
    this.avgFrame += (ms - this.avgFrame) * 0.08;
    if (now < this.calmUntil) {
      this.slowMs = 0;
      return;
    }
    this.slowMs = this.avgFrame > SLOW_FRAME_MS ? this.slowMs + ms : Math.max(0, this.slowMs - ms * 2);
    if (this.slowMs < SLOW_HOLD_MS) return;
    // A rebuild mid-mode or mid-flyby would cut across what the visitor is
    // looking at; wait for the overview.
    if (this.flying || this.store.get('radar') || (!this.compareOn && this.store.get('mode') !== 'overview')) return;
    this.slowMs = 0;
    this.calmUntil = now + 4000;
    this.stepDown();
  }

  private stepDown(): void {
    this.rung++;
    this.qualitySteps++;
    if (this.qualitySteps === 1) {
      const g = { v: this.stage.grain };
      gsap.to(g, { v: 0, duration: 1.2, onUpdate: () => this.stage.setGrain(g.v) });
    }
    if (this.qualitySteps === 2) this.stage.setSamples(0);
    if (this.qualitySteps === 3) this.stage.setMaxPixelRatio(1);
    if (import.meta.env.DEV) console.info(`[lab] quality: density ${LADDER[this.rung]}, step ${this.qualitySteps}`);
    if (this.compareOn) void this.showPair();
    else void this.present(this.config, 'quality', { keepChrome: true });
  }

  private compareLayout(): CompareLayout {
    return window.innerWidth < 760 ? PHONE_COMPARE : 'side';
  }

  /**
   * Into the hangar: the single airframe scatters away (kept, not thrown out,
   * for the way back) and the pair gathers on the turntable.
   */
  private enterCompare(): void {
    const scene = this.compare;
    if (!scene || this.compareOn) return;
    this.endFlyby();
    this.compareOn = true;
    this.resetView();
    this.modes?.setSuppressed(true);
    this.chrome?.setCompare(true);
    this.stow();
    scene.setLayout(this.compareLayout());
    void this.showPair();
  }

  /**
   * Out of the hangar. `restore` brings the stowed airframe back; a move
   * straight to another aircraft skips that, as its own morph replaces it.
   */
  private exitCompare(restore: boolean): void {
    if (!this.compareOn) return;
    this.compareOn = false;
    this.compare?.hide();
    for (const l of this.compareLabels) l.hidden = true;
    this.chrome?.setCompare(false);
    this.modes?.setSuppressed(false);
    if (this.model) this.chrome?.setBlocks(this.model.info.surfaceVoxels);
    if (restore) this.unstow();
    this.audio.setVoice(voiceFor(this.config));
    this.modes?.reframe(1.2);
    this.scheduleMorphBounds();
  }

  private async showPair(): Promise<void> {
    const scene = this.compare;
    const [ia, ib] = this.comparePair;
    const a = byId(ia);
    const b = byId(ib);
    if (!scene || !a || !b) return;
    this.comparePanel?.show(a, b);
    this.audio.setVoice(voiceFor(a));
    await scene.show(a, b);
    if (!this.compareOn) return;
    this.chrome?.setBlocks(scene.blocks);
    this.idle = !this.reduced;
    this.rig.setParallax(false);
    this.rig.apply(this.comparePreset(), 1.2);
    this.scheduleMorphBounds();
  }

  /** A new pair from the pickers or a suggestion chip. */
  private setPair(a: string, b: string, source: 'pick' | 'history' = 'pick'): void {
    if (a === b || (a === this.comparePair[0] && b === this.comparePair[1])) return;
    this.comparePair = [a, b];
    if (this.compareOn) void this.showPair();
    if (source !== 'history') this.scheduleHistory();
  }

  /** The single airframe leaves for the hangar, but stays built. */
  private stow(): void {
    const model = this.model;
    const shade = this.shadow?.material as MeshBasicMaterial | undefined;
    if (!model) return;
    this.audio.whoosh();
    gsap.killTweensOf(model.uniforms.uMorph);
    if (shade) gsap.to(shade, { opacity: 0, duration: 0.45 });
    const hide = () => {
      if (this.compareOn && this.model === model) model.group.visible = false;
    };
    if (this.reduced) {
      const f = { v: model.uniforms.uFade.value };
      gsap.to(f, { v: 0, duration: 0.4, onUpdate: () => model.setFade(f.v), onComplete: hide });
    } else {
      gsap.to(model.uniforms.uMorph, { value: 1.3, duration: 0.8, ease: 'power2.in', onComplete: hide });
    }
  }

  private unstow(): void {
    const model = this.model;
    const shade = this.shadow?.material as MeshBasicMaterial | undefined;
    if (!model) return;
    model.group.visible = true;
    gsap.killTweensOf(model.uniforms.uMorph);
    if (shade) gsap.to(shade, { opacity: 1, duration: 0.8, delay: 0.4 });
    if (this.reduced) {
      const f = { v: model.uniforms.uFade.value };
      gsap.to(f, { v: 1, duration: 0.5, delay: 0.15, onUpdate: () => model.setFade(f.v) });
    } else {
      gsap.to(model.uniforms.uMorph, { value: 0, duration: 1.15, delay: 0.28, ease: 'power3.out', onComplete: () => this.applyCover() });
    }
  }

  /**
   * Fits the pair into the part of the screen the compare panels leave free,
   * from a direction that suits the layout, allowing for the turntable's
   * sway so neither aircraft swings out of frame.
   */
  private comparePreset(): CameraPreset {
    const scene = this.compare;
    const W = window.innerWidth || 1;
    const H = window.innerHeight || 1;
    const rect = (sel: string): DOMRect | null => document.querySelector(sel)?.getBoundingClientRect() ?? null;
    const head = rect('.compare-head');
    const stats = rect('.compare-stats');
    const top = rect('.chrome__top');
    const tools = rect('.chrome__tools');
    const wide = W >= 760 && W / H > 1.25;
    let l = 24;
    let r = W - 24;
    let t = (top?.bottom ?? 80) + 8;
    let b = (tools?.top ?? H - 120) - 8;
    if (wide) l = Math.max(head?.right ?? 0, stats?.right ?? 0) + 32;
    else {
      t = (head?.bottom ?? t) + 8;
      b = Math.min(b, (stats?.top ?? b) - 8);
    }
    const stack = scene?.layout === 'stack';
    const size = (scene?.size ?? new Vector3(20, 5, 20)).clone();
    // Widen the box for the sway: the pair turns up to SWAY either way.
    const sway = this.reduced ? 0 : wide ? COMPARE_SWAY : COMPARE_SWAY * 0.4;
    const c = Math.cos(sway);
    const sn = Math.sin(sway);
    const sx = size.x * c + size.z * sn;
    const sz = size.x * sn + size.z * c;
    size.set(sx, size.y, sz);
    const dir = (stack ? new Vector3(0.18, 1.15, 0.72) : new Vector3(0.42, 0.36, 1)).normalize();
    const fov = 30;
    const aspect = W / H;
    const vFovFull = (fov * Math.PI) / 180;
    const hFovFull = 2 * Math.atan(Math.tan(vFovFull / 2) * aspect);
    const hFov = 2 * Math.atan(Math.tan(hFovFull / 2) * Math.max(0.2, (r - l) / W));
    const vFov = 2 * Math.atan(Math.tan(vFovFull / 2) * Math.max(0.2, (b - t) / H));
    const dist = fitDistance(size, dir, undefined, hFov, vFov) * 1.06;
    // Put the pair's centre on the centre of the free area.
    const cx = ((l + r) / 2 / W) * 2 - 1;
    const cy = 1 - ((t + b) / 2 / H) * 2;
    const forward = dir.clone().negate();
    const right = new Vector3().crossVectors(forward, new Vector3(0, 1, 0)).normalize();
    const camUp = new Vector3().crossVectors(right, forward).normalize();
    const target = right
      .multiplyScalar(-cx * dist * Math.tan(hFovFull / 2))
      .add(camUp.multiplyScalar(-cy * dist * Math.tan(vFovFull / 2)));
    const pos = dir.clone().multiplyScalar(dist).add(target);
    return { position: [pos.x, pos.y, pos.z], target: [target.x, target.y, target.z], fov };
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
    if (this.chapter === 8) return { ch: 8, id: null, pair: this.comparePair };
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
    const route: Route = parseRoute(location.hash) ?? { ch: 0, id: null };
    if (route.ch === 8) {
      if (route.pair) this.setPair(route.pair[0], route.pair[1], 'history');
      if (this.chapter !== 8) this.chapters?.jumpTo(8, 'exhibit');
      return;
    }
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
      density: this.density(),
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
      // Next door to Compare: build the pair it will open on.
      const pa = byId(this.comparePair[0]);
      const pb = byId(this.comparePair[1]);
      if (c.chapter === 7 && pa && pb) void this.compare?.prefetch(pa, pb);
    }, 1300);
  }

  /** Plan-view masks for the ribbon, one at a time behind the real builds. */
  private async buildSilhouettes(): Promise<void> {
    if (!this.ribbon) return;
    let n = 0;
    for (const c of AIRCRAFT) {
      try {
        this.ribbon.setMask(await buildClient.silhouette(c));
      } catch {
        // An icon that fails to build stays blank; the name is still there.
      }
      this.onProgress('masks', ++n / AIRCRAFT.length);
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
      if (this.compareOn && this.compare) {
        this.compare.setLayout(this.compareLayout());
        this.rig.apply(this.comparePreset(), 0.6);
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

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    if (e.code !== 'Space' || !this.spaceTimer) return;
    const tapped = this.spaceTimer > 0;
    window.clearTimeout(this.spaceTimer);
    this.spaceTimer = 0;
    if (tapped) {
      // What Space would have done had we not held on to it: page down, or
      // up with Shift.
      window.scrollBy({ top: (this.spaceShift ? -1 : 1) * window.innerHeight * 0.85, behavior: this.reduced ? 'auto' : 'smooth' });
    }
  };

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // A focused slider or field owns its keys: the arrows move the wing
    // sweep, not the exhibit.
    if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    // The frame-time readout is a review tool; production has no debug keys.
    if (__REVIEW__ && (e.key === 'f' || e.key === 'F')) this.stats.toggle();
    if (!this.chrome) return;
    if (e.code === 'Space') {
      // Space on a control is that control's: a button presses, a slider moves.
      if (e.target instanceof Element && e.target.closest('button, a, [role="slider"], [role="option"]')) return;
      // Held, it is the easter egg; tapped, it pages down as usual (on keyup).
      e.preventDefault();
      if (e.repeat || this.spaceTimer) return;
      this.spaceShift = e.shiftKey;
      this.spaceTimer = window.setTimeout(() => {
        this.spaceTimer = -1;
        this.flyby();
      }, 380);
      return;
    }
    if (e.key === 'Escape') {
      this.store.set('orbit', false);
      this.store.set('radar', false);
      this.store.set('mode', 'overview');
      this.modes?.reframe(1.2);
      return;
    }
    const n = Number(e.key);
    if (!this.compareOn && Number.isInteger(n) && n >= 1 && n <= MODES.length) {
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
    if (how === 'initial') {
      // The first draw of the voxel materials compiles their shaders: over a
      // second of blocked main thread on a slow phone. Compile them first,
      // in parallel where the browser can, with the model in the scene but
      // hidden. Every later airframe reuses the same programs.
      model.group.visible = false;
      this.pivot.add(model.group);
      try {
        await this.stage.renderer.compileAsync(this.stage.scene, this.stage.camera);
      } catch {
        // Compiling on first draw instead is slower, not broken.
      }
      model.group.visible = true;
      if (token !== this.loadToken) {
        model.group.removeFromParent();
        model.dispose();
        return;
      }
    }
    this.pivot.add(model.group, shadow);
    this.model = model;
    this.shadow = shadow;
    this.voxelsPerMetre = 1 / data.voxelSize;
    this.modes?.attach(model, config, data);
    this.audio.setVoice(voiceFor(config));

    if (prev) this.retire(prev, how);
    this.arrive(model, shadow, how);
    if (how !== 'cut' && how !== 'quality') {
      this.modes?.reframe(how === 'initial' ? 0.9 : 1.2);
      this.prefetchAround(config);
    }
    this.calmUntil = Math.max(this.calmUntil, performance.now() + 2500);
    this.stats.task(`present ${config.id}`, performance.now() - t0);
    if (how === 'initial') this.onProgress('build', 1);
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
    // A build that lands while the hangar is up arrives already stowed.
    if (this.compareOn) {
      model.setMorph(1.3);
      model.group.visible = false;
      shade.opacity = 0;
      return;
    }
    if (how === 'fade' || how === 'quality' || (how === 'initial' && this.reduced)) {
      const fade = { v: 0 };
      model.setFade(0);
      shade.opacity = 0;
      gsap.to(fade, { v: 1, duration: how === 'quality' ? 0.9 : 0.5, delay: 0.15, ease: 'power2.out', onUpdate: () => model.setFade(fade.v) });
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
    // Stowed for the hangar -- hidden and already scattered or faded out --
    // there is nothing left to animate, and showing it again would upload a
    // model only to throw it away. (Hidden alone is not enough: cockpit mode
    // hides the airframe under its section, and that one should scatter.)
    const stowed = !model.group.visible && (model.morph >= 1.29 || model.uniforms.uFade.value <= 0.01);
    if (how === 'cut') {
      this.drop(prev);
      return;
    }
    if (stowed) {
      // Freeing it is not free either; do it once the transition is over.
      this.leaving.push(prev);
      window.setTimeout(() => this.drop(prev), 1500);
      return;
    }
    // Whatever mode left it in -- hidden under a cockpit section, exploded,
    // doors open -- it leaves as the plain airframe; the scatter hides the snap.
    model.partState.reset();
    model.setExplode(1);
    model.group.visible = true;
    gsap.killTweensOf(model.uniforms.uMorph);
    this.leaving.push(prev);
    if (how !== 'quality') this.audio.whoosh();
    // Two on the way out is plenty; a third means the visitor is racing.
    while (this.leaving.length > 2) this.drop(this.leaving[0]);

    gsap.to(shadow.material as MeshBasicMaterial, { opacity: 0, duration: 0.45 });
    if (how === 'fade' || how === 'quality' || this.reduced) {
      const fade = { v: model.uniforms.uFade.value };
      gsap.to(fade, {
        v: 0,
        duration: how === 'quality' ? 0.9 : 0.4,
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
    const rawMs = now - this.lastTime;
    const dt = Math.min(0.05, rawMs / 1000);
    this.lastTime = now;
    if (this.chrome) this.watchFrameRate(now, rawMs);
    const t = now / 1000;

    this.clouds.update(t);

    if (this.compareOn && this.idle && !this.reduced && !this.store.get('orbit')) {
      // The hangar turntable sways rather than spins: a full turn would put
      // one aircraft behind the other half the time.
      const amp = window.innerWidth >= 760 ? COMPARE_SWAY : COMPARE_SWAY * 0.4;
      this.spin = Math.sin(t * 0.32) * amp;
      this.pivot.rotation.y = this.spin;
      this.pivot.position.y *= 0.95;
      this.pivot.rotation.x *= 0.95;
      this.pivot.rotation.z *= 0.95;
    } else if (this.idle && !this.reduced) {
      this.spin += dt * 0.12;
      this.pivot.rotation.y = this.spin;
      // Gentle bob and roll, as if trimmed out in level flight.
      this.pivot.position.y = Math.sin(t * 0.55) * 0.13;
      this.pivot.rotation.z = Math.sin(t * 0.37) * 0.018;
      this.pivot.rotation.x = Math.sin(t * 0.29) * 0.012;
    } else if (this.chrome && !this.store.get('orbit') && !this.flying) {
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
    this.vapour?.update(dt);
    if (this.radar) {
      const { width, height } = this.stage.size;
      this.radar.update(dt, this.stage.camera, width, height);
    }
    this.rig.update(dt);
    this.stats.beginGpu();
    this.stage.render(t);
    this.stats.endGpu();
    this.chrome?.update(this.stage.camera, this.pivot);
    if (this.compareOn && this.compare) this.placeCompareLabels();

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

  /** "A" and "B" tags under each aircraft, so the bars can be matched to them. */
  private placeCompareLabels(): void {
    const scene = this.compare;
    const pair = scene?.pair;
    if (!scene || !pair) return;
    const { width, height } = this.stage.size;
    const v = new Vector3();
    scene.anchors().forEach((a, i) => {
      const el = this.compareLabels[i];
      if (!el) return;
      v.copy(a);
      scene.group.localToWorld(v);
      v.project(this.stage.camera);
      el.hidden = v.z > 1;
      el.textContent = `${i === 0 ? 'A' : 'B'} · ${pair[i].designation}`;
      const centred = scene.layout === 'side' ? ' translateX(-50%)' : '';
      el.style.transform = `translate(${((v.x * 0.5 + 0.5) * width).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * height).toFixed(1)}px)${centred}`;
    });
  }

  dispose(): void {
    this.compare?.dispose();
    this.endFlyby();
    this.vapour?.dispose();
    this.running = false;
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('popstate', this.onPopState);
    this.chapters?.dispose();
    this.audio.dispose();
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
