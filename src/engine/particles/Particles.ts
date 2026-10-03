import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  MeshBasicMaterial,
  NormalBlending,
} from 'three';

/**
 * A pool of voxel particles: one InstancedMesh, one draw call, matrices
 * written straight into the instance buffer each frame. Every effect on the
 * site -- airflow, afterburner plume, shock diamonds, speed lines -- is one of
 * these with its own update rule.
 *
 * Instances are translation plus per-axis scale, so writing a particle is
 * seven numbers into a 16-float slot. Dead particles get scale 0.
 */
export class ParticlePool {
  readonly mesh: InstancedMesh;
  readonly capacity: number;
  private readonly m: Float32Array;
  private readonly c: Float32Array;
  private readonly colorAttr: InstancedBufferAttribute;

  constructor(
    capacity: number,
    opts: { additive?: boolean; opacity?: number; size?: number; depthTest?: boolean } = {},
  ) {
    this.capacity = capacity;
    const s = opts.size ?? 1;
    const geometry = new BoxGeometry(s, s, s);
    const material = new MeshBasicMaterial({
      transparent: true,
      opacity: opts.opacity ?? 1,
      depthWrite: false,
      depthTest: opts.depthTest ?? true,
      blending: opts.additive === false ? NormalBlending : AdditiveBlending,
      toneMapped: false,
    });
    this.mesh = new InstancedMesh(geometry, material, capacity);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 20;
    this.m = this.mesh.instanceMatrix.array as Float32Array;
    this.c = new Float32Array(capacity * 3);
    this.colorAttr = new InstancedBufferAttribute(this.c, 3);
    this.mesh.instanceColor = this.colorAttr;
    this.clear();
  }

  /** Writes one instance: centre, per-axis scale, colour. */
  set(i: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, r: number, g: number, b: number): void {
    const o = i * 16;
    const m = this.m;
    m[o] = sx;
    m[o + 1] = 0;
    m[o + 2] = 0;
    m[o + 3] = 0;
    m[o + 4] = 0;
    m[o + 5] = sy;
    m[o + 6] = 0;
    m[o + 7] = 0;
    m[o + 8] = 0;
    m[o + 9] = 0;
    m[o + 10] = sz;
    m[o + 11] = 0;
    m[o + 12] = x;
    m[o + 13] = y;
    m[o + 14] = z;
    m[o + 15] = 1;
    const c = i * 3;
    this.c[c] = r;
    this.c[c + 1] = g;
    this.c[c + 2] = b;
  }

  hide(i: number): void {
    const o = i * 16;
    this.m[o] = 0;
    this.m[o + 5] = 0;
    this.m[o + 10] = 0;
  }

  clear(): void {
    for (let i = 0; i < this.capacity; i++) this.hide(i);
    this.commit();
  }

  commit(): void {
    this.mesh.instanceMatrix.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
  }

  set visible(v: boolean) {
    this.mesh.visible = v;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshBasicMaterial).dispose();
    this.mesh.dispose();
  }
}

export type Vec3 = [number, number, number];

/** A polyline with cumulative lengths, sampled by distance. */
export class Path {
  readonly points: Vec3[];
  readonly lengths: number[];
  readonly total: number;

  constructor(points: Vec3[]) {
    this.points = points;
    this.lengths = [0];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      this.lengths.push(this.lengths[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
    }
    this.total = this.lengths[this.lengths.length - 1] || 1;
  }

  at(d: number, out: Vec3): Vec3 {
    const L = this.lengths;
    let i = 1;
    while (i < L.length - 1 && L[i] < d) i++;
    const a = this.points[i - 1];
    const b = this.points[i];
    const seg = L[i] - L[i - 1] || 1;
    const t = Math.min(1, Math.max(0, (d - L[i - 1]) / seg));
    out[0] = a[0] + (b[0] - a[0]) * t;
    out[1] = a[1] + (b[1] - a[1]) * t;
    out[2] = a[2] + (b[2] - a[2]) * t;
    return out;
  }
}

const SPEED_TINT = new Color('#f4f6f8');

const hash = (n: number): number => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * Engine mode: air drawn in at the intakes, through the ducts -- S-ducts
 * visibly bend -- and out at the nozzles. Each path gets an even share of
 * the pool; particles are spaced along it and slide forward with time.
 */
export class AirflowEffect {
  private readonly pool: ParticlePool;
  private paths: Path[] = [];
  private readonly tmp: Vec3 = [0, 0, 0];
  private size = 0.1;
  private jitter = 0.1;
  private time = 0;
  /** Faded in and out by the mode; 0 hides the effect. */
  level = 0;

