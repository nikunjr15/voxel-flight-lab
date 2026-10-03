import { wingChordZ } from './planform';
import { PART_INDEX, PartId } from '../voxel/parts';
import { Mask, paintSide, paintTop } from './decals';
import type { CountryMarking } from '../../aircraft/countries';
import type { MarkingParams, SurfaceParams } from '../../aircraft/types';
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

/** Voxels of radius each roundel ring needs to survive rasterising. */
const RING_VOXELS = 1.8;
/** How far a placement may be enlarged to keep every band before it is skipped. */
const MAX_ENLARGE = 1.6;

/**
 * The radius a marking is actually painted at, or 0 to skip the placement.
 *
 * Most roundels may shed interior bands when they get small. Some may not --
 * an Indian roundel without its white ring is not an Indian roundel -- so for
 * those the placement is enlarged until every band fits, within reason, and
 * skipped when even that would not be enough.
 */
function placementRadius(marking: CountryMarking, radius: number): number {
  if (marking.style !== 'roundel' || !marking.allBands) return radius;
  const needed = marking.colors.length * RING_VOXELS;
  if (radius >= needed) return radius;
  return radius * MAX_ENLARGE >= needed ? needed : 0;
}

/**
 * Builds a 2D mask returning a palette index, or 0 for "leave the skin alone".
 * `u` runs along the chord, `v` across it, both in voxel units from the centre.
 */
