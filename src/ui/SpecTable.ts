import { COUNTRIES, type AircraftConfig } from '../aircraft';

const ENGINE_TYPE: Record<AircraftConfig['spec']['engines']['type'], string> = {
  turbojet: 'turbojet',
  'afterburning-turbojet': 'afterburning turbojet',
  turbofan: 'turbofan',
  'afterburning-turbofan': 'afterburning turbofan',
};

const STATUS: Record<AircraftConfig['spec']['status'], string> = {
  historic: 'Historic',
  'in-service': 'In service',
  development: 'In development',
  concept: 'Concept — has not flown',
};

/**
 * The specification as a real table, for screen readers and anyone reading
 * without the 3D view. Only fields we are sure of exist in the data, and a
 * missing field is a missing row, never a dash or a guess. Figures carry the
 * "approx." label the exhibit promises.
 */
export class SpecTable {
  readonly el: HTMLTableElement;
  private readonly body: HTMLTableSectionElement;
  private readonly caption: HTMLTableCaptionElement;

  constructor(mount: HTMLElement) {
    this.el = document.createElement('table');
    this.el.className = 'spec';
    this.caption = this.el.createCaption();
    this.body = this.el.createTBody();
    mount.appendChild(this.el);
  }

  show(c: AircraftConfig): void {
    const s = c.spec;
    this.caption.textContent = `${c.name} specifications (approximate)`;
    const rows: Array<[string, string | undefined]> = [
      ['First flight', s.firstFlight !== undefined ? String(s.firstFlight) : 'Not flown'],
      ['Maximum speed', s.machMax !== undefined ? `Mach ${s.machMax}, approx.` : undefined],
      [
        'Top speed',
        s.topSpeedKmh !== undefined ? `${s.topSpeedKmh.toLocaleString('en-US')} km/h, approx.` : undefined,
      ],
      ['Engines', `${s.engines.count} × ${ENGINE_TYPE[s.engines.type]}${s.engines.name ? ` (${s.engines.name})` : ''}`],
      ['Crew', String(s.crew)],
      ['Role', s.role],
      ['Country', COUNTRIES[s.country].name],
      ['Generation', s.generation === '6-concept' ? 'Sixth (concept)' : s.generation],
      ['Length', s.lengthM !== undefined ? `${s.lengthM} m, approx.` : undefined],
      ['Wingspan', s.spanM !== undefined ? `${s.spanM} m, approx.` : undefined],
      ['Height', s.heightM !== undefined ? `${s.heightM} m, approx.` : undefined],
      ['Status', STATUS[s.status]],
    ];

    this.body.innerHTML = '';
    for (const [k, v] of rows) {
      if (v === undefined) continue;
      const tr = this.body.insertRow();
      const th = document.createElement('th');
      th.scope = 'row';
      th.textContent = k;
      const td = document.createElement('td');
      td.textContent = v;
      tr.append(th, td);
    }
  }
}
