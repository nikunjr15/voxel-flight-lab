import type { AircraftConfig, Annotation, IntakeKind } from '../aircraft/types';
import type { ModeId } from '../app/store';

/**
 * Note cards for each view mode. Everything here is assembled from the
 * aircraft's own data -- engine count and type, crew, cockpit era, intake
 * layout, what the model actually carries -- so a card can only say what the
 * data says. Where a sentence would need a fact the data does not hold, the
 * sentence is not written.
 */

const ENGINE_WORD: Record<AircraftConfig['spec']['engines']['type'], [string, string]> = {
  turbojet: ['turbojet', 'turbojets'],
  'afterburning-turbojet': ['afterburning turbojet', 'afterburning turbojets'],
  turbofan: ['turbofan', 'turbofans'],
  'afterburning-turbofan': ['afterburning turbofan', 'afterburning turbofans'],
};

const NUMBER = ['No', 'One', 'Two', 'Three', 'Four'];

const INTAKE: Record<IntakeKind, { title: string; body: string }> = {
  nose: {
    title: 'Nose intake',
    body: 'Air enters through a ring at the very front of the fuselage and runs the length of the aircraft to the engine.',
  },
  chin: {
    title: 'Chin intake',
    body: 'A single inlet under the nose. The forward fuselage shields it, so it keeps feeding the engines at high angles of attack.',
  },
  'side-rect': {
    title: 'Side intakes',
    body: 'Rectangular inlets either side of the fuselage, each standing off the skin so the slow air clinging to it is not swallowed.',
  },
  'side-half-cone': {
    title: 'Half-cone side intakes',
    body: 'A half cone in each side inlet positions the shock wave at supersonic speed, slowing the air before it reaches the engine.',
  },
  caret: {
    title: 'Caret intakes',
    body: 'The inlet lip is a single swept plane, angled so that its edges line up with the rest of the airframe.',
  },
  dsi: {
    title: 'Diverterless intakes',
    body: 'A shaped bump ahead of each inlet pushes the boundary-layer air aside, replacing the splitter plate and its gap.',
  },
  dorsal: {
    title: 'Dorsal intakes',
    body: 'The inlets sit on top of the aircraft, where the body hides them from anything looking up from below.',
  },
};

const card = (i: number, title: string, body: string): Annotation => ({
  n: String(i + 1).padStart(2, '0'),
  title,
  body,
});

const number = (nn: Annotation[]): Annotation[] => nn.map((a, i) => ({ ...a, n: String(i + 1).padStart(2, '0') }));

export interface ModeCopyContext {
  /** Surface voxels in the model as built. */
  voxels?: number;
  /** Distinct parts present in the model. */
  parts?: number;
}

export function modeCards(mode: ModeId, c: AircraftConfig, ctx: ModeCopyContext = {}): Annotation[] {
  switch (mode) {
    case 'overview':
      return c.copy.annotations;
    case 'plan':
      return planCards(c);
    case 'cockpit':
      return cockpitCards(c);
    case 'engines':
      return engineCards(c);
    case 'weapons':
      return weaponCards(c);
    case 'xray':
      return xrayCards(c, ctx);
  }
}

function planCards(c: AircraftConfig): Annotation[] {
  const g = c.geometry;
  const s = c.spec;
  const out: Annotation[] = [];
  out.push(
    s.lengthM !== undefined && s.spanM !== undefined
      ? card(0, 'Span and length', `${s.spanM} m from tip to tip and ${s.lengthM} m from nose to tail, approximately. Drawn to scale from above.`)
      : card(0, 'Span and length', 'Not published. The model is drawn to an assumed size so it can stand beside the others at honest relative scale.'),
  );
  if (g.wing.vg) {
    out.push(
      card(0, 'A wing that moves', `The outer wing pivots, from ${g.wing.vg.sweepMin}° spread for take-off and landing to ${g.wing.vg.sweepMax}° swept for high speed. The slider moves it.`),
    );
  }
  if (g.canard) {
    out.push(card(0, 'Canards', 'A second, smaller pair of surfaces ahead of the wing. From above they are the clearest sign of a canard layout.'));
  }
  if (g.levcon) {
    out.push(card(0, 'Movable root extensions', 'The hinged surfaces between the cockpit and the wing are part of the root extension, not separate foreplanes.'));
  }
  if (!g.tailV && !g.tailVTwin && !g.tailVee && !g.tailH) {
    out.push(card(0, 'No tail surfaces', 'Nothing behind the wing at all. Every control surface the aircraft has is on the one planform.'));
  }
  out.push(
    card(0, 'Reading a planform', 'From directly above, the wing shape is the plainest record of what an aircraft was built to do: sweep and delta for speed, span for endurance.'),
  );
  return number(out.slice(0, 3));
}

