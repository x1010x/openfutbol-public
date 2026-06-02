import type { TimelineEvent } from '../types/match';

export type Dir8 = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export type PlayerState = 'idle' | 'run' | 'kick' | 'tackle' | 'celebrate' | 'injury' | 'throw' | 'barrier';
export type GKState =
  | 'idle' | 'tracking' | 'holding' | 'moving'
  | 'dive_N' | 'dive_S'
  | 'catch_N' | 'catch_S'
  | 'punt' | 'kick' | 'throw';

export interface PlayerAnim {
  state: PlayerState;
  dir: Dir8;
  holdUntil: number | null;  // game-time ms; null = auto idle/run
}

export interface GKAnim {
  state: GKState;
  holdUntil: number | null;
  // Direction the GK is facing when state='throw'. Only N/S/NE/SE for home GK
  // and N/S/NW/SW for away GK (the atlas doesn't have other variants).
  throwDir: 'N' | 'S' | 'NE' | 'SE' | 'NW' | 'SW';
}

// Real-time durations (ms) for transient states. Real-time, not game-time, so the
// animations are visible at any playback speed.
const DUR = {
  // Player kick is a single static frame. Engine emits the impulse on the
  // same tick the kick anim starts, so the pose only needs to register as
  // "they made contact" — anything past one tick (250 ms) reads as the
  // player frozen while the ball is already 0.05 down the pitch. Matches
  // KICK_FREEZE_MS so the unfreeze and the pose end land together.
  kick:      250,
  tackle:    650,
  celebrate: 4000,
  injury:    2000,
  throw:     750,
  gk_dive:   800,
  gk_catch:  800,
  gk_punt:   1000,
  // Last-frame-of-punt pose used when the GK has already booted the ball
  // away (panic clear). No wind-up, just hold the follow-through briefly.
  gk_kick:   300,
};

export const MOVE_THRESHOLD = 0.001;  // position delta per keyframe span

export function dirFromDelta(dx: number, dy: number): Dir8 {
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (ax < ay * 0.4) return dy < 0 ? 'N' : 'S';
  if (ay < ax * 0.4) return dx > 0 ? 'E' : 'W';
  return ((dy < 0 ? 'N' : 'S') + (dx > 0 ? 'E' : 'W')) as Dir8;
}

export function makePlayerAnim(dir: Dir8 = 'E'): PlayerAnim {
  return { state: 'idle', dir, holdUntil: null };
}

export function makeGKAnim(): GKAnim {
  return { state: 'idle', holdUntil: null, throwDir: 'SE' };
}

// Pick the closest available cardinal direction for a GK throw, given the
// delta from GK to target and which side of the field they defend.
// Available atlas dirs:
//   home (left)  → N, S, NE, SE
//   away (right) → N, S, NW, SW
export function gkThrowCardinal(isHome: boolean, dx: number, dy: number): GKAnim['throwDir'] {
  const verticalRatio = Math.abs(dy) / Math.max(Math.abs(dx), 0.0001);
  if (verticalRatio > 2.0) {
    return dy < 0 ? 'N' : 'S';
  }
  if (isHome) return dy < 0 ? 'NE' : 'SE';
  return dy < 0 ? 'NW' : 'SW';
}

export function tickPlayerAnim(anim: PlayerAnim, gt: number, moving: boolean): void {
  const isTransient = anim.state === 'kick' || anim.state === 'tackle' || anim.state === 'injury' || anim.state === 'throw';
  
  if (anim.holdUntil !== null && gt >= anim.holdUntil) {
    anim.holdUntil = null;
    anim.state = 'idle';
  }
  
  // SYNC FIX: If moving, we usually want 'run'. 
  // But we MUST allow 'kick', 'tackle' and 'injury' to play for a brief moment even if moving,
  // otherwise they are skipped. We only force 'run' if they are NOT in a transient state
  // or if the hold period is almost over (to prevent long slides).
  if (moving && !isTransient && anim.state !== 'celebrate') {
    anim.state = 'run';
  }

  if (anim.holdUntil === null) {
    if (moving && anim.state === 'idle') anim.state = 'run';
    else if (!moving && anim.state === 'run') anim.state = 'idle';
  }
}

