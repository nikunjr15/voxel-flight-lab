import type { PaletteSlot } from '../engine/voxel/palette';
import type { PartId } from '../engine/voxel/parts';

export type Generation = '1' | '2' | '3' | '4' | '4.5' | '5' | '6-concept';

export type EngineType =
  | 'turbojet'
  | 'afterburning-turbojet'
  | 'turbofan'
  | 'afterburning-turbofan';

export type CountryCode = 'DE' | 'US' | 'SU' | 'RU' | 'FR' | 'UK' | 'IN' | 'SE' | 'CN' | 'EU' | 'JP';

export type AircraftStatus = 'historic' | 'in-service' | 'development' | 'concept';

/**
 * Only values we are confident about are present. Anything uncertain is left
 * out entirely rather than guessed; the UI hides missing rows.
 */
export interface AircraftSpec {
  firstFlight: number;
  machMax?: number;
  topSpeedKmh?: number;
  engines: { count: number; type: EngineType; name?: string };
  crew: number;
  role: string;
  country: CountryCode;
  generation: Generation;
  lengthM: number;
  spanM: number;
  heightM: number;
  status: AircraftStatus;
}

export interface Annotation {
  n: string;
  title: string;
  body: string;
}

export interface AircraftCopy {
  category: string;
  subtitle: [string, string];
  annotations: Annotation[];
}

/* ---------- geometry, all dimensions in metres ---------- */

/** Cross-section at `t`, the fraction of overall length aft of the nose. */
export interface FuselageStation {
  t: number;
  /** Half-width. */
  w: number;
  /** Half-height. */
  h: number;
  /** Centreline height above the waterline. */
  y?: number;
  /** Superellipse exponent: 2 is a pure ellipse, 4 is near-rectangular. */
  e?: number;
}

export interface FuselageParams {
  length: number;
  stations: FuselageStation[];
  /** Fraction of length treated as radome, then as forward fuselage. */
  radomeTo?: number;
  noseTo?: number;
  spine?: { from: number; to: number; halfWidth: number; height: number };
}

export type SurfaceKind =
  | 'delta'
  | 'cranked-delta'
  | 'swept'
  | 'straight'
  | 'trapezoid'
  | 'diamond'
  | 'variable-geometry'
  | 'canard';

/** A lifting surface pair, or a single fin when used as a tail. */
export interface SurfaceParams {
  kind?: SurfaceKind;
  /** Tip to tip for pairs; height above the root for a fin. */
  span: number;
  rootChord: number;
  tipChord: number;
  /** Leading-edge sweep, degrees. */
  sweep: number;
  dihedral?: number;
  /** Lateral cant for fins, degrees from vertical. */
  cant?: number;
  thickness: number;
  /** Root leading edge, metres aft of the nose. */
  atZ: number;
  /** Root height above the waterline. */
  atY: number;
  /** Lateral offset of the root, metres from the centreline. */
  rootOffset?: number;
  /** Lateral offset of a fin pair from the centreline. */
  separation?: number;
  kink?: { at: number; chord: number; sweep: number };
  roundTip?: boolean;
  tipThicknessRatio?: number;
  palette?: PaletteSlot;
}

export interface LerxParams {
  fromZ: number;
  toZ: number;
  maxHalfWidth: number;
  atY: number;
  thickness: number;
}

export type CockpitTier = 'analog' | 'mfd' | 'hmd';

export interface CanopyParams {
  fromZ: number;
  toZ: number;
  baseY: number;
  topY: number;
  halfWidth: number;
  tier: CockpitTier;
  /** Adds a bow frame at the front of the glazing. */
  framed?: boolean;
  /** Crew seated in tandem. */
  seats?: number;
}

export type IntakeKind =
  | 'chin'
  | 'side-rect'
  | 'side-half-cone'
  | 'nose'
  | 'dorsal'
  | 'caret'
  | 'dsi';

export interface IntakeParams {
  kind: IntakeKind;
  /** Lip plane, metres aft of the nose. */
  atZ: number;
  length: number;
  halfWidth: number;
  height: number;
  atY: number;
  /** Lateral centre for side intakes. */
  offsetX?: number;
  /** Carves a duct through the fuselage toward the engine face. */
  duct?: boolean;
}

export type NozzleKind = 'round' | 'twin-round' | 'vectoring-2d' | 'serrated';

export interface NozzleParams {
  kind: NozzleKind;
  /** Exit plane, metres aft of the nose. */
  atZ: number;
  radius: number;
  atY?: number;
  separation?: number;
  length?: number;
  /** Where the engine core starts, metres aft of the nose. */
  engineFromZ?: number;
  engineRadius?: number;
}

export type BlockShape = 'box' | 'ellipsoid';

/** Escape hatch for small details that do not deserve their own builder. */
export interface BlockParams {
  shape: BlockShape;
  /** Centre: x from the centreline, y above the waterline, z aft of the nose. */
  at: [number, number, number];
  /** Full size in metres. */
  size: [number, number, number];
  part: PartId;
  palette?: PaletteSlot;
  mirror?: boolean;
  exponent?: number;
}

export type MarkingStyle = 'roundel' | 'star' | 'star-bar' | 'cross' | 'disc' | 'none';

/**
 * National markings are stylised, not reproductions: concentric rings, a star
 * or a cross, drawn voxel by voxel. No manufacturer marks anywhere.
 */
export interface MarkingParams {
  style?: MarkingStyle;
  /** Metres aft of the nose for the fuselage-side marking. */
  fuselageZ?: number;
  /** Wing marking centre: metres outboard and metres aft of the nose. */
  wing?: { x: number; z: number };
  radius: number;
  tailFlash?: boolean;
}

export interface AircraftGeometry {
  /** Used to size the voxel grid. */
  bbox: { span: number; height: number };
  fuselage: FuselageParams;
  lerx?: LerxParams;
  wing: SurfaceParams;
  canard?: SurfaceParams;
  tailH?: SurfaceParams;
  tailV?: SurfaceParams;
  /** Twin fins; `separation` sets the lateral offset of each. */
  tailVTwin?: SurfaceParams;
  ventral?: SurfaceParams;
  intakes: IntakeParams[];
  nozzle: NozzleParams;
  canopy: CanopyParams;
  blocks?: BlockParams[];
  markings?: MarkingParams;
}

export interface AircraftConfig {
  id: string;
  name: string;
  designation: string;
  exhibitNo: string;
  chapter: number;
  spec: AircraftSpec;
  copy: AircraftCopy;
  palette: Partial<Record<PaletteSlot, string>>;
  geometry: AircraftGeometry;
}