function cockpitCards(c: AircraftConfig): Annotation[] {
  const p = c.geometry.canopy;
  const concept = c.spec.status === 'concept';
  const out: Annotation[] = [];
  if (concept) {
    out.push(
      card(0, 'Layout not published', 'Drawn as a generic glass cockpit with one wide display. Nothing about this interior is a disclosure.'),
    );
  } else {
    switch (p.tier) {
      case 'analog':
        out.push(
          card(0, 'Dials and a reflector sight', 'Airspeed, altitude and attitude are read from round dials. Aiming is through a reflector sight that projects a lit mark onto a pane of glass.'),
        );
        break;
      case 'mixed':
        out.push(
          card(0, 'Dials and the first screen', 'Round instruments still carry most of the information, beside a small display for the radar.'),
        );
        break;
      case 'mfd':
        out.push(
          card(0, 'A head-up display', 'Flight and aiming data are projected onto glass in the pilot\'s line of sight. Screens took over more of the panel from the dials as these types were upgraded.'),
        );
        break;
      case 'glass':
        out.push(
          p.hud === false
            ? card(0, 'No head-up display', 'One wide touchscreen fills the panel. Flight and aiming symbology are projected inside the helmet visor instead of onto a glass above the panel.')
            : card(0, 'Large displays', 'Big flat displays across the panel, with a head-up display kept above them.'),
        );
        break;
    }
  }
  const seats = p.seats ?? 1;
  out.push(
    seats > 1
      ? card(0, 'Two seats in tandem', 'Both cockpits are furnished. Only the front seat looks through the head-up display.')
      : card(0, 'One seat', `Crew of ${c.spec.crew}.`),
  );
  if (p.tier === 'analog' || p.tier === 'mixed') {
    out.push(card(0, 'The sight, lit', 'In this view the reflector sight is lit, as it would be in flight. From outside it is a pane of dark glass.'));
  } else if (p.hud !== false) {
    out.push(card(0, 'The HUD, lit', 'Symbology lights only in this view. From outside, the combiner is a small pane of dark glass.'));
  }
  return number(out);
}

function engineCards(c: AircraftConfig): Annotation[] {
  const e = c.spec.engines;
  const [one, many] = ENGINE_WORD[e.type];
  const g = c.geometry;
  const out: Annotation[] = [];
  out.push(
    card(
      0,
      `${NUMBER[e.count] ?? e.count} ${e.count === 1 ? one : many}`,
      `${e.name ? `${e.name}. ` : ''}${
        e.type.startsWith('afterburning')
          ? 'Burning extra fuel in the exhaust adds thrust for take-off, acceleration and combat, at a steep cost in fuel.'
          : 'No afterburner: thrust comes from the engine core alone.'
      }`,
    ),
  );
  if (g.nacelles?.length) {
    out.push(card(0, 'Engines in pods', 'Each engine hangs in its own nacelle under the wing, with its own intake and exhaust.'));
  } else if (g.intakes.length) {
    const kind = g.intakes[0].kind;
    out.push(card(0, INTAKE[kind].title, INTAKE[kind].body));
  }
  const bent = g.intakes.some((i) => i.sDuct);
  const stealth = c.spec.generation === '5' || c.spec.generation === '6-concept';
  if (bent) {
    out.push(
      card(
        0,
        'A duct that bends',
        stealth
          ? 'Between inlet and engine the duct curves, so the compressor face cannot be seen from in front. The particles follow the bend.'
          : 'Between inlet and engine the duct curves to reach the compressor face. The particles follow the bend.',
      ),
    );
  } else {
    out.push(card(0, 'Inlet to exhaust', 'The particles follow the air from the inlet, through the engine, and out of the nozzle.'));
  }
  return number(out);
}

