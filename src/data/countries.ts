const COUNTRY_NAMES_ES: Record<string, string> = {
  ES: 'España', GB: 'Reino Unido', DE: 'Alemania', FR: 'Francia', IT: 'Italia',
  PT: 'Portugal', NL: 'Países Bajos', BE: 'Bélgica', PL: 'Polonia', CZ: 'Rep. Checa',
  SE: 'Suecia', RU: 'Rusia', IL: 'Israel', AR: 'Argentina', BR: 'Brasil',
  AT: 'Austria', CH: 'Suiza', DK: 'Dinamarca', NO: 'Noruega', FI: 'Finlandia',
  GR: 'Grecia', TR: 'Turquía', UA: 'Ucrania', RO: 'Rumanía', HU: 'Hungría',
  HR: 'Croacia', RS: 'Serbia', SK: 'Eslovaquia', BG: 'Bulgaria', IE: 'Irlanda',
  SC: 'Escocia', WA: 'Gales', MX: 'México', US: 'EE. UU.', CA: 'Canadá',
  CO: 'Colombia', CL: 'Chile', UY: 'Uruguay', PY: 'Paraguay', PE: 'Perú',
  EC: 'Ecuador', JP: 'Japón', KR: 'Corea del Sur', CN: 'China', AU: 'Australia',
  SA: 'Arabia Saudí', AE: 'Em. Árabes', QA: 'Catar', MA: 'Marruecos', SN: 'Senegal',
  CI: 'Costa de Marfil', NG: 'Nigeria', CM: 'Camerún', GH: 'Ghana', EG: 'Egipto',
  ZA: 'Sudáfrica', DZ: 'Argelia',
  editor: 'Mis Equipos', unknown: '—',
};

const COUNTRY_NAMES_EN: Record<string, string> = {
  ES: 'Spain', GB: 'United Kingdom', DE: 'Germany', FR: 'France', IT: 'Italy',
  PT: 'Portugal', NL: 'Netherlands', BE: 'Belgium', PL: 'Poland', CZ: 'Czech Rep.',
  SE: 'Sweden', RU: 'Russia', IL: 'Israel', AR: 'Argentina', BR: 'Brazil',
  AT: 'Austria', CH: 'Switzerland', DK: 'Denmark', NO: 'Norway', FI: 'Finland',
  GR: 'Greece', TR: 'Turkey', UA: 'Ukraine', RO: 'Romania', HU: 'Hungary',
  HR: 'Croatia', RS: 'Serbia', SK: 'Slovakia', BG: 'Bulgaria', IE: 'Ireland',
  SC: 'Scotland', WA: 'Wales', MX: 'Mexico', US: 'USA', CA: 'Canada',
  CO: 'Colombia', CL: 'Chile', UY: 'Uruguay', PY: 'Paraguay', PE: 'Peru',
  EC: 'Ecuador', JP: 'Japan', KR: 'South Korea', CN: 'China', AU: 'Australia',
  SA: 'Saudi Arabia', AE: 'UAE', QA: 'Qatar', MA: 'Morocco', SN: 'Senegal',
  CI: 'Ivory Coast', NG: 'Nigeria', CM: 'Cameroon', GH: 'Ghana', EG: 'Egypt',
  ZA: 'South Africa', DZ: 'Algeria',
  editor: 'My Teams', unknown: '—',
};

import { getLang } from '../i18n';

export const countryName = (code: string): string => {
  const names = getLang() === 'en' ? COUNTRY_NAMES_EN : COUNTRY_NAMES_ES;
  return names[code.toUpperCase()] ?? code.toUpperCase();
};

export const flagPath = (code: string): string =>
  `${import.meta.env.BASE_URL}assets/flags/${code.toLowerCase()}.svg`;
