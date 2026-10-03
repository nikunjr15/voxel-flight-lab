/**
 * Every icon on the site, drawn in code. 24-unit grid, 1.5 stroke, current
 * colour, so they inherit ink and accent from the element they sit in.
 */

const svg = (body: string, size = 14): string =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" ` +
  `stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

export const ICONS = {
  /** Corner brackets around a dot: the framed hero shot. */
  overview: svg(
    '<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/><circle cx="12" cy="12" r="2.2"/>',
  ),
  /** Plan: a square with its centrelines, as on a three-view drawing. */
  plan: svg('<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M12 4v16M4 12h16" stroke-dasharray="1.5 2.5"/>'),
  /** Cockpit: canopy bow over a sill. */
  cockpit: svg('<path d="M3.5 16.5c1.8-5.6 5.3-8.5 8.5-8.5s6.7 2.9 8.5 8.5"/><path d="M3 16.5h18"/><path d="M12 8v8.5"/>'),
  /** Engines: compressor face, hub and three blades. */
  engines: svg(
    '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="1.8"/><path d="M12 10.2V4.5M13.6 12.9l4.9 2.8M10.4 12.9l-4.9 2.8"/>',
  ),
  /** Weapons: a missile with tail fins, nose up and right. */
  weapons: svg('<path d="M6 18 17.5 6.5"/><path d="M17.5 6.5 20 4l-1 3.5"/><path d="M8.5 15.5 5 15l-1 1M8.5 15.5 9 19l-1 1"/>'),
  /** X-ray: three layers lifted apart. */
  xray: svg('<path d="m12 4 8 4-8 4-8-4 8-4Z"/><path d="m4 12 8 4 8-4" opacity=".7"/><path d="m4 16 8 4 8-4" opacity=".45"/>'),
  /** Orbit: an ellipse with a direction arrow. */
  orbit: svg('<ellipse cx="12" cy="12" rx="8.5" ry="4.5"/><path d="m17.5 5.5 2.6 2.8-3.6.9"/>'),
  /** Thrust: a flame. */
  thrust: svg('<path d="M12 3.5c3.5 4 5 6.6 5 9.5a5 5 0 0 1-10 0c0-1.7.7-3.1 1.8-4.4.2 1.4.9 2.4 2 2.9-.4-2.6.1-5.3 1.2-8Z"/>'),
  /** Sound: a speaker with two waves. */
  sound: svg('<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M15.5 9.5a3.5 3.5 0 0 1 0 5M18 7a7 7 0 0 1 0 10"/>'),
} as const;

export type IconId = keyof typeof ICONS;
