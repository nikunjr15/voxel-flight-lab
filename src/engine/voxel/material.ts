import {
  Color,
  DataTexture,
  FloatType,
  MeshStandardMaterial,
  NearestFilter,
  RGBAFormat,
  Texture,
  type IUniform,
} from 'three';
import { MaterialKind } from './palette';
import { PART_COUNT, PART_EXPLODE_DIR, PART_INDEX, PartId } from './parts';

const TEX_W = 64;
const TEX_H = 2;

/**
 * Per-part state lives in a 64x2 float texture rather than a uniform array:
 * a mode switch then costs one small texture upload instead of a shader
 * recompile or a per-instance CPU pass.
 *
 * Row 0: r = opacity, g = highlight, b = explode amount, a = emissive boost
 * Row 1: rgb = explode direction (unit), a = spare
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

  private row0(part: number): number {
    return part * 4;
  }

  private row1(part: number): number {
    return (TEX_W + part) * 4;
  }

  reset(): void {
    for (let p = 0; p < TEX_W; p++) {
      const a = this.row0(p);
      this.buf[a] = 1;
      this.buf[a + 1] = 0;
      this.buf[a + 2] = 0;
      this.buf[a + 3] = 0;
    }
    for (const [id, dir] of Object.entries(PART_EXPLODE_DIR)) {
      const p = PART_INDEX[id as PartId];
      if (p === undefined) continue;
      const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
      const b = this.row1(p);
      this.buf[b] = dir[0] / len;
      this.buf[b + 1] = dir[1] / len;
      this.buf[b + 2] = dir[2] / len;
      this.buf[b + 3] = 0;
    }
    this.texture.needsUpdate = true;
  }

  setOpacity(part: number, v: number): void {
    this.buf[this.row0(part)] = v;
    this.texture.needsUpdate = true;
  }

  setHighlight(part: number, v: number): void {
    this.buf[this.row0(part) + 1] = v;
    this.texture.needsUpdate = true;
  }

  setExplode(part: number, v: number): void {
    this.buf[this.row0(part) + 2] = v;
    this.texture.needsUpdate = true;
  }

  setEmissive(part: number, v: number): void {
    this.buf[this.row0(part) + 3] = v;
    this.texture.needsUpdate = true;
  }

  getOpacity(part: number): number {
    return this.buf[this.row0(part)];
  }

  /** Sets every real part at once; index 0 (untagged) is included. */
  setAllOpacity(v: number): void {
    for (let p = 0; p < PART_COUNT; p++) this.buf[this.row0(p)] = v;
    this.texture.needsUpdate = true;
  }

  setAllHighlight(v: number): void {
    for (let p = 0; p < PART_COUNT; p++) this.buf[this.row0(p) + 1] = v;
    this.texture.needsUpdate = true;
  }

  setAllExplode(v: number): void {
    for (let p = 0; p < PART_COUNT; p++) this.buf[this.row0(p) + 2] = v;
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.texture.dispose();
  }
}

export interface VoxelUniforms {
  uPartState: IUniform<Texture>;
  uMorph: IUniform<number>;
  uExplode: IUniform<number>;
  uExplodeScale: IUniform<number>;
  uAOStrength: IUniform<number>;
  uAccent: IUniform<Color>;
}

