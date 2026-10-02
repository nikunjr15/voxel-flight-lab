import { DEG, lerp } from '../util/math';
import type { SurfaceParams } from '../../aircraft/types';

/**
 * Where a chord fraction falls, in metres aft of the nose, at a station `x`
 * metres outboard. Mirrors the planform maths the rasteriser uses.
 *
 * Anything positioned on a swept wing by absolute Z drifts off it: at a 42
 * degree sweep the leading edge at the tip is five metres behind the root, so
 * a tip rail placed by Z ends up hanging in open air ahead of the wing. Both
 * markings and stores go through this instead.
 */
export function wingChordZ(wing: SurfaceParams, x: number, frac: number): number {
  const rootOffset = wing.rootOffset ?? 0;

  // On a swing wing the base planform is not what is actually built, so a
  // position has to be taken against the fixed glove. Outboard of the pivot
  // the panel moves with sweep and no fixed station exists.
  if (wing.vg) {
    const gloveSpan = Math.max(1e-6, wing.vg.pivotX - rootOffset);
    const gs = Math.min(Math.max(Math.abs(x) - rootOffset, 0), gloveSpan);
    const leRun = Math.tan(wing.vg.gloveSweep * DEG) * gloveSpan;
    const tip = Math.max(0.6, wing.vg.gloveChord - leRun);
    const le = Math.tan(wing.vg.gloveSweep * DEG) * gs;
    return wing.atZ + le + frac * lerp(wing.vg.gloveChord, tip, gs / gloveSpan);
  }

  const half = Math.max(1e-6, wing.span / 2 - rootOffset);
  const s = Math.min(Math.max(Math.abs(x) - rootOffset, 0), half);

  let le: number;
  let chord: number;
  const kinkAt = wing.kink ? half * wing.kink.at : half;
  if (wing.kink && s > kinkAt) {
    le = Math.tan(wing.sweep * DEG) * kinkAt + Math.tan(wing.kink.sweep * DEG) * (s - kinkAt);
    const t = (s - kinkAt) / Math.max(1e-6, half - kinkAt);
    chord = lerp(wing.kink.chord, wing.tipChord, t);
  } else {
    le = Math.tan(wing.sweep * DEG) * s;
    const end = wing.kink ? wing.kink.chord : wing.tipChord;
    chord = lerp(wing.rootChord, end, kinkAt <= 0 ? 0 : s / kinkAt);
  }
  return wing.atZ + le + frac * chord;
}
