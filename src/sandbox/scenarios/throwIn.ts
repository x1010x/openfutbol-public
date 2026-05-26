import type { Scenario } from '../types';
import { neutralInitialState } from '../presets';
import { startThrowIn } from '../../engine/phases';
import { snap as stateSnap } from '../../engine/state';

// `startThrowIn` snaps the throwInSpot.y to 0.0 (top) or 1.0 (bottom) based on
// the input sign. The ball settling logic anchors the ball to that spot during
// throw_in_setup, so we can just place the ball just off-pitch for the visual.

export const throwInHomeTop: Scenario = {
  id: 'throwin-home-top',
  name: 'Saque de banda — locales (banda superior)',
  description: 'Salida de banda en mediocampo, banda superior. El lateral local más cercano (slot 1) se acerca al punto y saca.',
  durationMs: 22_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    const spot = { x: 0.50, y: 0.0 };
    const takerId = state.homePlayers[1].id;
    startThrowIn(state, spot, takerId);
    state.ball = { x: spot.x, y: -0.03 };
    state.ballVel = { x: 0, y: 0 };
    state.ballHeight = 0;
    state.ballHeightVel = 0;
    stateSnap(state, 0);
    return state;
  },
};

export const throwInAwayBottom: Scenario = {
  id: 'throwin-away-bottom',
  name: 'Saque de banda — visitantes (banda inferior)',
  description: 'Salida de banda visitante en banda inferior. El lateral visitante slot 4 se acerca y saca.',
  durationMs: 22_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    const spot = { x: 0.55, y: 1.0 };
    const takerId = state.awayPlayers[4].id;
    startThrowIn(state, spot, takerId);
    state.ball = { x: spot.x, y: 1.03 };
    state.ballVel = { x: 0, y: 0 };
    state.ballHeight = 0;
    state.ballHeightVel = 0;
    stateSnap(state, 0);
    return state;
  },
};