export function tickGKAnim(
  anim: GKAnim,
  gt: number,
  ballFlying: boolean,
  gkHolding: boolean,
  moving: boolean,
): void {
  if (anim.holdUntil !== null && gt >= anim.holdUntil) {
    anim.holdUntil = null;
    // After catch_N/S, punt/throw, or a movement burst, re-evaluate
    anim.state = gkHolding ? 'holding' : 'idle';
  }

  if (anim.holdUntil === null) {
    if (gkHolding) {
      anim.state = 'holding';
    } else if (moving) {
      anim.state = 'moving';
      anim.holdUntil = gt + 400; // Keep moving animation for at least 400ms to avoid flicker
    } else if (ballFlying) {
      anim.state = 'tracking';
    } else {
      anim.state = 'idle';
    }
  }
}

export function firePlayerEvent(
  anim: PlayerAnim,
  ev: TimelineEvent,
  gt: number,
  isActor: boolean,
  isTarget: boolean,
): void {
  // Clear transient states if the player takes control of the ball, 
  // UNLESS it's a throw-in preparation.
  if (isActor && (ev.kind === 'reception' || ev.kind === 'interception' || ev.kind === 'tackle_won')) {
    if (ev.log === 'Fuera de banda') {
      anim.state = 'idle';
      anim.holdUntil = gt + 1500; // Face the receiver while waiting
      return;
    }
    anim.holdUntil = null;
    anim.state = 'idle';
    return;
  }

  if (isActor) {
    switch (ev.kind) {
      case 'pass_short': case 'pass_forward': case 'pass_back':
      case 'shot_on':  case 'shot_off':
      case 'gk_distribute': case 'goal_kick':
        if (ev.log === 'Fuera de banda' || ev.kind === 'gk_distribute') {
          anim.state = 'throw';
          anim.holdUntil = gt + DUR.throw;
        } else {
          anim.state = 'kick';
          anim.holdUntil = gt + DUR.kick;
        }
        break;
      case 'tackle_won':
        anim.state = 'tackle';
        anim.holdUntil = gt + DUR.tackle;
        break;
      case 'foul':
        anim.state = 'tackle';
        anim.holdUntil = gt + DUR.tackle;
        break;
    }
  }
  if (isTarget && ev.kind === 'foul') {
    anim.state = 'injury';
    anim.holdUntil = gt + DUR.injury;
  }
}

export function fireCelebration(anim: PlayerAnim, gt: number): void {
  anim.state = 'celebrate';
  anim.holdUntil = gt + DUR.celebrate;
}

export function fireGKEvent(
  anim: GKAnim,
  ev: TimelineEvent,
  gt: number,
  ballAt: { x: number; y: number },
  gkPos: { x: number; y: number },
  isHome: boolean,
  targetPos?: { x: number; y: number },
): void {
  switch (ev.kind) {
    case 'save': {
      const dy = ballAt.y - gkPos.y;
      const dir = dy < 0 ? 'N' : 'S';
      const isCatch = ev.log === 'catch';
      // Use a dive whenever the GK had to extend (lateral distance > 0.04).
      // Standing-catch animation is only for balls coming straight at the body.
      // Deflections are always dives so the GK clearly throws themselves at it.
      const needsDive = !isCatch || Math.abs(dy) > 0.04;
      anim.state = (needsDive ? `dive_${dir}` : `catch_${dir}`) as GKState;
      anim.holdUntil = gt + (isCatch ? DUR.gk_catch : DUR.gk_dive);
      break;
    }
    case 'pass_short':
    case 'pass_forward':
    case 'pass_back':
    case 'pass_lateral':
    case 'goal_kick':
    case 'gk_distribute': {
      const isThrow = ev.log === 'throw';
      // Panic clear: ball impulse fires in the same tick as the emit, so
      // the GK isn't holding it anymore. Skip the wind-up and play the
      // last-frame follow-through pose ('kick') instead of the full punt
      // sequence (whose early frames render a ball-in-hand sprite).
      const isPanicClear = ev.log === '¡Despeje!';
      const isPunt = !isPanicClear && (ev.log === 'punt' || ev.kind === 'goal_kick');
      anim.state = isThrow ? 'throw' : isPanicClear ? 'kick' : isPunt ? 'punt' : 'idle';
      anim.holdUntil = gt + (
        isThrow ? DUR.throw :
        isPanicClear ? DUR.gk_kick :
        isPunt ? DUR.gk_punt :
        0
      );
      if (isThrow && targetPos) {
        const dx = targetPos.x - gkPos.x;
        const dy = targetPos.y - gkPos.y;
        anim.throwDir = gkThrowCardinal(isHome, dx, dy);
      }
      break;
    }
  }
}

