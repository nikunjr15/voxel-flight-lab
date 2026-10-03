import {
  Color,
  DataTexture,
  FloatType,
  MeshStandardMaterial,
  NearestFilter,
  RGBAFormat,
  Texture,
  Vector4,
  type IUniform,
} from 'three';
import { MaterialKind } from './palette';
import { DEFAULT_HIDDEN, PART_COUNT, PART_EXPLODE_DIR, PART_INDEX, PartId } from './parts';

const TEX_W = 64;
const TEX_H = 4;

/** Opacity at or above this is drawn by the solid pass, below it by the ghost pass. */
export const SOLID_OPACITY = 0.99;

/**
 * Per-part state lives in a 64x4 float texture rather than a uniform array:
 * a mode switch then costs one small texture upload instead of a shader
 * recompile or a per-instance CPU pass.
 *
 * Row 0: r = opacity, g = highlight, b = explode amount (metres), a = emissive boost
 * Row 1: rgb = explode direction (unit), a = heat (hot-metal glow, thrust mode)
 * Row 2: rgb = hinge pivot (model space, metres), a = hinge angle (radians)
 * Row 3: rgb = hinge axis (unit), a = spare
 */
export class PartState {
  readonly texture: DataTexture;
  private readonly buf: Float32Array;

  constructor() {
    this.buf = new Float32Array(TEX_W * TEX_H * 4);
    this.texture = new DataTexture(this.buf, TEX_W, TEX_H, RGBAFormat, FloatType);
    this.texture.minFilter = NearestFilter;
    this.texture.magFilter = NearestFilter;
    this.texture.generateMipmaps = false;
    this.reset();
  }

  private at(row: number, part: number): number {
    return (row * TEX_W + part) * 4;
  }

  reset(): void {
    this.buf.fill(0);
    for (let p = 0; p < TEX_W; p++) {
      this.buf[this.at(0, p)] = 1;
      // A default axis keeps the shader's normalize() well defined.
      this.buf[this.at(3, p) + 2] = 1;
    }
    for (const id of DEFAULT_HIDDEN) this.buf[this.at(0, PART_INDEX[id])] = 0;
    for (const [id, dir] of Object.entries(PART_EXPLODE_DIR)) {
      const p = PART_INDEX[id as PartId];
      if (p === undefined) continue;
      const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
      const b = this.at(1, p);
      this.buf[b] = dir[0] / len;
      this.buf[b + 1] = dir[1] / len;
      this.buf[b + 2] = dir[2] / len;
    }
    this.texture.needsUpdate = true;
  }

  private write(row: number, part: number, channel: number, v: number): void {
    const i = this.at(row, part) + channel;
    if (this.buf[i] === v) return;
    this.buf[i] = v;
    this.texture.needsUpdate = true;
  }

  setOpacity(part: number, v: number): void {
    this.write(0, part, 0, v);
  }

  setHighlight(part: number, v: number): void {
    this.write(0, part, 1, v);
  }

  setExplode(part: number, v: number): void {
    this.write(0, part, 2, v);
  }

  setEmissive(part: number, v: number): void {
    this.write(0, part, 3, v);
  }

  setHeat(part: number, v: number): void {
    this.write(1, part, 3, v);
  }

  /** Swings a part about a hinge line. Angle 0 is the as-built position. */
  setHinge(part: number, pivot: [number, number, number], axis: [number, number, number], angle: number): void {
    const len = Math.hypot(axis[0], axis[1], axis[2]) || 1;
    this.write(2, part, 0, pivot[0]);
    this.write(2, part, 1, pivot[1]);
    this.write(2, part, 2, pivot[2]);
    this.write(2, part, 3, angle);
    this.write(3, part, 0, axis[0] / len);
    this.write(3, part, 1, axis[1] / len);
    this.write(3, part, 2, axis[2] / len);
  }

  getOpacity(part: number): number {
    return this.buf[this.at(0, part)];
  }

  getExplode(part: number): number {
    return this.buf[this.at(0, part) + 2];
  }

  /** Sets every real part at once; index 0 (untagged) is included. */
  setAllOpacity(v: number): void {
    for (let p = 0; p < PART_COUNT; p++) this.write(0, p, 0, v);
  }

  setAllHighlight(v: number): void {
    for (let p = 0; p < PART_COUNT; p++) this.write(0, p, 1, v);
  }

