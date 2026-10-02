import { PART_INDEX, PartId } from '../voxel/parts';
import { Mask, paintSide, paintTop } from './decals';
import type { CountryMarking } from '../../aircraft/countries';
import type { MarkingParams } from '../../aircraft/types';
import type { BuildCtx } from './ctx';

/** Even-odd test against the ten vertices of a five-pointed star. */
function starPolygon(outer: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  const inner = outer * 0.382;
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

function pointInPolygon(pts: Array<[number, number]>, x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Builds a 2D mask returning a palette index, or 0 for "leave the skin alone".
 * `u` runs along the chord, `v` across it, both in voxel units from the centre.
 */
function maskFor(ctx: BuildCtx, marking: CountryMarking, radius: number): Mask {
  const pal = marking.colors.map((c) => ctx.pal.add(c, 'opaque'));

  switch (marking.style) {
    case 'disc':
      return (u, v) => (Math.hypot(u, v) <= radius ? pal[0] : 0);

    case 'roundel': {
      const bands = pal.length;
      return (u, v) => {
        const d = Math.hypot(u, v);
        if (d > radius) return 0;
        const band = Math.min(bands - 1, Math.floor((d / radius) * bands));
        return pal[band];
      };
    }

    case 'star': {
      const star = starPolygon(radius * 0.95);
      const inner = starPolygon(radius * 0.72);
      const outline = pal[1] ?? pal[0];
      // Below roughly eight voxels across, the outline ring eats the whole
      // star and the marking reads as a coloured blob. Drop it and keep the
      // solid shape, the same rule the star-and-bar uses for its bars.
      const outlined = radius >= 8;
      return (u, v) => {
        if (!pointInPolygon(star, u, v)) return 0;
        if (!outlined) return pal[0];
        return pointInPolygon(inner, u, v) ? pal[0] : outline;
      };
    }

    case 'star-bar': {
      const withBars = radius >= 9;
      // Without bars the disc is all there is, so the star grows to fill it;
      // at 0.72 it erodes to an unreadable blob at exhibit sizes.
      const star = starPolygon(radius * (withBars ? 0.72 : 0.8));
      // Without bars the disc grows to the full radius so a blue ring still
      // frames the enlarged star instead of being eaten by it.
      const discR = radius * (withBars ? 0.82 : 1.0);
      const [blue, white, red] = [pal[0], pal[1] ?? pal[0], pal[2] ?? pal[0]];
      // Below roughly nine voxels across, the bars turn to noise.
      const barLen = radius * 2.0;
      const barH = radius * 0.46;
      return (u, v) => {
        if (withBars) {
          const inBar = Math.abs(u) <= barLen && Math.abs(v) <= barH && Math.abs(u) > discR * 0.86;
          if (inBar) return Math.abs(u) > barLen * 0.84 ? red : white;
        }
        if (Math.hypot(u, v) > discR) return 0;
        return pointInPolygon(star, u, v) ? white : blue;
      };
    }

    case 'cross': {
      // Balkenkreuz: a white-edged bar cross.
      const arm = radius;
      const thick = radius * 0.34;
      const [light, dark] = [pal[0], pal[1] ?? pal[0]];
      return (u, v) => {
        const inOuter =
          (Math.abs(u) <= arm && Math.abs(v) <= thick * 1.7) ||
          (Math.abs(v) <= arm && Math.abs(u) <= thick * 1.7);
        if (!inOuter) return 0;
        const inInner =
          (Math.abs(u) <= arm * 0.78 && Math.abs(v) <= thick) ||
          (Math.abs(v) <= arm * 0.78 && Math.abs(u) <= thick);
        return inInner ? dark : light;
      };
    }

    default:
      return () => 0;
  }
}

const WING_PARTS = new Set(
  (['wing-l', 'wing-r', 'flap-l', 'flap-r', 'lerx'] as PartId[]).map((id) => PART_INDEX[id]),
);
const BODY_PARTS = new Set(
  (['fuselage', 'nose', 'spine', 'lerx'] as PartId[]).map((id) => PART_INDEX[id]),
);

export function buildMarkings(ctx: BuildCtx, p: MarkingParams, marking: CountryMarking): void {
  const style = p.style ?? marking.style;
  if (style === 'none') return;
  const radius = ctx.v(p.radius);
  const part = ctx.p('marking');

  if (p.wing) {
    const mask = maskFor(ctx, { ...marking, style }, radius);
    for (const side of [1, -1] as const) {
      paintTop(ctx.grid, ctx.gx(p.wing.x * side), ctx.gzAft(p.wing.z), radius * 2.3, mask, part, (q) =>
        WING_PARTS.has(q),
      );
    }
  }

  if (p.fuselageZ !== undefined) {
    const bodyRadius = radius * 0.72;
    const bodyMask = maskFor(ctx, { ...marking, style }, bodyRadius);
    const cz = ctx.gzAft(p.fuselageZ);
    const cy = ctx.gy(0.1);
    for (const side of [1, -1] as const) {
      paintSide(ctx.grid, side, cy, cz, bodyRadius * 2.3, bodyMask, part, (q) => BODY_PARTS.has(q));
    }
  }
}
