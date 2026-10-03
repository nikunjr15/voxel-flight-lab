import {
  Camera,
  Group,
  Mesh,
  NormalBlending,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  Vector4,
} from 'three';
import { byId, type AircraftConfig } from '../aircraft';
import { buildClient } from '../engine/build/client';
import { VoxelModel } from '../engine/voxel/VoxelModel';

const DEG = Math.PI / 180;
const MAX_SPIKES = 12;

interface Spike {
  dir: Vector3;
  /** Angular half-width, radians. */
  width: number;
  amp: number;
}

interface Signature {
  base: number;
  spikes: Spike[];
}

/** The fourth-generation shape every stealth jet is set beside. */
const REFERENCE_ID = 'f-15';

/**
 * Illustrative lobes for a shaped airframe, derived from its own planform:
 * a narrow spike normal to each leading and trailing edge, one per canted
 * fin, and almost nothing in between. Directions come from the model; the
 * heights are made up and say so on screen. No measured data is used.
 */
function stealthSignature(c: AircraftConfig): Signature {
  const w = c.geometry.wing;
  const L = w.sweep * DEG;
  const exposed = Math.max(0.5, w.span / 2 - (w.rootOffset ?? 0));
  const te = Math.atan2(exposed * Math.tan(L) + w.tipChord - w.rootChord, exposed);
  const spikes: Spike[] = [];
  for (const s of [1, -1]) {
    spikes.push({ dir: new Vector3(s * Math.sin(L), 0, Math.cos(L)), width: 7 * DEG, amp: 1.0 });
    // Trailing-edge normal: aft, and inboard when the edge sweeps back,
    // outboard when it sweeps forward as on the F-22.
    spikes.push({ dir: new Vector3(-s * Math.sin(te), 0, -Math.cos(te)), width: 7 * DEG, amp: 0.8 });
  }
  const fins = c.geometry.tailVTwin ?? c.geometry.tailVee;
  if (fins) {
    const cant = (fins.cant ?? 0) * DEG;
    for (const s of [1, -1]) spikes.push({ dir: new Vector3(s * Math.cos(cant), -Math.sin(cant), 0), width: 7 * DEG, amp: 0.6 });
  } else if (c.geometry.tailV) {
    for (const s of [1, -1]) spikes.push({ dir: new Vector3(s, 0, 0), width: 6 * DEG, amp: 0.5 });
  }
  return { base: 0.06, spikes };
}

/** Broad lobes almost everywhere: round body, upright fins, open intakes. */
function conventionalSignature(c: AircraftConfig): Signature {
  const L = c.geometry.wing.sweep * DEG;
  const spikes: Spike[] = [];
  for (const s of [1, -1]) {
    spikes.push({ dir: new Vector3(s, 0, 0), width: 26 * DEG, amp: 0.9 });
    spikes.push({ dir: new Vector3(s * Math.sin(L), 0, Math.cos(L)), width: 12 * DEG, amp: 0.55 });
  }
  spikes.push({ dir: new Vector3(0, 0, 1), width: 22 * DEG, amp: 0.7 });
  spikes.push({ dir: new Vector3(0, 0, -1), width: 22 * DEG, amp: 0.6 });
  spikes.push({ dir: new Vector3(0, 1, 0), width: 35 * DEG, amp: 0.45 });
  spikes.push({ dir: new Vector3(0, -1, 0), width: 35 * DEG, amp: 0.5 });
  return { base: 0.32, spikes };
}

const VERT = /* glsl */ `
varying vec3 vDir;
varying vec3 vNormalV;
varying vec3 vViewV;
void main() {
  vDir = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormalV = normalize(normalMatrix * normal);
  vViewV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
#define MAX_SPIKES ${MAX_SPIKES}
uniform float uBase;
uniform int uCount;
uniform vec4 uSpikes[MAX_SPIKES];   // xyz direction, w = amplitude
uniform float uWidths[MAX_SPIKES];
uniform float uLevel;
varying vec3 vDir;
varying vec3 vNormalV;
varying vec3 vViewV;

vec3 ramp(float t) {
  // Cold slate, through amber, to hot red-orange.
  vec3 a = vec3(0.32, 0.42, 0.55);
  vec3 b = vec3(1.0, 0.72, 0.25);
  vec3 c = vec3(1.0, 0.28, 0.08);
  return t < 0.5 ? mix(a, b, t * 2.0) : mix(b, c, (t - 0.5) * 2.0);
}

void main() {
  vec3 d = normalize(vDir);
  float v = uBase;
  for (int i = 0; i < MAX_SPIKES; i++) {
    if (i >= uCount) break;
    float ang = acos(clamp(dot(d, normalize(uSpikes[i].xyz)), -1.0, 1.0));
    float w = uWidths[i];
    v += uSpikes[i].w * exp(-(ang * ang) / (w * w));
  }
  v = clamp(v, 0.0, 1.0);
  // Rim-weighted so the shell reads as a surface rather than a fog ball.
  float rim = 1.0 - abs(dot(normalize(vNormalV), normalize(vViewV)));
  float a = (0.05 + 0.75 * v) * (0.35 + 0.65 * rim) * uLevel;
  gl_FragColor = vec4(ramp(v) * a, a);
}
`;

