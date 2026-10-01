/** Material buckets. Each becomes at most one InstancedMesh, so one draw call. */
export type MaterialKind = 'opaque' | 'metal' | 'emissive' | 'glass';

export interface PaletteEntry {
  /** Linear-ish sRGB components in 0..1, resolved once at build time. */
  r: number;
  g: number;
  b: number;
  kind: MaterialKind;
}

/** Semantic slot names a config may provide. Everything else falls back to `skin`. */
export const PALETTE_SLOTS = [
  'skin',
  'skinLight',
  'skinDark',
  'skinShade',
  'frame',
  'glass',
  'cockpit',
  'seat',
  'hud',
  'metal',
  'nozzle',
  'exhaust',
  'store',
  'pylon',
  'accent',
  'marking1',
  'marking2',
  'marking3',
  'marking4',
] as const;

export type PaletteSlot = (typeof PALETTE_SLOTS)[number];

const SLOT_KIND: Record<PaletteSlot, MaterialKind> = {
  skin: 'opaque',
  skinLight: 'opaque',
  skinDark: 'opaque',
  skinShade: 'opaque',
  frame: 'opaque',
  glass: 'glass',
  cockpit: 'opaque',
  seat: 'opaque',
  hud: 'emissive',
  metal: 'metal',
  nozzle: 'metal',
  exhaust: 'emissive',
  store: 'opaque',
  pylon: 'opaque',
  accent: 'opaque',
  marking1: 'opaque',
  marking2: 'opaque',
  marking3: 'opaque',
  marking4: 'opaque',
};

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '').trim();
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * Resolves semantic slot names to palette indices for the voxel grid.
 * Index 0 is always "empty" so a zeroed grid reads as air.
 */
export class Palette {
  readonly entries: PaletteEntry[] = [{ r: 0, g: 0, b: 0, kind: 'opaque' }];
  private readonly bySlot = new Map<string, number>();
  private readonly byKey = new Map<string, number>();

  constructor(slots: Partial<Record<PaletteSlot, string>>) {
    for (const slot of PALETTE_SLOTS) {
      const hex = slots[slot];
      if (!hex) continue;
      this.bySlot.set(slot, this.add(hex, SLOT_KIND[slot]));
    }
    if (!this.bySlot.has('skin')) this.bySlot.set('skin', this.add('#9aa4ad', 'opaque'));
  }

  add(hex: string, kind: MaterialKind): number {
    const key = `${hex}|${kind}`;
    const existing = this.byKey.get(key);
    if (existing !== undefined) return existing;
    const [r, g, b] = hexToRgb(hex);
    this.entries.push({ r, g, b, kind });
    const idx = this.entries.length - 1;
    this.byKey.set(key, idx);
    return idx;
  }

  /** Palette index for a slot, falling back to `skin`. */
  idx(slot: PaletteSlot | string): number {
    return this.bySlot.get(slot) ?? this.bySlot.get('skin') ?? 1;
  }

  /** A tonal variant of an existing slot, used for panel-line shading. */
  shade(slot: PaletteSlot, factor: number, kind: MaterialKind = 'opaque'): number {
    const base = this.entries[this.idx(slot)];
    const to = (v: number) =>
      Math.round(Math.min(1, Math.max(0, v * factor)) * 255)
        .toString(16)
        .padStart(2, '0');
    return this.add(`#${to(base.r)}${to(base.g)}${to(base.b)}`, kind);
  }

  kindOf(index: number): MaterialKind {
    return this.entries[index]?.kind ?? 'opaque';
  }

  /** Flat Float32 colour table, transferable to the main thread. */
  toColorArray(): Float32Array {
    const out = new Float32Array(this.entries.length * 3);
    this.entries.forEach((e, i) => {
      out[i * 3] = e.r;
      out[i * 3 + 1] = e.g;
      out[i * 3 + 2] = e.b;
    });
    return out;
  }

  toKindArray(): Uint8Array {
    const order: MaterialKind[] = ['opaque', 'metal', 'emissive', 'glass'];
    return Uint8Array.from(this.entries.map((e) => order.indexOf(e.kind)));
  }
}

export const MATERIAL_KINDS: MaterialKind[] = ['opaque', 'metal', 'emissive', 'glass'];
