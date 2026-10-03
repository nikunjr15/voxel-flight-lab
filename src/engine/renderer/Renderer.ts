import {
  Color,
  LinearSRGBColorSpace,
  Mesh,
  NeutralToneMapping,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';

export interface StageOptions {
  canvas: HTMLCanvasElement;
  background?: string;
  maxPixelRatio?: number;
}

const GRAIN_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const GRAIN_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tDiffuse;
uniform vec2 uResolution;
uniform float uTime;
uniform float uGrain;
uniform float uVignette;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  vec3 col = texture2D(tDiffuse, vUv).rgb;

  // Radial vignette, kept gentle so the backdrop still reads as paper-white
  // and the chrome's text in the corners keeps its contrast.
  vec2 c = vUv - 0.5;
  c.x *= uResolution.x / uResolution.y;
  float d = length(c);
  col *= 1.0 - uVignette * smoothstep(0.35, 1.05, d);

  // Film grain on a per-frame offset so it never sits still.
  float n = hash(gl_FragCoord.xy + vec2(uTime * 37.0, uTime * 17.0));
  col += (n - 0.5) * uGrain;

  gl_FragColor = vec4(col, 1.0);
}
`;

/**
 * Scene render into an MSAA target, then one full-screen pass for grain and
 * vignette. Hand-rolled instead of EffectComposer: it is a single pass, and
 * this keeps the frame to two draws of overhead.
 */
export class Stage {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;

  private readonly target: WebGLRenderTarget;
  private readonly quadScene = new Scene();
  private readonly quadCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly quadMaterial: ShaderMaterial;
  private maxPixelRatio: number;
  private width = 1;
  private height = 1;

  constructor(opts: StageOptions) {
    this.maxPixelRatio = opts.maxPixelRatio ?? 2;
    this.renderer = new WebGLRenderer({
      canvas: opts.canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    // This pass writes the scene target's values to the screen as they are,
    // with no sRGB encoding: the palettes and lights are tuned to that output.
    // The backdrop is therefore given in output terms, so the canvas shows the
    // same #e9eced as the page around it rather than its linear value, which
    // reads as a mid grey and sets every scrim and panel apart from it.
    const backdrop = new Color().setStyle(opts.background ?? '#e9eced', LinearSRGBColorSpace);
    this.renderer.setClearColor(backdrop, 1);

    this.scene.background = backdrop;

    this.camera = new PerspectiveCamera(34, 1, 0.1, 400);
    this.camera.position.set(14, 7, 18);

    this.target = new WebGLRenderTarget(1, 1, { samples: 4, depthBuffer: true });
    this.target.texture.colorSpace = SRGBColorSpace;

    this.quadMaterial = new ShaderMaterial({
      vertexShader: GRAIN_VERT,
      fragmentShader: GRAIN_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tDiffuse: { value: this.target.texture },
        uResolution: { value: new Vector2(1, 1) },
        uTime: { value: 0 },
        uGrain: { value: 0.028 },
        uVignette: { value: 0.12 },
      },
    });
    this.quadScene.add(new Mesh(new PlaneGeometry(2, 2), this.quadMaterial));
  }

  setGrain(v: number): void {
    this.quadMaterial.uniforms.uGrain.value = v;
  }

  get grain(): number {
    return this.quadMaterial.uniforms.uGrain.value;
  }

  /** MSAA on the scene target: 4 samples, or 0 to save fill on a slow GPU. */
  setSamples(n: number): void {
    if (this.target.samples === n) return;
    this.target.samples = n;
    // Three rebuilds the target's buffers on next use after a dispose.
    this.target.dispose();
  }

  /** Lowers (or raises) the pixel-ratio cap and re-sizes to it. */
  setMaxPixelRatio(v: number): void {
    this.maxPixelRatio = v;
    this.resize(this.width, this.height);
  }

  resize(rawWidth: number, rawHeight: number): void {
    const width = Math.max(1, Math.floor(rawWidth));
    const height = Math.max(1, Math.floor(rawHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxPixelRatio);
    this.width = width;
    this.height = height;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.target.setSize(Math.round(width * dpr), Math.round(height * dpr));
    this.quadMaterial.uniforms.uResolution.value.set(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  get size(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  render(elapsed: number): void {
    // The pane can report a zero-size canvas on the first frames; drawing into
    // a zero-size attachment is a GL error, so wait for a real layout.
    if (this.width <= 1 || this.height <= 1) return;
    this.quadMaterial.uniforms.uTime.value = elapsed;
    this.renderer.setRenderTarget(this.target);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.quadScene, this.quadCamera);
  }

  dispose(): void {
    this.target.dispose();
    this.quadMaterial.dispose();
    this.renderer.dispose();
  }
}
