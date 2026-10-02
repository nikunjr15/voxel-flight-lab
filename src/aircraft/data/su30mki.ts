import { SU27 } from './su27';
import type { AircraftConfig } from '../types';

/**
 * Sukhoi Su-30MKI. Derived from the Su-27 rather than copied: the airframe is
 * the same Flanker, and what the MKI adds -- canards on the root extensions, a
 * second seat, and nozzles that vector -- is expressed as overrides, so a fix
 * to the Flanker's shape reaches this one too.
 */
const base = structuredClone(SU27.geometry);

export const SU30MKI: AircraftConfig = {
  id: 'su-30mki',
  name: 'Su-30MKI',
  designation: 'Su-30MKI',
  exhibitNo: '018',
  chapter: 5,
  spec: {
    firstFlight: 1997,
    machMax: 2.0,
    engines: { count: 2, type: 'afterburning-turbofan' },
    crew: 2,
    role: 'Multirole fighter',
    country: 'IN',
    generation: '4.5',
    lengthM: 21.9,
    spanM: 14.7,
    heightM: 6.36,
    status: 'in-service',
  },
  copy: {
    category: 'TWIN-ENGINE TWO-SEAT MULTIROLE FIGHTER',
    subtitle: [
      'A Flanker with canards, a second crew member and nozzles',
      'that point where the fins cannot reach.',
    ],
    annotations: [
      {
        n: '01',
        title: 'Canards on the extensions',
        body: 'Small surfaces added to the leading-edge root extensions. They trim the aircraft at extreme angles and let it hold attitudes the original Su-27 could only pass through.',
      },
      {
        n: '02',
        title: 'Nozzles that vector',
        body: 'The exhausts swivel, so pitch and yaw control survive past the point where the fins and tailplane stop working. Agility below usable flying speed is the result.',
      },
      {
        n: '03',
        title: 'Assembled in India',
        body: 'Built under licence by HAL, with French and Israeli avionics on a Russian airframe. The MKI is the heaviest fighter in Indian service and the backbone of its fleet.',
      },
    ],
  },
  palette: {
    ...SU27.palette,
    skin: '#8c9aa4',
    skinLight: '#a6b2bb',
    skinDark: '#626f79',
    accent: '#ff9933',
  },
  geometry: {
    ...base,
    // Canards sit on the root extensions, just ahead of the wing.
    canard: {
      span: 6.8,
      rootOffset: 1.15,
      rootChord: 1.9,
      tipChord: 0.7,
      sweep: 52,
      dihedral: -4,
      thickness: 0.18,
      atZ: 7.0,
      atY: 0.42,
      roundTip: true,
      palette: 'skinDark',
    },
    // Second seat, under a longer canopy.
    canopy: {
      ...base.canopy,
      fromZ: 3.7,
      toZ: 8.2,
      topY: 1.5,
      seats: 2,
    },
    nozzle: {
      ...base.nozzle!,
      // Axisymmetric vectoring: the whole nozzle swings, unlike the F-22's
      // flat petals.
      vector: 14,
    },
    markings: {
      ...base.markings!,
      radius: 0.8,
    },
  },
};