  constructor(parent: Group, capacity = 640) {
    // Drawn through the airframe: the air runs inside ducts and engines that
    // stay opaque, so a depth-tested trace would be hidden exactly where it
    // is most interesting.
    this.pool = new ParticlePool(capacity, { additive: true, depthTest: false });
    parent.add(this.pool.mesh);
  }

  setPaths(paths: Vec3[][], voxelSize: number): void {
    this.paths = paths.filter((p) => p.length >= 2).map((p) => new Path(p));
    this.size = voxelSize * 0.55;
    this.jitter = voxelSize * 1.1;
    this.pool.clear();
  }

  update(dt: number): void {
    this.time += dt;
    const pool = this.pool;
    if (this.level <= 0.01 || this.paths.length === 0) {
      pool.visible = false;
      return;
    }
    pool.visible = true;
    const per = Math.floor(pool.capacity / this.paths.length);
    const speed = 5.5;
    const s = this.size * this.level;
    let i = 0;
    for (let p = 0; p < this.paths.length; p++) {
      const path = this.paths[p];
      for (let k = 0; k < per; k++, i++) {
        const seed = p * 1000 + k;
        const d = (hash(seed) * path.total + this.time * speed * (0.8 + 0.4 * hash(seed + 7))) % path.total;
        path.at(d, this.tmp);
        const jx = (hash(seed + 1) - 0.5) * this.jitter;
        const jy = (hash(seed + 2) - 0.5) * this.jitter;
        // Cool at the inlet, warming toward the exhaust.
        const t = d / path.total;
        const r = 0.35 + 0.65 * t * t;
        const g = 0.75 - 0.25 * t;
        const b = 1.0 - 0.75 * t;
        pool.set(i, this.tmp[0] + jx, this.tmp[1] + jy, this.tmp[2], s, s, s * 1.8, r * this.level, g * this.level, b * this.level);
      }
    }
    for (; i < pool.capacity; i++) pool.hide(i);
    pool.commit();
  }

  dispose(): void {
    this.pool.dispose();
  }
}

export interface Exit {
  /** Exit centre, model space. */
  at: Vec3;
  radius: number;
}

/**
 * Afterburner: a voxel plume streaming aft from each nozzle, white-hot at the
 * lip and cooling to orange, with a train of shock diamonds standing in it.
 * Particles are stateless -- position is a function of seed and time -- so
 * there is nothing to spawn, kill or leak.
 */
export class PlumeEffect {
  private readonly plume: ParticlePool;
  private readonly diamonds: ParticlePool;
  private exits: Exit[] = [];
  private time = 0;
  private size = 0.1;
  level = 0;

  constructor(parent: Group, capacity = 1400) {
    this.plume = new ParticlePool(capacity, { additive: true });
    this.diamonds = new ParticlePool(160, { additive: true });
    parent.add(this.plume.mesh, this.diamonds.mesh);
  }

  setExits(exits: Exit[], voxelSize: number): void {
    this.exits = exits;
    this.size = voxelSize;
    this.plume.clear();
    this.diamonds.clear();
  }

