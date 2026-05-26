import type { Scenario } from '../types';
import { neutralInitialState, placePlayer, giveBallTo } from '../presets';
import { resolveShot } from '../../engine/effectors';

// Each scenario forces a shot at t=0 from a specific position. Sweep seeds to
// see the outcome distribution — `resolveShot` rolls a corner target (top vs
// bottom 6-yard) and adds aim error inversely proportional to the shooter's
// `shooting` stat (75 for FWD slot 9, 65 for MID slot 7 in our neutral team).
// Goal / save / off-target / post depend on RNG + GK reaction in subsequent
// ticks; we don't gate on outcome.

function shotFrom(
  side: 'home' | 'away',
  shooterSlot: number,
  pos: { x: number; y: number },
) {
  return (seed: number) => {
    const state = neutralInitialState(seed);
    const shooterId = placePlayer(state, side, shooterSlot, pos);
    giveBallTo(state, shooterId);
    resolveShot(state, 0);
    return state;
  };
}

export const shotCloseCentral: Scenario = {
  id: 'shot-close-central',
  name: 'Tiro — cerca y centrado',
  description: 'Delantero a ~4m del arco, centrado. Casi siempre gol; algunas seeds el portero llega.',
  durationMs: 6_000,
  build: shotFrom('home', 9, { x: 0.96, y: 0.50 }),
};

export const shotPenaltySpotRange: Scenario = {
  id: 'shot-penalty-spot',
  name: 'Tiro — distancia de penal (11m)',
  description: 'Delantero al punto de penal en juego abierto (sin barrera). Mezcla de gol y atajada.',
  durationMs: 7_000,
  build: shotFrom('home', 9, { x: 0.895, y: 0.50 }),
};

export const shotEdgeOfBoxCentral: Scenario = {
  id: 'shot-edge-box',
  name: 'Tiro — borde del área, centrado',
  description: 'Delantero al borde del área (~18m). Resultado más equilibrado entre gol/atajada/poste.',
  durationMs: 8_000,
  build: shotFrom('home', 9, { x: 0.83, y: 0.50 }),
};

export const shotTightAngleNearPost: Scenario = {
  id: 'shot-tight-angle',
  name: 'Tiro — ángulo cerrado al primer palo',
  description: 'Delantero cerca del córner del área, ángulo agudo. Mucho off-target con seeds bajas; atajadas cómodas del portero.',
  durationMs: 8_000,
  build: shotFrom('home', 9, { x: 0.94, y: 0.22 }),
};

export const shotFromTheSide: Scenario = {
  id: 'shot-side',
  name: 'Tiro — desde costado del área',
  description: 'Delantero entrando al área desde la banda inferior (~14m). Ángulo cerrado al segundo palo.',
  durationMs: 8_000,
  build: shotFrom('home', 9, { x: 0.87, y: 0.75 }),
};

export const shotLongRangeCentral: Scenario = {
  id: 'shot-long-range',
  name: 'Tiro lejano — centrado (28m)',
  description: 'Mediocentro chuta desde fuera del área, centrado. Mayormente atajadas u off; goles excepcionales.',
  durationMs: 8_000,
  build: shotFrom('home', 7, { x: 0.73, y: 0.50 }),
};

export const shotAwayFromCenter: Scenario = {
  id: 'shot-away-edge-box',
  name: 'Tiro — visitante en borde del área',
  description: 'Delantero visitante chuta desde el borde del área propia (~18m), centrado. Simétrico al local pero apuntando a la portería izquierda.',
  durationMs: 8_000,
  build: shotFrom('away', 9, { x: 0.17, y: 0.50 }),
};