/** Atlas key for a field player */
export function playerAnimKey(state: PlayerState, dir: Dir8): string {
  if (state === 'throw') {
    // Falls back to SE/SW if E/W because the atlas lacks pure lateral throw animations
    let throwDir = dir;
    if (dir === 'E') throwDir = 'SE';
    if (dir === 'W') throwDir = 'SW';
    return `player_throw_in_${throwDir}`;
  }
  if (state === 'barrier') {
    // Atlas has E/W/NE/NW/SE/SW only — no N/S. The renderer biases the
    // direction calculation to never emit N/S for barrier members, but keep
    // a safety fallback here just in case.
    let bdir = dir;
    if (dir === 'N') bdir = 'NE';
    if (dir === 'S') bdir = 'SE';
    return `player_barrier_${bdir}`;
  }
  return `player_${state}_${dir}`;
}

/**
 * Atlas key for a GK.
 * @param isHome   true = home GK (left atlas), false = away (right atlas)
 * @param state    current GK anim state
 * @param ballY    normalized ball Y (for tracking direction)
 * @param gkY      normalized GK Y
 */
export function gkAnimKey(
  isHome: boolean,
  state: GKState,
  ballY: number,
  gkY: number,
  ballX: number,
  gkX: number,
  throwDir: GKAnim['throwDir'] = isHome ? 'SE' : 'SW',
): string {
  const side = isHome ? 'left' : 'right';
  const fwd  = isHome ? 'E' : 'W';

  switch (state) {
    case 'idle':
    case 'tracking': {
      const dy = ballY - gkY;
      const dx = Math.abs(ballX - gkX);
      
      let suffix = fwd;
      if (Math.abs(dy) > 0.04) {
        if (dx < 0.15) {
          // Ball is more "above" or "below" than "ahead"
          suffix = dy < 0 ? 'N' : 'S';
        } else {
          // Ball is diagonal
          suffix = dy < 0 
            ? (isHome ? 'NE' : 'NW') 
            : (isHome ? 'SE' : 'SW');
        }
      }
      return `gk_${side}_idle_${suffix}`;
    }
    case 'holding': return `gk_${side}_idle_ball_${fwd}`;
    case 'moving': return `gk_${side}_throw_moving`;
    case 'dive_N':  return `gk_${side}_dive_N`;
    case 'dive_S':  return `gk_${side}_dive_S`;
    case 'catch_N': return `gk_${side}_catch_N`;
    case 'catch_S': return `gk_${side}_catch_S`;
    case 'punt':    return `gk_${side}_punt_${fwd}`;
    // Single-frame follow-through pose used when the GK booted the ball
    // away without holding it (panic clear). The atlas key references the
    // last frame of the punt sequence so the GK isn't visually clutching a
    // ball that has already left.
    case 'kick':    return `gk_${side}_kick_${fwd}`;
    // throwDir is constrained at fire-time to the 4 atlas-available directions
    // per side: home → N/S/NE/SE; away → N/S/NW/SW.
    case 'throw':   return `gk_${side}_throw_${throwDir}`;
    default:        return `gk_${side}_idle_${fwd}`;
  }
}
