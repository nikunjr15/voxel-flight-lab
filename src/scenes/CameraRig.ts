import { PerspectiveCamera, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import gsap from 'gsap';

export interface CameraPreset {
  position: [number, number, number];
  target: [number, number, number];
  fov?: number;
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
  private reducedMotion: boolean;
  private tween: gsap.core.Tween | null = null;

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
  }

  get orbitEnabled(): boolean {
    return this.orbit;
  }

  setOrbit(enabled: boolean): void {
    this.orbit = enabled;
    this.controls.enabled = enabled;
    if (enabled) {
      this.controls.target.copy(this.target);
      this.controls.update();
    }
  }

  setReducedMotion(v: boolean): void {
    this.reducedMotion = v;
    if (v) this.parallaxStrength = 0;
  }

  /** Glides to a preset. Expo easing so it settles rather than stops. */
  apply(preset: CameraPreset, duration = 1.5): void {
    this.tween?.kill();
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
    };

    this.tween = gsap.to(state, {
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
    if (preset.fov) {
      this.camera.fov = preset.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  /** Pointer position in -1..1. Ignored while orbiting or in reduced motion. */
  setPointer(x: number, y: number): void {
    if (this.orbit || this.reducedMotion) {
      this.parallaxTarget.set(0, 0, 0);
      return;
    }
    this.parallaxTarget.set(x * this.parallaxStrength, -y * this.parallaxStrength * 0.6, 0);
  }

  update(dt: number): void {
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
    this.camera.lookAt(this.target);
  }

  dispose(): void {
    this.tween?.kill();
    this.controls.dispose();
  }
}
