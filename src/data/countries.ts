const COUNTRY_NAMES_ES: Record<string, string> = {
  ES: 'España',
  GB: 'Reino Unido',
  DE: 'Alemania',
  FR: 'Francia',
  IT: 'Italia',
  PT: 'Portugal',
  NL: 'Países Bajos',
  BE: 'Bélgica',
  PL: 'Polonia',
  CZ: 'Rep. Checa',
  SE: 'Suecia',
  RU: 'Rusia',
  IL: 'Israel',
  AR: 'Argentina',
  BR: 'Brasil',
  editor: 'Mis Equipos',
  unknown: '—',
};

const COUNTRY_NAMES_EN: Record<string, string> = {
  ES: 'Spain',
  GB: 'United Kingdom',
  DE: 'Germany',
  FR: 'France',
  IT: 'Italy',
  PT: 'Portugal',
  NL: 'Netherlands',
  BE: 'Belgium',
  PL: 'Poland',
  CZ: 'Czech Rep.',
  SE: 'Sweden',
  RU: 'Russia',
  IL: 'Israel',
  AR: 'Argentina',
  BR: 'Brazil',
  editor: 'My Teams',
  unknown: '—',
};

import { getLang } from '../i18n';

export const countryName = (code: string): string => {
  const names = getLang() === 'en' ? COUNTRY_NAMES_EN : COUNTRY_NAMES_ES;
  return names[code.toUpperCase()] ?? code.toUpperCase();
};

export const flagPath = (code: string): string =>
  `${import.meta.env.BASE_URL}assets/flags/${code.toLowerCase()}.svg`;
