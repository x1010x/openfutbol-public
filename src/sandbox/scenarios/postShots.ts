import type { Scenario } from '../types';
import { neutralInitialState, placePlayer, giveBallTo, forceShotAt, freezePlayer } from '../presets';

// Engine constants (mirror of ballPhysics.ts:39-41):
//   GOAL_POST_TOP = 0.424     top post centre line
//   GOAL_POST_BOT = 0.568     bottom post centre line
//   CROSSBAR_H    = 0.12      crossbar height
//   POST_RADIUS   = 0.015     collision radius around each post
//
// All shots in this group fire from the edge of the box at x=0.85. The away
// GK is moved off the trajectory and frozen via downUntil, so the only thing
// being tested is post collision physics + goal-line detection.

const SHOOTER_POS = { x: 0.85, y: 0.50 };
const HOME_GOAL_X = 1.0;

function postShot(targetY: number, opts: { gkParkY: number; heightVel?: number; speed?: number }) {
  return (seed: number) => {
    const state = neutralInitialState(seed);
    const shooterId = placePlayer(state, 'home', 9, SHOOTER_POS);
    // Park the GK at the chosen y (always at x=goal line) and freeze.
    const gkId = placePlayer(state, 'away', 0, { x: 0.995, y: opts.gkParkY });
    freezePlayer(state, gkId);
    giveBallTo(state, shooterId);
    forceShotAt(state, { x: HOME_GOAL_X, y: targetY }, {
      heightVel: opts.heightVel,
      speed: opts.speed,
    });
    return state;
  };
}

export const shotTopPost: Scenario = {
  id: 'shot-top-post',
  name: 'Tiro — palo superior',
  description: 'Apuntado exactamente al centro del palo superior (y=0.424). Portero congelado abajo. Debería rebotar en el palo — observá si entra al arco, vuelve al campo, o gira al palo de enfrente.',
  durationMs: 8_000,
  build: postShot(0.424, { gkParkY: 0.85 }),
};

export const shotBottomPost: Scenario = {
  id: 'shot-bottom-post',
  name: 'Tiro — palo inferior',
  description: 'Apuntado al centro del palo inferior (y=0.568). Portero congelado arriba.',
  durationMs: 8_000,
  build: postShot(0.568, { gkParkY: 0.15 }),
};

export const shotCrossbar: Scenario = {
  id: 'shot-crossbar',
  name: 'Tiro — travesaño',
  description: 'Centrado y alto: heightVel=0.052 con speed=0.070 cruza la línea a h≈0.114, contra la cara inferior del travesaño (CROSSBAR_H=0.12). El rebote sale hacia atrás-abajo y la pelota cae al campo. Tuneable: si pasa por encima, bajar heightVel; si entra por debajo limpio, subirla.',
  durationMs: 8_000,
  build: postShot(0.50, { gkParkY: 0.15, heightVel: 0.052, speed: 0.070 }),
};

export const shotJustInsideTopPost: Scenario = {
  id: 'shot-inside-top',
  name: 'Tiro — justo dentro del palo superior',
  description: 'y=0.450, claramente dentro del arco y fuera del radio de colisión del palo. Debería ser gol limpio. Test de la detección de gol cerca del límite superior.',
  durationMs: 7_000,
  build: postShot(0.450, { gkParkY: 0.85 }),
};

export const shotJustOutsideTopPost: Scenario = {
  id: 'shot-outside-top',
  name: 'Tiro — justo fuera del palo superior',
  description: 'y=0.395, claramente fuera del palo (radio de colisión llega hasta 0.409). Debería ser saque de puerta — el balón no toca el palo ni cruza dentro del arco.',
  durationMs: 7_000,
  build: postShot(0.395, { gkParkY: 0.85 }),
};

export const shotJustInsideBottomPost: Scenario = {
  id: 'shot-inside-bottom',
  name: 'Tiro — justo dentro del palo inferior',
  description: 'y=0.545, dentro del arco cerca del palo inferior. Debería ser gol limpio.',
  durationMs: 7_000,
  build: postShot(0.545, { gkParkY: 0.15 }),
};

export const shotJustOutsideBottomPost: Scenario = {
  id: 'shot-outside-bottom',
  name: 'Tiro — justo fuera del palo inferior',
  description: 'y=0.597, claramente fuera del palo inferior (radio de colisión llega hasta 0.583). Debería ser saque de puerta — el balón no toca el palo ni cruza dentro del arco. Espejo de shot-outside-top.',
  durationMs: 7_000,
  build: postShot(0.597, { gkParkY: 0.15 }),
};