  update(dt: number): void {
    this.time += dt;
    const on = this.level > 0.01 && this.exits.length > 0;
    this.plume.visible = on;
    this.diamonds.visible = on;
    if (!on) return;

    const L = this.level;
    const per = Math.floor(this.plume.capacity / this.exits.length);
    const life = 0.42;
    let i = 0;
    for (let e = 0; e < this.exits.length; e++) {
      const ex = this.exits[e];
      const len = ex.radius * 13 * (0.55 + 0.45 * L);
      for (let k = 0; k < per; k++, i++) {
        const seed = e * 5000 + k;
        const age = ((this.time / life + hash(seed)) % 1 + 1) % 1;
        const a = hash(seed + 3) * Math.PI * 2;
        const spread = ex.radius * (0.75 + 0.9 * age) * Math.sqrt(hash(seed + 5));
        const x = ex.at[0] + Math.cos(a) * spread;
        const y = ex.at[1] + Math.sin(a) * spread;
        const z = ex.at[2] - age * len;
        // White core at the lip, through yellow, to a dull orange tail.
        const r = 1;
        const g = Math.max(0.25, 0.95 - age * 1.1);
        const b = Math.max(0.05, 0.8 - age * 2.2);
        const fade = (1 - age) * (1 - age) * L;
        const s = this.size * (1.05 - 0.55 * age);
        this.plume.set(i, x, y, z, s, s, s * 1.6, r * fade, g * fade, b * fade);
      }
    }
    for (; i < this.plume.capacity; i++) this.plume.hide(i);
    this.plume.commit();

    // Shock diamonds: rings standing at fixed stations along each plume,
    // breathing slightly. Brighter than the plume around them.
    const ringN = 10;
    let j = 0;
    for (let e = 0; e < this.exits.length && j < this.diamonds.capacity; e++) {
      const ex = this.exits[e];
      for (let d = 0; d < 4; d++) {
        const z = ex.at[2] - ex.radius * (2.2 + 2.6 * d);
        const pulse = 0.75 + 0.25 * Math.sin(this.time * 22 + d * 1.7 + e);
        const rr = ex.radius * (0.55 - d * 0.08);
        const bright = L * pulse * (1 - d * 0.18);
        for (let k = 0; k < ringN && j < this.diamonds.capacity; k++, j++) {
          const a = (k / ringN) * Math.PI * 2 + this.time * 3;
          const s = this.size * 0.85;
          this.diamonds.set(
            j,
            ex.at[0] + Math.cos(a) * rr,
            ex.at[1] + Math.sin(a) * rr,
            z,
            s,
            s,
            s,
            bright,
            bright * 0.92,
            bright * 0.78,
          );
        }
      }
    }
    for (; j < this.diamonds.capacity; j++) this.diamonds.hide(j);
    this.diamonds.commit();
  }

  dispose(): void {
    this.plume.dispose();
    this.diamonds.dispose();
  }
}

/**
 * The air rushing past at speed: thin streaks in a loose cylinder around the
 * airframe, sliding aft and wrapping. Off entirely under reduced motion.
 */
export class SpeedLines {
  private readonly pool: ParticlePool;
  private length = 15;
  private radius = 8;
  private time = 0;
  level = 0;

  constructor(parent: Group, capacity = 140) {
    this.pool = new ParticlePool(capacity, { additive: false, opacity: 0.32 });
    parent.add(this.pool.mesh);
  }

  setExtent(length: number, span: number): void {
    this.length = length;
    this.radius = Math.max(span, length * 0.5) * 0.7;
  }

  update(dt: number): void {
    this.time += dt;
    const on = this.level > 0.01;
    this.pool.visible = on;
    if (!on) return;
    const range = this.length * 3;
    const tint = SPEED_TINT;
    for (let i = 0; i < this.pool.capacity; i++) {
      const a = hash(i) * Math.PI * 2;
      const r = this.radius * (0.55 + 0.9 * hash(i + 11));
      const speed = 34 + 30 * hash(i + 13);
      const z = range * 0.5 - (((hash(i + 17) * range + this.time * speed) % range) + range) % range;
      const len = 1.2 + 3.5 * hash(i + 19);
      const w = 0.025 * this.level;
      this.pool.set(i, Math.cos(a) * r, Math.sin(a) * r * 0.6, z, w, w, len * this.level, tint.r, tint.g, tint.b);
    }
    this.pool.commit();
  }

  dispose(): void {
    this.pool.dispose();
  }
}
