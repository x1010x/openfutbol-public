export interface MockGameState {
  teamName: string;
  teamShort: string;
  teamCrestColors: { primary: string; secondary: string };
  managerName: string;
  position: number;
  totalTeams: number;
  jornada: number;
  totalJornadas: number;
  points: number;
  goalDiff: number;
  cash: number;
  windowOpen: boolean;
  windowJornadasLeft?: number;
  florentinometro: number;
  gameMode: 'standard' | 'promanager';
}

export const MOCK_GAME_STATE: MockGameState = {
  teamName: 'CD Vallecas',
  teamShort: 'VAL',
  teamCrestColors: { primary: '#c8362e', secondary: '#ffd23f' },
  managerName: 'L. Sánchez',
  position: 4,
  totalTeams: 20,
  jornada: 12,
  totalJornadas: 38,
  points: 22,
  goalDiff: 5,
  cash: 3_500_000,
  windowOpen: false,
  florentinometro: 6.4,
  gameMode: 'promanager',
};
