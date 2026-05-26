import type { MatchState } from '../engine/types';

export interface Scenario {
  id: string;
  name: string;
  description: string;
  durationMs: number;
  build: (seed: number) => MatchState;
}