function maskFor(
  ctx: BuildCtx,
  marking: CountryMarking,
  radius: number,
  allowBars = true,
): Mask {
  const pal = marking.colors.map((c) => ctx.pal.add(c, 'opaque'));

  switch (marking.style) {
    case 'disc':
      return (u, v) => (Math.hypot(u, v) <= radius ? pal[0] : 0);

    case 'roundel': {
      // A ring needs roughly two voxels of width to survive rasterising. A
      // three-band roundel on a fuselage side is often four or five voxels
      // across in total, and the middle band then breaks up: the Indian
      // roundel came out as a green cross on an orange blob. Drop interior
      // colours rather than the marking, always keeping the outermost and
      // innermost so the nation still reads.
      // The epsilon keeps a radius that placementRadius set to exactly
      // bands * RING_VOXELS from flooring one band short.
      const fits = Math.max(1, Math.min(pal.length, Math.floor(radius / RING_VOXELS + 1e-9)));
      const ringPal =
        fits === pal.length
          ? pal
          : fits === 1
            ? [pal[0]]
            : Array.from(
                { length: fits },
                (_, i) => pal[Math.round((i * (pal.length - 1)) / (fits - 1))],
              );
      const bands = ringPal.length;
      return (u, v) => {
        const d = Math.hypot(u, v);
        if (d > radius) return 0;
        // Colours are listed outermost first, so the innermost ring is the
        // last entry. Indexing straight off the radius put the first colour
        // in the centre and turned every roundel in the roster inside out:
        // French roundels came out blue-centred, Indian ones green-centred.
        const ring = Math.min(bands - 1, Math.floor((d / radius) * bands));
        return ringPal[bands - 1 - ring];
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
      const withBars = allowBars && radius >= 9;
      // Without bars the disc is all there is, so the star grows to fill it;
      // at 0.72 it erodes to an unreadable blob at exhibit sizes.
      const star = starPolygon(radius * (withBars ? 0.72 : 0.8));
      // Without bars the disc grows to the full radius so a blue ring still
      // frames the enlarged star instead of being eaten by it.
      const discR = radius * (withBars ? 0.82 : 1.0);
      const [blue, white, red] = [pal[0], pal[1] ?? pal[0], pal[2] ?? pal[0]];
      // Below roughly nine voxels across, the bars turn to noise. Below five,
      // the star goes too: a five-pointed polygon rasterised into eight or
      // nine voxels has no points left, and on a curved fuselage -- where
      // each row is painted onto whichever voxel is outermost -- it smears
      // into fragments. A plain disc at that size is clean and honest.
      const withStar = radius >= 5;
      const barLen = radius * 2.0;
      const barH = radius * 0.46;
      return (u, v) => {
        if (withBars) {
          const inBar = Math.abs(u) <= barLen && Math.abs(v) <= barH && Math.abs(u) > discR * 0.86;
          if (inBar) return Math.abs(u) > barLen * 0.84 ? red : white;
        }
        if (Math.hypot(u, v) > discR) return 0;
        if (!withStar) {
          // Too small for a star, but a bare disc is unreadable as a US
          // marking. A single horizontal bar echoes the stars and bars; a
          // cross would read as a medical or Greek cross instead.
          const arm = discR * 0.84;
          const bar = Math.max(0.6, discR * 0.3);
          return Math.abs(u) <= arm && Math.abs(v) <= bar ? white : blue;
        }
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
  (['fuselage', 'nose', 'spine', 'lerx', 'intake-l', 'intake-r', 'intake-c'] as PartId[]).map(
    (id) => PART_INDEX[id],
  ),
);
const FIN_PARTS = new Set(
  (['tail-v', 'tail-v-l', 'tail-v-r'] as PartId[]).map((id) => PART_INDEX[id]),
);

/** Fraction of the local fin chord the flash covers, measured from the trailing edge. */
const FLASH_CHORD = 0.42;
/** Fraction of the fin's height skipped at the root, where the fairing widens. */
const FLASH_ROOT_SKIP = 0.28;

/**
 * Paints a fin flash: vertical colour bands over the aft part of every
 * vertical tail, leading-edge colour first.
 *
 * The chord is measured off the grid one row at a time rather than recomputed
 * from the planform, so sweep, a clipped tip and a root fairing all come out
 * with bands that follow the real trailing edge, and a twin-finned airframe
 * needs no special case. Fins are only two or three voxels thick, so every
 * voxel in the station is painted; surface extraction discards whatever ends
 * up buried.
 */
function buildFinFlash(ctx: BuildCtx, colors: string[]): void {
  if (colors.length === 0) return;
  const { grid } = ctx;
  const pal = colors.map((c) => ctx.pal.add(c, 'opaque'));
  const part = ctx.p('marking');
  const isFin = (x: number, y: number, z: number): boolean =>
    grid.has(x, y, z) && FIN_PARTS.has(grid.partAt(x, y, z));

  // Pass 1: how high the fins stand, so the root fairing can be skipped.
  let yLow = -1;
  let yHigh = -1;
  for (let y = 0; y < grid.sy; y++) {
    let found = false;
    for (let z = 0; z < grid.sz && !found; z++) {
      for (let x = 0; x < grid.sx && !found; x++) found = isFin(x, y, z);
    }
    if (!found) continue;
    if (yLow < 0) yLow = y;
    yHigh = y;
  }
  if (yLow < 0 || yHigh - yLow < 3) return;
  const yStart = Math.round(yLow + (yHigh - yLow) * FLASH_ROOT_SKIP);

  // Pass 2: band each row across its own chord. Grid +Z points at the nose, so
  // the trailing edge is the low-Z end and the colours run down from zMax.
  for (let y = yStart; y <= yHigh; y++) {
    let zMin = -1;
    let zMax = -1;
    for (let z = 0; z < grid.sz; z++) {
      let hit = false;
      for (let x = 0; x < grid.sx && !hit; x++) hit = isFin(x, y, z);
      if (!hit) continue;
      if (zMin < 0) zMin = z;
      zMax = z;
    }
    if (zMin < 0) continue;
    const chord = zMax - zMin + 1;
    const flash = chord * FLASH_CHORD;
    // Narrower than one voxel per band and the flash is noise, not a marking.
    if (flash < colors.length) continue;
    for (let z = zMin; z < zMin + flash; z++) {
      const fromLe = (zMin + flash - 1 - z) / flash;
      const band = Math.min(colors.length - 1, Math.floor(fromLe * colors.length));
      for (let x = 0; x < grid.sx; x++) {
        if (isFin(x, y, z)) grid.paint(x, y, z, pal[band], part);
      }
    }
  }
}

export function buildMarkings(
  ctx: BuildCtx,
  p: MarkingParams,
  marking: CountryMarking,
  wing?: SurfaceParams,
): void {
  const style = p.style ?? marking.style;
  if (style === 'none') return;
  const part = ctx.p('marking');
  // Low-visibility schemes swap the national colours for tones of grey, on
  // the aircraft whose air force actually paints them that way.
  const colors = p.lowVis && marking.lowVis ? marking.lowVis : marking.colors;
  const resolved: CountryMarking = { ...marking, style, colors };
  const radius = ctx.v(p.radius);

  if (p.wing) {
    const r = placementRadius(resolved, radius);
    if (r > 0) {
      const mask = maskFor(ctx, resolved, r);
      // paintTop hands the mask (chordwise, spanwise). Every mask is drawn
      // with its bars along u and the star's top point toward -v, which is
      // the fuselage-side convention; on a wing the bars must run spanwise
      // and the point must face the nose, so the axes are swapped here.
      // Unswapped, the US bar ran fore and aft across the wing.
      const onWing: Mask = (u, v) => mask(v, -u);
      const zAft =
        p.wing.chord !== undefined && wing
          ? wingChordZ(wing, p.wing.x, p.wing.chord)
          : (p.wing.z ?? 0);
      for (const side of [1, -1] as const) {
        paintTop(ctx.grid, ctx.gx(p.wing.x * side), ctx.gzAft(zAft), r * 2.3, onWing, part, (q) =>
          WING_PARTS.has(q),
        );
      }
    }
  }

  if (p.fuselageZ !== undefined) {
    // Smaller than the wing insignia, as on the real aircraft. It used to be
    // smaller still, at 0.6, to limit how far a stencil projected straight
    // down the x axis smeared as it wrapped round the flank; paintSide now
    // walks the section in arc length, so the size can go back to something
    // closer to scale and the extra voxels keep the bands apart.
    const r = placementRadius(resolved, radius * 0.8);
    if (r > 0) {
      const mask = maskFor(ctx, resolved, r);
      // paintSide measures v upward; the mask's star points toward -v.
      const onSide: Mask = (u, v) => mask(u, -v);
      const cz = ctx.gzAft(p.fuselageZ);
      const cy = ctx.gy(0.1);
      for (const side of [1, -1] as const) {
        paintSide(ctx.grid, side, cy, cz, r * 2.3, onSide, part, (q) => BODY_PARTS.has(q));
      }
    }
  }

  if (p.tailFlash !== false && marking.finFlash) buildFinFlash(ctx, marking.finFlash);
}
