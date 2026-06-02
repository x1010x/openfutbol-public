// Effectors — the stateful actions a player takes once a decision is made:
// tackle attempts, foul/card resolution, pass resolution (including clears and
// GK distribution), and shots. Each effector mutates `state` directly: ball
// impulse, ownership transfer, kickFrozen / down windows, phase changes, event
// emission, snapshot.
//
// This is a barrel; the implementations live in effectors/<slice>.ts:
//   shared  — EffectorDeps bag, clamp, KICK_FREEZE_MS
//   tackle  — checkTackle, checkOffBallAggression
//   foul    — executeFoul (severity detection, cards, injuries, free-kick/red)
//   pass    — findBestPassTarget, pickCornerTarget, resolvePass
//   shot    — resolveShot

export type { EffectorDeps } from './effectors/shared';
export { checkTackle, checkOffBallAggression } from './effectors/tackle';
export { executeFoul } from './effectors/foul';
export { findBestPassTarget, pickCornerTarget, resolvePass } from './effectors/pass';
export { resolveShot } from './effectors/shot';
