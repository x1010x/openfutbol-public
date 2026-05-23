export const COUNTRY_NAMES: Record<string, string> = {
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

export const countryName = (code: string): string =>
  COUNTRY_NAMES[code.toUpperCase()] ?? code.toUpperCase();

export const flagPath = (code: string): string =>
  `${import.meta.env.BASE_URL}assets/flags/${code.toLowerCase()}.svg`;