export function createVoxelUniforms(partState: PartState): VoxelUniforms {
  return {
    uPartState: { value: partState.texture },
    uMorph: { value: 0 },
    uExplode: { value: 0 },
    uExplodeScale: { value: 1.2 },
    uAOStrength: { value: 0.33 },
    uAccent: { value: new Color('#ff6a2b') },
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
uniform float uExplode;
uniform float uExplodeScale;
varying float vAO;
varying float vOpacity;
varying float vHighlight;
varying float vEmissive;
varying float vFaceShade;
varying vec3 vVoxColor;
`;

const VERT_BODY = /* glsl */ `
  int pi = int(aPart + 0.5);
  vec4 pstate = texelFetch(uPartState, ivec2(pi, 0), 0);
  vec4 pvec = texelFetch(uPartState, ivec2(pi, 1), 0);
  vOpacity = pstate.r;
  vHighlight = pstate.g;
  vEmissive = pstate.a;
  vAO = aAO;
  vVoxColor = aColor;
  vFaceShade = 0.82 + 0.15 * normal.y + 0.05 * abs(normal.x);

  vec3 iPos = instanceMatrix[3].xyz;

  // Staggered so the airframe peels apart in a wave instead of all at once.
  float m = smoothstep(0.0, 1.0, clamp(uMorph * 1.7 - aSeed * 0.7, 0.0, 1.0));

  transformed *= mix(1.0, 0.45, m);
  transformed *= mix(0.3, 1.0, clamp(vOpacity * 1.6, 0.0, 1.0));

  if (m > 0.0001) {
    float a = m * 6.2831853 * (aSeed - 0.5) * 1.6;
    float ca = cos(a);
    float sa = sin(a);
    transformed.xy = mat2(ca, -sa, sa, ca) * transformed.xy;
    transformed.yz = mat2(ca, -sa, sa, ca) * transformed.yz;
  }

  vec3 disp = (aScatter - iPos) * m;
  disp += pvec.xyz * (uExplode * pstate.b * uExplodeScale);
  transformed += disp;
`;

const FRAG_DECL = /* glsl */ `
uniform float uAOStrength;
uniform vec3 uAccent;
uniform float uEmissiveBoost;
varying float vAO;
varying float vOpacity;
varying float vHighlight;
varying float vEmissive;
varying float vFaceShade;
varying vec3 vVoxColor;
`;

const FRAG_COLOR = /* glsl */ `
  if (vOpacity < 0.02) discard;
  diffuseColor.rgb *= vVoxColor;
  diffuseColor.rgb *= 1.0 - uAOStrength * pow(vAO, 0.75);
  diffuseColor.rgb *= vFaceShade;
  diffuseColor.a *= vOpacity;
`;

const FRAG_EMISSIVE = /* glsl */ `
  totalEmissiveRadiance += vHighlight * uAccent * 0.9;
  totalEmissiveRadiance += vVoxColor * (uEmissiveBoost + vEmissive);
`;

export interface VoxelMaterialOptions {
  kind: MaterialKind;
  uniforms: VoxelUniforms;
}

export function createVoxelMaterial({ kind, uniforms }: VoxelMaterialOptions): MeshStandardMaterial {
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
      base.roughness = 0.3;
      base.metalness = 0.85;
      base.envMapIntensity = 1;
      break;
    case 'emissive':
      base.roughness = 0.6;
      base.metalness = 0;
      // Kept below 1 so an exhaust does not clip to flat yellow. Thrust mode
      // raises it per part through the part-state texture instead.
      emissiveBoost = 0.62;
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

  const mat = new MeshStandardMaterial(base);
  mat.userData.kind = kind;
  const boostUniform: IUniform<number> = { value: emissiveBoost };
  mat.userData.uEmissiveBoost = boostUniform;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uPartState = uniforms.uPartState;
    shader.uniforms.uMorph = uniforms.uMorph;
    shader.uniforms.uExplode = uniforms.uExplode;
    shader.uniforms.uExplodeScale = uniforms.uExplodeScale;
    shader.uniforms.uAOStrength = uniforms.uAOStrength;
    shader.uniforms.uAccent = uniforms.uAccent;
    shader.uniforms.uEmissiveBoost = boostUniform;

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_DECL}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERT_BODY}`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_DECL}`)
      .replace('#include <color_fragment>', FRAG_COLOR)
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>\n${FRAG_EMISSIVE}`,
      );
  };

  // Distinguish the shader variants so three does not share one program across kinds.
  mat.customProgramCacheKey = () => `voxel-${kind}`;

  return mat;
}
