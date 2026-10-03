import type { AircraftConfig } from '../types';

/**
 * VAJRA. This aircraft is fictional. It is not a programme, a proposal or a
 * leak: it is the museum's own flagship, drawn to hold chapter 7's ideas on one
 * airframe so they can be looked at together.
 *
 * Built to read as nothing else in the roster from plan view alone: a
 * compound-delta leading edge carried over from the Tejas, a lambda notch in
 * the trailing edge, broad clipped tips, twin canted fins standing on separate
 * engine nacelles, and a pair of large afterburning nozzles held apart by a
 * tunnel. GCAP is a plain triangle with its fins at the root; NGAD has no fins
 * at all.
 *
 * Nothing about it should be read as a claim. Its numbers are modelling
 * choices, so the spec carries none of them.
 */
export const VAJRA: AircraftConfig = {
  id: 'vajra',
  name: 'VAJRA',
  designation: 'VAJRA',
  exhibitNo: '027',
  chapter: 7,
  spec: {
    engines: { count: 2, type: 'afterburning-turbofan' },
    crew: 1,
    role: 'Air dominance concept',
    country: 'IN',
    generation: '6-concept',
    status: 'concept',
  },
  copy: {
    category: 'FICTIONAL SIXTH-GENERATION CONCEPT',
    subtitle: [
      'Not a programme and not a proposal: the museum drawing',
      'one airframe to hold every idea in this chapter.',
    ],
    annotations: [
      {
        n: '01',
        title: 'Invented, and saying so',
        body: 'Every other aircraft here is real and drawn from the public record. This one is not. It exists so the chapter has something it is allowed to be specific about, and it carries no performance figures because there is nothing to measure.',
      },
      {
        n: '02',
        title: 'Fins kept, and canted hard',
        body: 'Where its neighbours give the vertical tail up altogether, VAJRA keeps two, leaning thirty degrees outboard and standing on the engine nacelles. It is the trade a fighter makes when it is still expected to turn: stability at high angles of attack, paid for in a larger side-on reflection.',
      },
      {
        n: '03',
        title: 'A Tejas leading edge on a lambda wing',
        body: 'The inner leading edge sweeps steeply and then breaks to a shallower outer panel, the compound delta India has flown since the Tejas. Behind it the trailing edge is notched, so the outer panels and broad clipped tips sit further aft than a plain delta would put them.',
      },
      {
        n: '04',
        title: 'Two big afterburners',
        body: 'Large round nozzles, set wide with a tunnel between them as on the Su-30MKI the Indian Air Force already flies. A flat, shielded exhaust would hide better; these are drawn for thrust first, and say so.',
      },
    ],
  },
  palette: {
    skin: '#5d656c',
    skinLight: '#737b82',
    skinDark: '#444b52',
    skinShade: '#50575e',
    frame: '#23282e',
    glass: '#c7a558',
    cockpit: '#20252b',
    seat: '#30363c',
    hud: '#7cf0c4',
    metal: '#868c92',
    nozzle: '#57534f',
    exhaust: '#6b3417',
    accent: '#ff9933',
    // Side number. Light on the dark scheme; dark digits on dark grey vanished.
    marking1: '#e4e6e8',
  },
  geometry: {
    bbox: { span: 14.2, height: 5.0 },
    // Chined body, nacelles and two big nozzles put the planform rule over the
    // voxel budget; resolution set directly.
    targetLengthVoxels: 116,
    fuselage: {
      length: 20.0,
      radomeTo: 0.05,
      noseTo: 0.24,
      stations: [
        { t: 0, w: 0.08, h: 0.07, y: 0.02, e: 2 },
        { t: 0.05, w: 0.44, h: 0.28, y: 0.0, e: 2.6, chine: 1, chineY: 0.4, chineTop: 0.24, chineBottom: 0.42 },
        { t: 0.14, w: 0.8, h: 0.48, y: -0.02, e: 3.2, chine: 1, chineY: 0.4, chineTop: 0.26, chineBottom: 0.44 },
        { t: 0.26, w: 1.02, h: 0.6, y: -0.06, e: 3.6, chine: 1, chineY: 0.42, chineTop: 0.34, chineBottom: 0.5 },
        { t: 0.4, w: 1.1, h: 0.6, y: -0.08, e: 3.8, chine: 0.9, chineY: 0.44, chineTop: 0.44, chineBottom: 0.56 },
        { t: 0.56, w: 1.04, h: 0.56, y: -0.08, e: 3.8, chine: 0.7, chineY: 0.46, chineTop: 0.5, chineBottom: 0.6 },
        { t: 0.72, w: 0.86, h: 0.48, y: -0.06, e: 3.4, chine: 0.4 },
        // Centre body narrows to a stinger between the nacelles.
        { t: 0.88, w: 0.56, h: 0.38, y: -0.04, e: 3 },
        { t: 1, w: 0.3, h: 0.26, y: -0.02, e: 2.6 },
      ],
      spine: { from: 6.4, to: 13.6, halfWidth: 0.42, height: 0.2 },
    },
    wing: {
      kind: 'cranked-delta',
      span: 13.8,
      rootOffset: 1.7,
      rootChord: 10.0,
      // Broad clipped tip. With the kink chord below it puts the outer
      // trailing edge aft of the inner one: the lambda notch.
      tipChord: 2.9,
      sweep: 58,
      // Compound-delta break, the Tejas idea at a larger scale.
      kink: { at: 0.4, chord: 5.4, sweep: 42 },
      dihedral: 0,
      thickness: 0.32,
      atZ: 7.0,
      atY: -0.1,
      tipThicknessRatio: 0.4,
    },
    tailVTwin: {
      // Leading edge on the outer wing's 42 degrees, so the fins add no new
      // edge angle to the airframe.
      span: 2.6,
      rootChord: 3.4,
      tipChord: 1.0,
      sweep: 42,
      cant: 30,
      separation: 1.42,
      thickness: 0.22,
      atZ: 15.2,
      atY: 0.3,
    },
    fairings: [
      {
        // Separate engine nacelles from the inlet to the nozzle, with a tunnel
        // of lifting body between them.
        // Sized to swallow the nozzle casing. At 0.66 by 0.6 the casing of a
        // 0.62 m nozzle stood proud of the nacelle top and its metal faces
        // caught the key light as cream patches ahead of the exit.
        at: [1.42, -0.1],
        fromZ: 5.8,
        toZ: 19.8,
        front: [0.52, 0.5],
        back: [0.8, 0.78],
        mirror: true,
        exponent: 3.4,
      },
    ],
    intakes: [
      {
        // Under the chine, shielded from below by the forebody.
        kind: 'caret',
        atZ: 5.8,
        length: 2.8,
        halfWidth: 0.46,
        height: 0.78,
        atY: -0.22,
        offsetX: 1.42,
        duct: true,
        sDuct: { toY: -0.12, toX: 1.42 },
      },
    ],
    nozzle: {
      kind: 'twin-round',
      atZ: 20.0,
      radius: 0.62,
      atY: -0.1,
      separation: 1.42,
      length: 2.3,
      engineFromZ: 12.6,
      engineRadius: 0.6,
      serrations: 12,
    },
    canopy: {
      fromZ: 2.9,
      toZ: 6.4,
      baseY: 0.36,
      topY: 1.22,
      halfWidth: 0.46,
      tier: 'hmd',
      seats: 1,
    },
    bays: [
      {
        fromZ: 8.0,
        toZ: 13.0,
        halfWidth: 0.78,
        atY: -0.24,
        depth: 0.38,
        doorOpen: 0,
      },
    ],
    lettering: [
      {
        // Side number on the forward fuselage, below and ahead of the cockpit.
        // Just below the chine edge, so the top stroke stays on the flank and
        // does not show from above. At two voxels per glyph pixel the digits
        // were taller than the flank and landed on the deck and keel.
        text: '02',
        on: 'fuselage',
        atZ: 4.4,
        atY: -0.26,
        size: 0.16,
        palette: 'marking1',
      },
    ],
    markings: {
      radius: 0.9,
      wing: { x: 4.1, chord: 0.45 },
      fuselageZ: 15.6,
    },
  },
};
