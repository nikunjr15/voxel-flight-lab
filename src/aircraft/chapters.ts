/**
 * Chapter copy: the era each chapter covers, a short summary, and the one
 * innovation it is built around. Kept apart from the aircraft so a chapter can
 * be reworded without touching any airframe.
 *
 * As with the aircraft, nothing here is a number we are unsure of.
 */
export interface ChapterInfo {
  n: number;
  /** Display label, as in "04". */
  label: string;
  title: string;
  era: string;
  summary: string;
  innovation: { title: string; body: string };
}

export const CHAPTERS: ChapterInfo[] = [
  {
    n: 0,
    label: '00',
    title: 'Voxel Flight Lab',
    era: 'Introduction',
    summary:
      'Jet fighters from the first operational jets of the 1940s to concepts that have not yet flown, one era to a chapter. Scroll to move through the eras; pick an aircraft from the strip at the top, or step with the arrow keys.',
    innovation: {
      title: 'Built from a description',
      body: 'No models, images or textures are loaded. Each airframe is generated in code from a short list of its dimensions and shapes, so a new aircraft is a new description rather than new artwork.',
    },
  },
  {
    n: 1,
    label: '01',
    title: 'First generation',
    era: '1940s – 50s',
    summary:
      'The jet engine arrived at the end of the Second World War and made the piston fighter obsolete within a decade. Swept-wing research spread to both sides of the Cold War, and the first battles between jets were fought over Korea.',
    innovation: {
      title: 'The swept wing',
      body: 'Sweeping the wing back delays the sharp rise in drag as an aircraft approaches the speed of sound. Almost every fighter since has used it.',
    },
  },
  {
    n: 2,
    label: '02',
    title: 'Second generation',
    era: '1950s – 60s',
    summary:
      'Speed became the measure of a fighter. Designers reached Mach 2 with tiny, thin wings or with large deltas, fitted the first air-intercept radars, and began to arm fighters with guided missiles as well as guns.',
    innovation: {
      title: 'Guided missiles',
      body: 'A missile that steers itself to the target changed the fight from a contest of gunnery to one of sensors, and every generation since has been shaped by it.',
    },
  },
  {
    n: 3,
    label: '03',
    title: 'Third generation',
    era: '1960s – 70s',
    summary:
      'Combat over Vietnam showed that missiles alone were not enough and that a fighter still had to turn. Radars grew, aircraft took on several roles at once, and variable-sweep wings tried to be fast and slow in one airframe.',
    innovation: {
      title: 'Wings that move',
      body: 'Spread forward for take-off and loiter, swept back for the dash. It worked, at the cost of heavy, complicated pivots that later designs found other ways to avoid.',
    },
  },
  {
    n: 4,
    label: '04',
    title: 'Fourth generation',
    era: '1970s – 90s',
    summary:
      'Energy-manoeuvrability theory reshaped fighters around thrust and turning performance. Fly-by-wire let designers build aircraft that were deliberately unstable and more agile for it, and some carried more thrust than they weighed at combat loads.',
    innovation: {
      title: 'Fly-by-wire',
      body: 'Replacing cables with computers let the flight-control system fly an aircraft no pilot could hold steady unaided, and turned instability into agility.',
    },
  },
  {
    n: 5,
    label: '05',
    title: 'Generation 4.5',
    era: '1990s – now',
    summary:
      'Fourth-generation ideas refined rather than replaced: canard-delta layouts, electronically scanned radars, data links and sensor fusion. Some of these aircraft can sustain supersonic flight without afterburner.',
    innovation: {
      title: 'Sensor fusion',
      body: 'Radar, infra-red and electronic surveillance are merged into one picture before the pilot sees anything, instead of the pilot assembling it from separate screens.',
    },
  },
  {
    n: 6,
    label: '06',
    title: 'Fifth generation',
    era: '2000s – now',
    summary:
      'Stealth moved from a specialist trait to a fighter requirement. Airframes are shaped so radar energy leaves in a few known directions, weapons ride inside, and markings fade to low-visibility greys so the paint gives away no more than the shape does.',
    innovation: {
      title: 'Low-observable shaping',
      body: 'Flat planes, hard chines and edges set parallel to one another concentrate reflections into a few narrow spikes. The aircraft is designed around where those spikes point.',
    },
  },
  {
    n: 7,
    label: '07',
    title: 'Next generation',
    era: 'Concepts',
    summary:
      'None of these aircraft has flown. Sixth-generation programmes describe a crewed fighter at the centre of a team of uncrewed aircraft, with more of the work handed to software, and some drop the vertical tail altogether. Everything in this chapter is a concept.',
    innovation: {
      title: 'Crewed and uncrewed together',
      body: 'Loyal-wingman drones fly alongside the crewed aircraft, carrying sensors and weapons into places it would rather not go. The fighter becomes the team leader.',
    },
  },
  {
    n: 8,
    label: '08',
    title: 'Compare',
    era: 'Any two',
    summary:
      'Pick two aircraft and stand them side by side on one turntable, at true relative scale.',
    innovation: {
      title: 'True scale',
      body: 'Both models are built to the same block size, so the difference in size is the real one.',
    },
  },
];

export const chapterInfo = (n: number): ChapterInfo | undefined => CHAPTERS.find((c) => c.n === n);

/** Chapters that show aircraft of their own. The introduction and Compare do not. */
export const hasJets = (n: number): boolean => n >= 1 && n <= 7;
