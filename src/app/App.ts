import { Group, Mesh, Vector3 } from 'three';
import { Stage } from '../engine/renderer/Renderer';
import { setupLighting, LightingHandles } from '../engine/renderer/Lighting';
import { createContactShadow } from '../engine/renderer/ContactShadow';
import { BackdropClouds } from '../engine/renderer/BackdropClouds';
import { assemble } from '../engine/build/assemble';
import { VoxelModel } from '../engine/voxel/VoxelModel';
import { PARTS } from '../engine/voxel/parts';
import { CameraRig, CameraPreset } from '../scenes/CameraRig';
import { AIRCRAFT } from '../aircraft';
import type { AircraftConfig } from '../aircraft/types';
import { COUNTRIES } from '../aircraft/countries';
import { DevStats } from '../ui/devstats';

/** Direction the hero shot looks from: three-quarter, slightly above. */
const HERO_DIR = new Vector3(0.52, 0.3, 1).normalize();
const HERO_FOV = 31;

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

  private model: VoxelModel | null = null;
  private shadow: Mesh | null = null;
  private config: AircraftConfig;
  private reduced = prefersReducedMotion();
  private idle = true;
  private spin = 0;
  private lastTime = 0;
  private running = false;

  constructor(canvas: HTMLCanvasElement) {
    this.stage = new Stage({ canvas, background: '#e9eced', maxPixelRatio: 2 });
    this.lighting = setupLighting(this.stage.scene, this.stage.renderer);
    this.stage.scene.add(this.clouds.mesh);
    this.stage.scene.add(this.pivot);

    this.rig = new CameraRig({
      camera: this.stage.camera,
      domElement: canvas,
      reducedMotion: this.reduced,
    });

    this.config = AIRCRAFT[0];
    this.resize();
    this.load(this.config);
    this.rig.set(this.heroPreset());

    this.bindEvents();
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
    // Raising the target drops the model on screen: on a narrow viewport that
    // clears the title above it and leaves the note cards below alone.
    target.y = wide ? 0 : visibleH * 0.14;

    return {
      position: [pos.x + target.x, pos.y + target.y, pos.z + target.z],
      target: [target.x, target.y, target.z],
      fov: HERO_FOV,
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

    const orbitToggle = document.querySelector<HTMLButtonElement>('[data-toggle="orbit"]');
    orbitToggle?.addEventListener('click', () => {
      const next = !this.rig.orbitEnabled;
      this.rig.setOrbit(next);
      orbitToggle.setAttribute('aria-pressed', String(next));
      orbitToggle.classList.toggle('is-on', next);
      this.idle = !next;
      if (!next) this.rig.apply(this.heroPreset(), 1.2);
    });
  }

  private reframeTimer = 0;

  private readonly resize = (): void => {
    this.stage.resize(window.innerWidth, window.innerHeight);
    // Re-fit after the resize settles, so a drag-resize does not retween
    // the camera on every frame.
    window.clearTimeout(this.reframeTimer);
    this.reframeTimer = window.setTimeout(() => {
      if (!this.rig.orbitEnabled) this.rig.apply(this.heroPreset(), 0.6);
    }, 160);
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    const x = (e.clientX / window.innerWidth) * 2 - 1;
    const y = (e.clientY / window.innerHeight) * 2 - 1;
    this.rig.setPointer(x, y);
  };

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'f' || e.key === 'F') this.stats.toggle();
    if (e.key === 'Escape') {
      this.rig.setOrbit(false);
      this.rig.apply(this.heroPreset(), 1.2);
      this.idle = true;
    }
  };

  /** Builds a config into instance buffers and swaps it onto the turntable. */
  load(config: AircraftConfig): void {
    this.config = config;
    this.model?.dispose();
    this.pivot.clear();

    const data = assemble(config, { density: densityForViewport() });
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
    this.updateChrome(data.total, data.buildMs);

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

  private updateChrome(voxels: number, buildMs: number): void {
    const c = this.config;
    const country = COUNTRIES[c.spec.country];
    const set = (sel: string, text: string) => {
      for (const el of document.querySelectorAll(sel)) el.textContent = text;
    };
    set('[data-field="name"]', c.name);
    set('[data-field="exhibit"]', c.exhibitNo);
    set('[data-field="category"]', c.copy.category);
    set('[data-field="country"]', country.name.toUpperCase());
    set('[data-field="blocks"]', `${voxels.toLocaleString('en-US')} BLOCKS`);
    set('[data-field="subtitle-a"]', c.copy.subtitle[0]);
    set('[data-field="subtitle-b"]', c.copy.subtitle[1]);

    const bar = document.querySelector<HTMLElement>('[data-field="colourbar"]');
    if (bar) {
      bar.innerHTML = '';
      for (const colour of country.bar) {
        const seg = document.createElement('span');
        seg.style.background = colour;
        bar.appendChild(seg);
      }
    }

    const notes = document.querySelector<HTMLElement>('[data-field="annotations"]');
    if (notes) {
      notes.innerHTML = '';
      for (const a of c.copy.annotations) {
        const card = document.createElement('article');
        card.className = 'note';
        const h = document.createElement('h3');
        h.innerHTML = `<span class="note__n">${a.n}</span> — ${a.title}`;
        const p = document.createElement('p');
        p.textContent = a.body;
        card.append(h, p);
        notes.appendChild(card);
      }
    }

    this.stats.setExtra(
      `${voxels.toLocaleString('en-US')} voxels · build ${buildMs.toFixed(0)} ms · ${
        this.model?.info.drawCalls ?? 0
      } draws`,
    );
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.frame);
  }

  private readonly frame = (now: number): void => {
    if (!this.running) return;
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
    }

    this.rig.update(dt);
    this.stage.render(t);
    this.stats.tick(now);
    requestAnimationFrame(this.frame);
  };

  dispose(): void {
    this.running = false;
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('keydown', this.onKeyDown);
    this.model?.dispose();
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
    look(preset: CameraPreset): void;
    setIdle(v: boolean): void;
  } {
    return {
      stage: this.stage,
      rig: this.rig,
      pivot: this.pivot,
      model: this.model,
      look: (preset) => this.rig.set(preset),
      setIdle: (v) => {
        this.idle = v;
        if (!v) this.pivot.rotation.set(0, 0, 0);
      },
    };
  }
}