function shellMaterial(sig: Signature): ShaderMaterial {
  const spikes = Array.from({ length: MAX_SPIKES }, (_, i) => {
    const s = sig.spikes[i];
    return s ? new Vector4(s.dir.x, s.dir.y, s.dir.z, s.amp) : new Vector4(0, 0, 1, 0);
  });
  return new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    // Over-painted rather than added: on the pale backdrop an additive shell
    // only ever brightens, so the cold parts vanished and the stealth shell
    // with them. Premultiplied, cold reads as a slate tint and hot as orange.
    blending: NormalBlending,
    premultipliedAlpha: true,
    uniforms: {
      uBase: { value: sig.base },
      uCount: { value: Math.min(MAX_SPIKES, sig.spikes.length) },
      uSpikes: { value: spikes },
      uWidths: { value: Array.from({ length: MAX_SPIKES }, (_, i) => sig.spikes[i]?.width ?? 0.1) },
      uLevel: { value: 0 },
    },
  });
}

/**
 * The radar-signature comparison for stealth aircraft: a heat shell round the
 * aircraft on show, and a fourth-generation reference built at the same block
 * size and set beside it with its own shell.
 */
export class RadarView {
  readonly group = new Group();
  private reference: VoxelModel | null = null;
  private shells: Mesh[] = [];
  private level = 0;
  private target = 0;
  private token = 0;
  private readonly labels: HTMLElement[] = [];
  private readonly anchors: Vector3[] = [];
  /** World-space extent of both airframes, for framing the camera. */
  readonly bounds = { width: 0, depth: 0, centreX: 0 };

  constructor() {
    this.group.name = 'radar-view';
    this.group.visible = false;
    for (let i = 0; i < 3; i++) {
      const el = document.createElement('div');
      el.className = i === 2 ? 'radar-label radar-label--note' : 'radar-label';
      el.setAttribute('aria-hidden', 'true');
      el.hidden = true;
      document.body.appendChild(el);
      this.labels.push(el);
    }
  }

  /** Builds the reference and the shells. Resolves when ready to show. */
  async show(config: AircraftConfig, mainSize: Vector3, voxelSize: number): Promise<void> {
    const token = ++this.token;
    const refConfig = byId(REFERENCE_ID);
    if (!refConfig) return;
    const data = await buildClient.build(refConfig, { voxelSize });
    if (token !== this.token) return;

    this.clear();
    const ref = new VoxelModel(refConfig.id, data);
    const refSize = ref.size;
    const gap = Math.max(mainSize.x, refSize.x) * 0.35;
    const offset = -(mainSize.x * 0.5 + gap + refSize.x * 0.5);
    ref.group.position.copy(ref.center).multiplyScalar(-1);
    ref.group.position.x += offset;
    this.group.add(ref.group);
    this.reference = ref;

    const mk = (size: Vector3, sig: Signature, x: number) => {
      const shell = new Mesh(new SphereGeometry(1, 72, 36), shellMaterial(sig));
      shell.scale.set(size.x * 0.58, Math.max(size.y, size.x * 0.3) * 0.9, size.z * 0.58);
      shell.position.x = x;
      shell.renderOrder = 30;
      this.group.add(shell);
      this.shells.push(shell);
    };
    mk(mainSize, stealthSignature(config), 0);
    mk(refSize, conventionalSignature(refConfig), offset);

    this.bounds.width = mainSize.x + gap + refSize.x;
    this.bounds.depth = Math.max(mainSize.z, refSize.z);
    this.bounds.centreX = offset / 2;
    this.anchors.length = 0;
    this.anchors.push(new Vector3(0, -mainSize.y * 0.9, -mainSize.z * 0.62), new Vector3(offset, -refSize.y * 0.9, -refSize.z * 0.62));
    this.labels[0].textContent = `${config.designation} · shaped for stealth`;
    this.labels[1].textContent = `${refConfig.designation} · fourth generation`;
    this.labels[2].textContent = 'Illustrative shaping comparison — not measured data';

    this.group.visible = true;
    this.target = 1;
  }

  hide(): void {
    this.token++;
    this.target = 0;
  }

  get active(): boolean {
    return this.target > 0;
  }

  update(dt: number, camera: Camera, width: number, height: number): void {
    this.level += (this.target - this.level) * (1 - Math.exp(-dt * 5));
    for (const s of this.shells) (s.material as ShaderMaterial).uniforms.uLevel.value = this.level;
    const on = this.level > 0.02;
    this.group.visible = on;
    if (!on && this.target === 0 && this.shells.length) this.clear();

    const v = new Vector3();
    let top = Infinity;
    this.labels.forEach((el, i) => {
      el.hidden = !on;
      if (!on) return;
      el.style.opacity = String(this.level);
      if (i === 2) return;
      v.copy(this.anchors[i]).project(camera);
      // Centred on its anchor, but never past the edge of the screen.
      const half = el.offsetWidth / 2;
      const x = Math.min(Math.max((v.x * 0.5 + 0.5) * width, 8 + half), width - 8 - half);
      const y = (-v.y * 0.5 + 0.5) * height;
      top = Math.min(top, y);
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translateX(-50%)`;
    });
    // On a phone the disclaimer would sit on the title block, so it goes just
    // above the pair instead. Wider screens leave it to the stylesheet.
    const note = this.labels[2];
    if (on && note) {
      note.style.transform =
        width < 760 && Number.isFinite(top) ? `translate(${(width / 2).toFixed(1)}px, ${(top - 14).toFixed(1)}px) translate(-50%, -100%)` : '';
    }
  }

  private clear(): void {
    for (const s of this.shells) {
      s.geometry.dispose();
      (s.material as ShaderMaterial).dispose();
    }
    this.shells = [];
    this.reference?.dispose();
    this.reference = null;
    this.group.clear();
  }

  dispose(): void {
    this.clear();
    for (const l of this.labels) l.remove();
  }
}
