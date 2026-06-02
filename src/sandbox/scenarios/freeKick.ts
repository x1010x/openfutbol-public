import type { Scenario } from '../types';
import { neutralInitialState } from '../presets';
import { startFoul } from '../../engine/phases';
import { snap as stateSnap } from '../../engine/state';

// startFoul auto-categorises the variant from the spot:
//   - in box → penalty (covered by penalty.ts)
//   - central, <=32m → shoot (direct attempt, builds a wall)
//   - wide, <=32m → cross (smaller wall, ball lofted into the box)
//   - too far/wide → pass (no wall, build-up)
//
// Spots tuned for home attacking (goal at x=1). distToGoalCenter_m and
// dyFromCenter are evaluated in phases.decideFoulVariant. Wall size by
// distance (phases.wallSize):
//   shoot — <18m → 5 ; <22m → 4 ; <26m → 3 ; <32m → 2 ; else 0 (becomes pass)
//   cross — <22m → 2 ; <32m → 1 ; else 0 (becomes pass)

export const freeKickShootNearHome: Scenario = {
  id: 'freekick-shoot-near-home',
  name: 'Falta directa — pegada al área (wall=5)',
  description: 'Local, central, justo fuera del área (~17m). Barrera máxima de 5 jugadores. Útil para ver la formación más cargada y la separación FIFA del balón.',
  durationMs: 22_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    startFoul(state, { x: 0.84, y: 0.50 }, 'home');
    stateSnap(state, 0);
    return state;
  },
};

export const freeKickShootMidHome: Scenario = {
  id: 'freekick-shoot-mid-home',
  name: 'Falta directa — distancia media (wall=4)',
  description: 'Local, central, ~21m. Barrera de 4 jugadores. Rango óptimo de tiro directo.',
  durationMs: 22_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    startFoul(state, { x: 0.80, y: 0.50 }, 'home');
    stateSnap(state, 0);
    return state;
  },
};

export const freeKickShootHome: Scenario = {
  id: 'freekick-shoot-home',
  name: 'Falta directa — distancia justa (wall=3)',
  description: 'Local, central, ~23m. Barrera de 3 jugadores. Probabilidad de tiro vs pase ~50/50 según el sacador.',
  durationMs: 22_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    startFoul(state, { x: 0.78, y: 0.50 }, 'home');
    stateSnap(state, 0);
    return state;
  },
};

export const freeKickShootFarHome: Scenario = {
  id: 'freekick-shoot-far-home',
  name: 'Falta directa — frontal del área grande (wall=2)',
  description: 'Local, central, ~30m. Barrera mínima de 2 jugadores. Mucho más probable que el sacador pase en vez de chutar.',
  durationMs: 22_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    startFoul(state, { x: 0.71, y: 0.50 }, 'home');
    stateSnap(state, 0);
    return state;
  },
};

export const freeKickCrossNearHome: Scenario = {
  id: 'freekick-cross-near-home',
  name: 'Centro lateral — cerca de línea de fondo (wall=2)',
  description: 'Local, lateral pegado al área (~21m, banda superior). Barrera reducida cubriendo el primer palo. El sacador cuelga al segundo palo.',
  durationMs: 22_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    startFoul(state, { x: 0.95, y: 0.20 }, 'home');
    stateSnap(state, 0);
    return state;
  },
};

export const freeKickCrossHome: Scenario = {
  id: 'freekick-cross-home',
  name: 'Centro lateral — mediocampo ofensivo (wall=1)',
  description: 'Local, lateral en zona de centro (~29m, banda superior). Barrera testimonial de 1 jugador.',
  durationMs: 22_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    startFoul(state, { x: 0.78, y: 0.25 }, 'home');
    stateSnap(state, 0);
    return state;
  },
};

export const freeKickCrossNearBottomHome: Scenario = {
  id: 'freekick-cross-near-bottom-home',
  name: 'Centro lateral — pegada al área, banda inferior (wall=2)',
  description: 'Espejo inferior de la falta lateral cercana. Verifica que computeWallTarget y la disposición de jugadores responden simétricamente en la banda contraria.',
  durationMs: 22_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    startFoul(state, { x: 0.95, y: 0.80 }, 'home');
    stateSnap(state, 0);
    return state;
  },
};

export const freeKickCrossBottomHome: Scenario = {
  id: 'freekick-cross-bottom-home',
  name: 'Centro lateral — mediocampo, banda inferior (wall=1)',
  description: 'Espejo inferior de la falta lateral en mediocampo. ~29m.',
  durationMs: 22_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    startFoul(state, { x: 0.78, y: 0.75 }, 'home');
    stateSnap(state, 0);
    return state;
  },
};