  setAllExplode(v: number): void {
    for (let p = 0; p < PART_COUNT; p++) this.write(0, p, 2, v);
  }

  dispose(): void {
    this.texture.dispose();
  }
}

/**
 * The part of the screen voxels may fly through during a morph, in
 * normalised device coordinates: x min, x max, y min, y max. Outside it a
 * voxel in flight shrinks away, so the cloud never crosses the text column.
 * One uniform shared by every voxel material; the app sets it from the
 * layout. Wide open by default.
 */
export const MORPH_BOUNDS: IUniform<Vector4> = { value: new Vector4(-9, 9, -9, 9) };

export function setMorphBounds(xMin: number, xMax: number, yMin: number, yMax: number): void {
  MORPH_BOUNDS.value.set(xMin, xMax, yMin, yMax);
}

/**
 * A second keep-out, for the note cards in the bottom-left corner: the
 * region left of x and below y, in the same coordinates. Off by default.
 */
export const MORPH_AVOID: IUniform<Vector4> = { value: new Vector4(-9, -9, 0, 0) };

export function setMorphAvoid(xMax: number, yMax: number): void {
  MORPH_AVOID.value.set(xMax, yMax, 0, 0);
}

export interface VoxelUniforms {
  uPartState: IUniform<Texture>;
  uMorph: IUniform<number>;
  /** Whole-model opacity, multiplied into every part's: the reduced-motion crossfade. */
  uFade: IUniform<number>;
  uExplode: IUniform<number>;
  uExplodeScale: IUniform<number>;
  uAOStrength: IUniform<number>;
  uAccent: IUniform<Color>;
  uHeatColor: IUniform<Color>;
}

export function createVoxelUniforms(partState: PartState): VoxelUniforms {
  return {
    uPartState: { value: partState.texture },
    uMorph: { value: 0 },
    uFade: { value: 1 },
    uExplode: { value: 1 },
    uExplodeScale: { value: 1 },
    uAOStrength: { value: 0.33 },
    uAccent: { value: new Color('#ff6a2b') },
    uHeatColor: { value: new Color('#ff7a26') },
  };
}

const VERT_DECL = /* glsl */ `
attribute float aPart;
attribute float aAO;
attribute float aSeed;
attribute vec3 aScatter;
attribute vec3 aColor;
uniform sampler2D uPartState;
uniform float uMorph;
uniform float uFade;
uniform vec4 uBounds;
uniform vec4 uAvoid;
uniform float uExplode;
uniform float uExplodeScale;
varying float vAO;
varying float vOpacity;
varying float vHighlight;
varying float vEmissive;
varying float vHeat;
varying float vFaceShade;
varying vec3 vVoxColor;
`;

// Runs first in main(), before the normal is transformed, so a hinged part's
// normal swings with it and its lighting stays right.
const VERT_NORMAL = /* glsl */ `
  int pi = int(aPart + 0.5);
  vec4 pstate = texelFetch(uPartState, ivec2(pi, 0), 0);
  vec4 pvec = texelFetch(uPartState, ivec2(pi, 1), 0);
  vec4 phinge = texelFetch(uPartState, ivec2(pi, 2), 0);
  bool hinged = abs(phinge.w) > 1e-4;
  mat3 hingeRot = mat3(1.0);
  if (hinged) {
    vec3 k = normalize(texelFetch(uPartState, ivec2(pi, 3), 0).xyz);
    float hc = cos(phinge.w);
    float hs = sin(phinge.w);
    // Rodrigues: R = I + sin * K + (1 - cos) * K^2, K the cross-product matrix.
    mat3 K = mat3(0.0, k.z, -k.y, -k.z, 0.0, k.x, k.y, -k.x, 0.0);
    hingeRot = mat3(1.0) + hs * K + (1.0 - hc) * (K * K);
    objectNormal = hingeRot * objectNormal;
  }
`;

type Pass = 'solid' | 'ghost' | 'glass';

const cullTest = (pass: Pass): string =>
  pass === 'solid'
    ? `vOpacity < ${SOLID_OPACITY.toFixed(3)}`
    : pass === 'ghost'
      ? `vOpacity >= ${SOLID_OPACITY.toFixed(3)} || vOpacity < 0.02`
      : 'vOpacity < 0.02';