function weaponCards(c: AircraftConfig): Annotation[] {
  const g = c.geometry;
  const out: Annotation[] = [];
  const loads = (g.stores ?? []).filter((s) => s.load);
  const count = (kind: string) =>
    loads.filter((s) => s.kind === kind).reduce((n, s) => n + (s.mirror ? 2 : 1), 0);
  const tanks = count('tank');
  const missiles = count('missile');

  if (g.bays?.length) {
    out.push(
      card(0, 'Internal bays', 'The doors open and the missiles are pushed clear of the airframe before launch. With the doors shut, the shaping is unbroken.'),
      card(0, 'Nothing outside', 'No pylons and no external stores in this configuration. Carrying them would undo much of what the shape is for.'),
    );
  }
  if (c.copy.armament) out.push(card(0, 'Guns', c.copy.armament));
  if (tanks + missiles > 0) {
    const parts: string[] = [];
    if (missiles) parts.push(`${missiles} missile${missiles > 1 ? 's' : ''}`);
    if (tanks) parts.push(`${tanks} drop tank${tanks > 1 ? 's' : ''}`);
    out.push(
      card(0, 'A typical load', `Shown: ${parts.join(' and ')}. Generic shapes typical of the era; no particular weapon types are claimed.`),
    );
  }
  const era: Record<string, [string, string]> = {
    '1': ['Guns first', 'For the first jet generation, guns were the air-to-air weapon. Range was measured in hundreds of metres.'],
    '2': ['The first guided missiles', 'Heat-seeking and early radar-guided missiles arrived beside the gun, and some designs briefly dropped the gun altogether.'],
    '3': ['Beyond visual range', 'Radar-guided missiles reached past the horizon of the pilot\'s eyes. The gun came back after combat showed it was still needed.'],
    '4': ['Missiles for every range', 'Short-range missiles for the turning fight, longer-range ones for the approach, and a gun kept for the last resort.'],
    '4.5': ['Carried for many roles', 'The same pylons take air-to-air missiles, ground-attack weapons or fuel. The load changes with the mission.'],
  };
  const e = era[c.spec.generation];
  if (e && out.length < 3) out.push(card(0, e[0], e[1]));
  return number(out.slice(0, 3));
}

function xrayCards(_c: AircraftConfig, ctx: ModeCopyContext): Annotation[] {
  const out = [
    card(0, 'Exploded view', 'Each part moves out along its own axis. The labels name the sections the model is built from, which follow its construction rather than the real aircraft\'s production breaks.'),
    card(0, 'Drag to separate', 'The slider runs from fully assembled to fully apart.'),
  ];
  if (ctx.voxels && ctx.parts) {
    out.push(card(0, 'What it is made of', `${ctx.voxels.toLocaleString('en-US')} visible blocks across ${ctx.parts} tagged parts.`));
  }
  return number(out);
}

/** Cards for the radar-signature view on stealth aircraft. */
export function radarCards(): Annotation[] {
  return number([
    card(0, 'Illustrative, not measured', 'The shells show where shaping sends radar energy, not how much. No measured signature data is used or implied.'),
    card(0, 'Spikes, not a glow', 'Edges set parallel to one another reflect into a few narrow directions. Between those spikes, the stealth shell is nearly dark.'),
    card(0, 'Against a fourth-generation shape', 'Round bodies, upright fins and external stores return energy broadly in almost every direction.'),
  ]);
}
