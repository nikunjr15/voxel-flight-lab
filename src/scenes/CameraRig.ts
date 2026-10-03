import { PerspectiveCamera, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import gsap from 'gsap';

export interface CameraPreset {
  position: [number, number, number];
  target: [number, number, number];
  fov?: number;
  /**
   * Overrides the camera's up vector. Needed for a straight-down plan view:
   * with the default +Y up parallel to the view direction, the roll is
   * undefined and the scene lands at an arbitrary angle.
   */
  up?: [number, number, number];
}

export interface RigOptions {
  camera: PerspectiveCamera;
  domElement: HTMLElement;
  reducedMotion?: boolean;
}

/**
 * Owns the single camera. Presets are tweened rather than cut, and orbit is a
 * mode the rig hands control to, so returning to a preset is always possible.
 */
export class CameraRig {
  readonly camera: PerspectiveCamera;
  readonly controls: OrbitControls;

  private readonly target = new Vector3();
  /** Where the camera would sit with no parallax; tweens write here. */
  private readonly base = new Vector3();
  private readonly parallaxTarget = new Vector3();
  private readonly parallaxCurrent = new Vector3();
  private parallaxStrength = 0.9;
  private orbit = false;
  private parallaxOn = true;
  private reducedMotion: boolean;
  private tween: gsap.core.Tween | null = null;
  private shakeTarget = 0;
  private shakeCurrent = 0;
  private shakeTime = 0;

  constructor({ camera, domElement, reducedMotion = false }: RigOptions) {
    this.camera = camera;
    this.reducedMotion = reducedMotion;
    this.controls = new OrbitControls(camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.enablePan = false;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 70;
    this.controls.minPolarAngle = 0.22;
    this.controls.maxPolarAngle = Math.PI - 0.22;
    this.controls.rotateSpeed = 0.75;
    this.controls.zoomSpeed = 0.7;
    this.controls.enabled = false;
    // OrbitControls claims every touch on the canvas. Until free orbit is on,
    // vertical swipes belong to the page, which is how the chapters scroll.
    this.canvas = domElement;
    this.canvas.style.touchAction = '';
  }

  private readonly canvas: HTMLElement;

  get orbitEnabled(): boolean {
    return this.orbit;
  }

  setOrbit(enabled: boolean): void {
    this.orbit = enabled;
    this.controls.enabled = enabled;
    this.canvas.style.touchAction = enabled ? 'none' : '';
    if (enabled) {
      this.controls.target.copy(this.target);
      this.controls.update();
    }
  }

  /** Review views frame content exactly; parallax would nudge it off centre. */
  setParallax(enabled: boolean): void {
    this.parallaxOn = enabled;
    if (!enabled) this.parallaxTarget.set(0, 0, 0);
  }

  setReducedMotion(v: boolean): void {
    this.reducedMotion = v;
    if (v) {
      this.parallaxStrength = 0;
      this.shakeTarget = 0;
    }
  }

  /**
   * Glides to a preset. Expo easing so it settles rather than stops. The up
   * vector glides too: set at the start, a plan-to-hero move would roll the
   * whole view in one frame before the camera had moved at all.
   */
  apply(preset: CameraPreset, duration = 1.5): void {
    this.tween?.kill();
    const [ux, uy, uz] = preset.up ?? [0, 1, 0];
    const [tx, ty, tz] = preset.target;
    const [px, py, pz] = preset.position;
    const d = this.reducedMotion ? 0.001 : duration;

    const state = {
      px: this.base.x,
      py: this.base.y,
      pz: this.base.z,
      tx: this.target.x,
      ty: this.target.y,
      tz: this.target.z,
      fov: this.camera.fov,
      ux: this.camera.up.x,
      uy: this.camera.up.y,
      uz: this.camera.up.z,
    };

    this.tween = gsap.to(state, {
      ux,
      uy,
      uz,
      px,
      py,
      pz,
      tx,
      ty,
      tz,
      fov: preset.fov ?? this.camera.fov,
      duration: d,
      ease: 'expo.out',
      onUpdate: () => {
        this.base.set(state.px, state.py, state.pz);
        this.target.set(state.tx, state.ty, state.tz);
        this.camera.up.set(state.ux, state.uy, state.uz).normalize();
        if (this.camera.fov !== state.fov) {
          this.camera.fov = state.fov;
          this.camera.updateProjectionMatrix();
        }
        this.controls.target.copy(this.target);
      },
    });
  }

  /** Snaps without animating, used on first frame and on resize recovery. */
  set(preset: CameraPreset): void {
    this.tween?.kill();
    this.base.set(...preset.position);
    this.camera.position.copy(this.base);
    this.target.set(...preset.target);
    this.controls.target.copy(this.target);
    this.camera.up.set(...(preset.up ?? [0, 1, 0]));
    if (preset.fov) {
      this.camera.fov = preset.fov;
      this.camera.updateProjectionMatrix();
    }
    this.camera.lookAt(this.target);
  }

  /** Pointer position in -1..1. Ignored while orbiting or in reduced motion. */
  setPointer(x: number, y: number): void {
    if (this.orbit || this.reducedMotion || !this.parallaxOn) {
      this.parallaxTarget.set(0, 0, 0);
      return;
    }
    this.parallaxTarget.set(x * this.parallaxStrength, -y * this.parallaxStrength * 0.6, 0);
  }

  /** Light camera shake, 0 to 1. Always zero under reduced motion. */
  setShake(amount: number): void {
    this.shakeTarget = this.reducedMotion ? 0 : amount;
  }

  update(dt: number): void {
    this.shakeTime += dt;
    this.shakeCurrent += (this.shakeTarget - this.shakeCurrent) * (1 - Math.exp(-dt * 4));
    if (this.orbit) {
      this.controls.update();
      this.target.copy(this.controls.target);
      this.base.copy(this.camera.position);
      return;
    }
    const k = 1 - Math.exp(-dt * 3.2);
    this.parallaxCurrent.lerp(this.parallaxTarget, k);
    this.camera.position.copy(this.base);
    this.camera.position.x += this.parallaxCurrent.x;
    this.camera.position.y += this.parallaxCurrent.y;
    if (this.shakeCurrent > 1e-3) {
      // Sums of incommensurate sines: smooth, never quite repeating, and
      // small -- a rumble rather than a jolt.
      const t = this.shakeTime;
      const a = this.shakeCurrent * 0.05;
      this.camera.position.x += a * (Math.sin(t * 31.7) + 0.6 * Math.sin(t * 57.3));
      this.camera.position.y += a * (Math.sin(t * 27.1 + 1.3) + 0.5 * Math.sin(t * 61.9));
    }
    this.camera.lookAt(this.target);
  }

  dispose(): void {
    this.tween?.kill();
    this.controls.dispose();
  }
}