const vertBody = (pass: Pass) => /* glsl */ `
  vOpacity = pstate.r * uFade;
  vHighlight = pstate.g;
  vEmissive = pstate.a;
  vHeat = pvec.a;
  vAO = aAO;
  vVoxColor = aColor;
  vFaceShade = 0.82 + 0.15 * objectNormal.y + 0.05 * abs(objectNormal.x);

  vec3 iPos = instanceMatrix[3].xyz;

  // Staggered so the airframe peels apart in a wave instead of all at once.
  float m = smoothstep(0.0, 1.0, clamp(uMorph * 1.7 - aSeed * 0.7, 0.0, 1.0));

  transformed *= mix(1.0, 0.45, m);
  // In flight, voxels pale toward the backdrop grey: otherwise the dark duct
  // and engine linings, hidden inside the airframe, fly out as black grit.
  vVoxColor = mix(aColor, vec3(0.78, 0.81, 0.84), m * 0.6);
  // Past 1 the scattered voxels shrink away to nothing: the outgoing half of a
  // morph ends empty instead of vanishing with a pop.
  transformed *= 1.0 - smoothstep(1.0, 1.3, uMorph);
  // Only a part fading right out shrinks as it goes. A part held at ghost
  // opacity keeps full-size voxels, so it reads as a translucent skin rather
  // than a lattice of specks.
  transformed *= mix(0.3, 1.0, clamp(vOpacity * 10.0, 0.0, 1.0));

  if (m > 0.0001) {
    float a = m * 6.2831853 * (aSeed - 0.5) * 1.6;
    float ca = cos(a);
    float sa = sin(a);
    transformed.xy = mat2(ca, -sa, sa, ca) * transformed.xy;
    transformed.yz = mat2(ca, -sa, sa, ca) * transformed.yz;
  }

  if (hinged) {
    vec3 hp = iPos + transformed;
    hp = hingeRot * (hp - phinge.xyz) + phinge.xyz;
    transformed = hp - iPos;
  }

  vec3 disp = (aScatter - iPos) * m;
  disp += pvec.xyz * (uExplode * pstate.b * uExplodeScale);

  // Keep-out: a voxel in flight whose centre leaves the free part of the
  // screen shrinks away instead of drifting over the text. A voxel at rest
  // is never touched, so the assembled airframe cannot be clipped.
  if (m > 0.0) {
    vec4 cc = projectionMatrix * modelViewMatrix * vec4(iPos + disp, 1.0);
    vec2 nd = cc.xy / max(cc.w, 1e-4);
    const float band = 0.07;
    float keep = smoothstep(uBounds.x, uBounds.x + band, nd.x)
      * (1.0 - smoothstep(uBounds.y - band, uBounds.y, nd.x))
      * smoothstep(uBounds.z, uBounds.z + band, nd.y)
      * (1.0 - smoothstep(uBounds.w - band, uBounds.w, nd.y));
    keep *= 1.0 - (1.0 - smoothstep(uAvoid.x - band, uAvoid.x, nd.x)) * (1.0 - smoothstep(uAvoid.y - band, uAvoid.y, nd.y));
    transformed *= mix(1.0, keep, clamp(m * 3.0, 0.0, 1.0));
  }
  transformed += disp;

  // A voxel this pass does not draw collapses to a point, so it rasterises
  // nothing. Culling here rather than discarding per fragment matters: a
  // ghost pass over a close-up section otherwise shades every pixel of every
  // solid voxel only to throw it away, and a discard in the solid pass would
  // cost it early depth rejection.
  if (${cullTest(pass)}) transformed = vec3(0.0);
`;

const FRAG_DECL = /* glsl */ `
uniform float uAOStrength;
uniform vec3 uAccent;
uniform vec3 uHeatColor;
uniform float uEmissiveBoost;
uniform float uEmissiveGain;
varying float vAO;
varying float vOpacity;
varying float vHighlight;
varying float vEmissive;
varying float vHeat;
varying float vFaceShade;
varying vec3 vVoxColor;
`;

// Which instances a pass draws is settled in the vertex shader; see vertBody.
const FRAG_COLOR = /* glsl */ `
  diffuseColor.rgb *= vVoxColor;
  diffuseColor.rgb *= 1.0 - uAOStrength * pow(vAO, 0.75);
  diffuseColor.rgb *= vFaceShade;
  diffuseColor.a *= vOpacity;
`;

