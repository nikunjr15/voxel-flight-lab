import { Mask, paintSide } from './decals';
import { PART_INDEX, PartId } from '../voxel/parts';
import type { LetteringParams } from '../../aircraft/types';
import type { BuildCtx } from './ctx';

/**
 * A 3x5 bitmap font written out as code, so serials and tail codes need no
 * font file or texture. Rows read top to bottom, columns left to right.
 */
const FONT: Record<string, string> = {
  '0': '111101101101111',
  '1': '010110010010111',
  '2': '111001111100111',
  '3': '111001111001111',
  '4': '101101111001001',
  '5': '111100111001111',
  '6': '111100111101111',
  '7': '111001010010010',
  '8': '111101111101111',
  '9': '111101111001111',
  A: '111101111101101',
  B: '110101110101110',
  C: '111100100100111',
  D: '110101101101110',
  E: '111100111100111',
  F: '111100111100100',
  G: '111100101101111',
  H: '101101111101101',
  I: '111010010010111',
  J: '001001001101111',
  K: '101101110101101',
  L: '100100100100111',
  M: '101111111101101',
  N: '110101101101101',
  O: '111101101101111',
  P: '111101111100100',
  Q: '111101101111001',
  R: '111101111110101',
  S: '111100111001111',
  T: '111010010010010',
  U: '101101101101111',
  V: '101101101101010',
  W: '101101111111101',
  X: '101101010101101',
  Y: '101101010010010',
  Z: '111001010100111',
  '-': '000000111000000',
  '.': '000000000000010',
  '/': '001001010100100',
  ' ': '000000000000000',
};

const GLYPH_W = 3;
const GLYPH_H = 5;

export interface TextMaskOptions {
  /** Voxels per font pixel. */
  scale: number;
  pal: number;
  /** Mirrors the glyph columns so the text still reads nose-first. */
  flip?: boolean;
  /** Blank columns between glyphs, in font pixels. */
  tracking?: number;
}

/**
 * Builds a stencil for a string. The mask is centred on the text block, so
 * callers position it by its middle like any other decal.
 */
export function textMask(text: string, opts: TextMaskOptions): { mask: Mask; width: number; height: number } {
  const chars = text.toUpperCase().split('');
  const tracking = opts.tracking ?? 1;
  const s = opts.scale;
  const cols = chars.length * GLYPH_W + Math.max(0, chars.length - 1) * tracking;
  const width = cols * s;
  const height = GLYPH_H * s;
  const halfW = width / 2;
  const halfH = height / 2;

  const mask: Mask = (u, v) => {
    // u runs aft-to-forward along the body; text reads nose-first.
    const uu = opts.flip ? -u : u;
    const col = Math.floor((halfW - uu) / s);
    const row = Math.floor((halfH - v) / s);
    if (col < 0 || col >= cols || row < 0 || row >= GLYPH_H) return 0;
    const slot = Math.floor(col / (GLYPH_W + tracking));
    const inGlyph = col - slot * (GLYPH_W + tracking);
    if (inGlyph >= GLYPH_W) return 0;
    const bits = FONT[chars[slot]] ?? FONT[' '];
    return bits[row * GLYPH_W + inGlyph] === '1' ? opts.pal : 0;
  };

  return { mask, width, height };
}

const BODY_PARTS = new Set(
  (['fuselage', 'nose', 'spine', 'lerx', 'intake-l', 'intake-r'] as PartId[]).map(
    (id) => PART_INDEX[id],
  ),
);
const FIN_PARTS = new Set(
  (['tail-v', 'tail-v-l', 'tail-v-r'] as PartId[]).map((id) => PART_INDEX[id]),
);

export function buildLettering(ctx: BuildCtx, items: LetteringParams[]): void {
  const part = PART_INDEX.marking;
  for (const item of items) {
    const pal = ctx.slot(item.palette, 'skinDark');
    const scale = Math.max(1, Math.round(ctx.v(item.size ?? 0.12)));
    const cz = ctx.gzAft(item.atZ);
    const cy = ctx.gy(item.atY);
    const allow = item.on === 'fin' ? (q: number) => FIN_PARTS.has(q) : (q: number) => BODY_PARTS.has(q);

    for (const side of [1, -1] as const) {
      const { mask, width, height } = textMask(item.text, {
        scale,
        pal,
        flip: side < 0,
      });
      paintSide(ctx.grid, side, cy, cz, Math.max(width, height), mask, part, allow);
    }
  }
}