export const freeKickCrossBylineHome: Scenario = {
  id: 'freekick-cross-byline-home',
  name: 'Centro lateral — ángulo muy cerrado, casi en línea de fondo (wall=2)',
  description: 'Casi pegada al banderín de córner (x=0.97, y=0.20, ~21m). El ángulo de tiro al primer palo es muy cerrado — el sacador casi siempre cuelga; la barrera cubre principalmente el primer palo.',
  durationMs: 22_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    startFoul(state, { x: 0.97, y: 0.20 }, 'home');
    stateSnap(state, 0);
    return state;
  },
};

export const freeKickCrossNearAway: Scenario = {
  id: 'freekick-cross-near-away',
  name: 'Centro lateral — visitante, banda superior (wall=2, simétrico)',
  description: 'Visitante, lateral pegado al área en banda superior. Verifica que la formación de barrera y el reparto de jugadores espejan correctamente al sacar el equipo contrario.',
  durationMs: 22_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    startFoul(state, { x: 0.05, y: 0.20 }, 'away');
    stateSnap(state, 0);
    return state;
  },
};

export const freeKickPassHome: Scenario = {
  id: 'freekick-pass-home',
  name: 'Falta — mediocampo (sin barrera)',
  description: 'Local en mediocampo (~49m). Demasiado lejos para tiro o centro; el sacador hace pase de inicio. Sin barrera.',
  durationMs: 22_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    startFoul(state, { x: 0.55, y: 0.30 }, 'home');
    stateSnap(state, 0);
    return state;
  },
};

export const freeKickShootMidAway: Scenario = {
  id: 'freekick-shoot-mid-away',
  name: 'Falta directa — visitante (wall=4, simétrico)',
  description: 'Visitante, central, ~21m. Verifica que la barrera local se forma correctamente del lado contrario (test de simetría).',
  durationMs: 22_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    startFoul(state, { x: 0.20, y: 0.50 }, 'away');
    stateSnap(state, 0);
    return state;
  },
};

// Lateral directs: shoot variant from off-centre positions (dy=0.20, just
// inside the cross threshold). The wall axis is angled rather than perfectly
// perpendicular to the goal line — good for verifying that computeWallTarget
// orients correctly when the ball is not on the centre line.

export const freeKickShootLateralMidTopHome: Scenario = {
  id: 'freekick-shoot-lateral-mid-top-home',
  name: 'Directa lateral — banda superior, wall=4',
  description: 'Local en (0.84, 0.30), ~21m. Off-centre justo dentro del rango shoot (dy=0.20). Barrera de 4 jugadores formándose en ángulo respecto a la portería.',
  durationMs: 22_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    startFoul(state, { x: 0.84, y: 0.30 }, 'home');
    stateSnap(state, 0);
    return state;
  },
};

export const freeKickShootLateralFarTopHome: Scenario = {
  id: 'freekick-shoot-lateral-far-top-home',
  name: 'Directa lateral — banda superior, wall=3',
  description: 'Local en (0.82, 0.30), ~23m. Mismo off-centre pero más atrás — barrera de 3 jugadores. Compara con el wall=4 lateral cercano para ver cómo escala el ancho de la barrera.',
  durationMs: 22_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    startFoul(state, { x: 0.82, y: 0.30 }, 'home');
    stateSnap(state, 0);
    return state;
  },
};

export const freeKickShootLateralMidBottomHome: Scenario = {
  id: 'freekick-shoot-lateral-mid-bottom-home',
  name: 'Directa lateral — banda inferior, wall=4',
  description: 'Espejo inferior de la directa lateral cercana. Verifica que la barrera angulada se forma simétrica en la banda contraria.',
  durationMs: 22_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    startFoul(state, { x: 0.84, y: 0.70 }, 'home');
    stateSnap(state, 0);
    return state;
  },
};

export const freeKickShootLateralFarBottomHome: Scenario = {
  id: 'freekick-shoot-lateral-far-bottom-home',
  name: 'Directa lateral — banda inferior, wall=3',
  description: 'Espejo inferior del wall=3 lateral.',
  durationMs: 22_000,
  build: (seed) => {
    const state = neutralInitialState(seed);
    startFoul(state, { x: 0.82, y: 0.70 }, 'home');
    stateSnap(state, 0);
    return state;
  },
};