const FRAG_EMISSIVE = /* glsl */ `
  totalEmissiveRadiance += vHighlight * uAccent * 0.9;
  // The per-part emissive channel lights emissive voxels only -- exhaust,
  // displays, HUD -- so a hot tailpipe does not turn its metal casing white.
  // Metal takes the heat term instead.
  totalEmissiveRadiance += vVoxColor * (uEmissiveBoost + vEmissive * uEmissiveGain);
  totalEmissiveRadiance += uHeatColor * vHeat;
`;

export interface VoxelMaterialOptions {
  kind: MaterialKind;
  uniforms: VoxelUniforms;
  /**
   * Opaque buckets are drawn twice. The solid pass draws parts at full
   * opacity and writes depth; the ghost pass draws only faded parts, blended,
   * without writing depth. A single blended pass lets a faded skin voxel that
   * happens to draw first hide the opaque engine behind it.
   */
  ghost?: boolean;
}

export function createVoxelMaterial({ kind, uniforms, ghost = false }: VoxelMaterialOptions): MeshStandardMaterial {
  const base: ConstructorParameters<typeof MeshStandardMaterial>[0] = {
    color: 0xffffff,
    roughness: 0.86,
    metalness: 0.03,
    flatShading: false,
    // Painted skin takes no image-based lighting at all. Even a smooth
    // environment gradient reflects off a large flat panel as a soft oval
    // that sweeps with the view, because the reflection vector swings with
    // perspective across the panel. That read as dirt on the wings. Lights
    // alone light the skin; metal and glass keep their reflections.
    envMapIntensity: 0,
  };

  let emissiveBoost = 0;

  switch (kind) {
    case 'metal':
      // Short of a mirror. At 0.85 the nozzle bore had no diffuse to carry it
      // and read as a black hole from every angle.
      base.roughness = 0.44;
      base.metalness = 0.6;
      base.envMapIntensity = 0.9;
      break;
    case 'emissive':
      base.roughness = 0.6;
      base.metalness = 0;
      // Low at rest: a cold tailpipe is dark. Thrust mode raises the
      // emissive channel per part through the part-state texture, which is
      // what makes an afterburner light up.
      emissiveBoost = 0.22;
      break;
    case 'glass':
      base.roughness = 0.1;
      base.metalness = 0;
      base.transparent = true;
      base.opacity = 0.36;
      base.depthWrite = false;
      // Without this the environment washes the glazing out to near-white and
      // the cockpit underneath stops reading.
      base.envMapIntensity = 0.45;
      break;
    default:
      break;
  }

  if (ghost) {
    base.transparent = true;
    base.depthWrite = false;
  }

  const pass: Pass = kind === 'glass' ? 'glass' : ghost ? 'ghost' : 'solid';
  const mat = new MeshStandardMaterial(base);
  mat.userData.kind = kind;
  const boostUniform: IUniform<number> = { value: emissiveBoost };
  const gainUniform: IUniform<number> = { value: kind === 'emissive' ? 1 : 0 };
  mat.userData.uEmissiveBoost = boostUniform;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uPartState = uniforms.uPartState;
    shader.uniforms.uMorph = uniforms.uMorph;
    shader.uniforms.uFade = uniforms.uFade;
    shader.uniforms.uBounds = MORPH_BOUNDS;
    shader.uniforms.uAvoid = MORPH_AVOID;
    shader.uniforms.uExplode = uniforms.uExplode;
    shader.uniforms.uExplodeScale = uniforms.uExplodeScale;
    shader.uniforms.uAOStrength = uniforms.uAOStrength;
    shader.uniforms.uAccent = uniforms.uAccent;
    shader.uniforms.uHeatColor = uniforms.uHeatColor;
    shader.uniforms.uEmissiveBoost = boostUniform;
    shader.uniforms.uEmissiveGain = gainUniform;

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_DECL}`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n${VERT_NORMAL}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${vertBody(pass)}`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_DECL}`)
      .replace('#include <color_fragment>', FRAG_COLOR)
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>\n${FRAG_EMISSIVE}`,
      );
  };

  // Distinguish the shader variants so three does not share one program across them.
  mat.customProgramCacheKey = () => `voxel-${kind}-${pass}`;

  return mat;
}
