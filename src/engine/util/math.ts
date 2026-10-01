export const DEG = Math.PI / 180;

export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const clamp01 = (v: number): number => clamp(v, 0, 1);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number): number => (b === a ? 0 : (v - a) / (b - a));
export const smoothstep = (t: number): number => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};
export const smootherstep = (t: number): number => {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
};

export type V3 = [number, number, number];

export const v3 = (x: number, y: number, z: number): V3 => [x, y, z];
export const vAdd = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const vSub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const vScale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const vDot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const vCross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const vLen = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
export const vNorm = (a: V3): V3 => {
  const l = vLen(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** Symmetric airfoil-like thickness distribution, 0 at both ends, peak 1 near 1/3 chord. */
export const thicknessProfile = (c: number): number => {
  if (c <= 0 || c >= 1) return 0;
  return Math.sqrt(c) * (1 - c) * 2.598;
};

/** Smooth 0..1 ramp with per-item stagger, used for scatter waves. */
export const staggered = (t: number, seed: number, spread = 0.55): number =>
  smootherstep((t * (1 + spread) - seed * spread) / 1);
