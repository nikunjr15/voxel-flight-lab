import type { CountryCode, MarkingStyle } from './types';

export interface CountryMarking {
  style: MarkingStyle;
  /** Outer to inner for roundels; disc then device for stars and crosses. */
  colors: string[];
  /**
   * Vertical tail flash, listed leading edge first. Only for air forces that
   * actually carry one: the USAF uses tail codes instead, and Soviet, Russian
   * and Chinese fins carry the star rather than a band. Omitted for Germany,
   * because a modern black-red-gold flash would be wrong on a Me 262 and the
   * wartime fin marking is one this project will not draw.
   */
  finFlash?: string[];
}

export interface Country {
  code: CountryCode;
  name: string;
  /** Three-segment colour bar under the subtitle. */
  bar: [string, string, string];
  marking: CountryMarking;
  accent: string;
}

export const COUNTRIES: Record<CountryCode, Country> = {
  DE: {
    code: 'DE',
    name: 'Germany',
    bar: ['#151515', '#c8102e', '#f0b323'],
    marking: { style: 'cross', colors: ['#f2f2f2', '#141414'] },
    accent: '#c8102e',
  },
  US: {
    code: 'US',
    name: 'United States',
    bar: ['#2a3b78', '#f2f2f2', '#b22234'],
    marking: { style: 'star-bar', colors: ['#2a3b78', '#f2f2f2', '#b22234'] },
    accent: '#2a3b78',
  },
  SU: {
    code: 'SU',
    name: 'Soviet Union',
    bar: ['#c21b17', '#f0c419', '#f2f2f2'],
    marking: { style: 'star', colors: ['#c21b17', '#f0c419'] },
    accent: '#c21b17',
  },
  RU: {
    code: 'RU',
    name: 'Russia',
    bar: ['#f2f2f2', '#1b3a8c', '#d52b1e'],
    marking: { style: 'star', colors: ['#d52b1e', '#1b3a8c'] },
    accent: '#1b3a8c',
  },
  FR: {
    code: 'FR',
    name: 'France',
    bar: ['#002395', '#f2f2f2', '#ed2939'],
    marking: {
      style: 'roundel',
      colors: ['#002395', '#f2f2f2', '#ed2939'],
      finFlash: ['#002395', '#f2f2f2', '#ed2939'],
    },
    accent: '#002395',
  },
  UK: {
    code: 'UK',
    name: 'United Kingdom',
    bar: ['#012169', '#f2f2f2', '#c8102e'],
    marking: {
      style: 'roundel',
      colors: ['#012169', '#f2f2f2', '#c8102e'],
      finFlash: ['#c8102e', '#f2f2f2', '#012169'],
    },
    accent: '#012169',
  },
  IN: {
    code: 'IN',
    name: 'India',
    bar: ['#ff9933', '#f2f2f2', '#138808'],
    marking: {
      style: 'roundel',
      colors: ['#ff9933', '#f2f2f2', '#138808'],
      finFlash: ['#ff9933', '#f2f2f2', '#138808'],
    },
    accent: '#ff9933',
  },
  SE: {
    code: 'SE',
    name: 'Sweden',
    bar: ['#006aa7', '#fecc00', '#006aa7'],
    marking: { style: 'roundel', colors: ['#006aa7', '#fecc00', '#006aa7'] },
    accent: '#006aa7',
  },
  CN: {
    code: 'CN',
    name: 'China',
    bar: ['#de2910', '#ffde00', '#de2910'],
    marking: { style: 'star', colors: ['#de2910', '#ffde00'] },
    accent: '#de2910',
  },
  EU: {
    code: 'EU',
    name: 'Europe',
    bar: ['#1b3a8c', '#f2f2f2', '#f0c419'],
    marking: { style: 'roundel', colors: ['#1b3a8c', '#f2f2f2', '#f0c419'] },
    accent: '#1b3a8c',
  },
  JP: {
    code: 'JP',
    name: 'Japan',
    bar: ['#bc002d', '#f2f2f2', '#bc002d'],
    marking: { style: 'disc', colors: ['#bc002d'] },
    accent: '#bc002d',
  },
};

export const countryName = (code: CountryCode): string => COUNTRIES[code].name;
