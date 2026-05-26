// Corner: ball over the goal line off a defender. The nearest winger walks to
// the flag, a partner offers the short option, the box populates, then the
// cross fires. Entry + force field (attackers crash, defenders pack) + ticks.

import type { Vec2, TeamSide } from '../../types/match';
import type { EnginePlayer } from '../zoneEngine';
import { spring } from '../forces';
import { sideOf } from '../state';
import { HOME_ROLES, AWAY_ROLES } from '../zones';
import { clamp, CORNER_SETUP_TICKS, CORNER_HOLD_TICKS, KICK_FREEZE_MS } from './shared';
import type { CarrierRole, PhaseForceCtx, PhaseCallbacks, MatchState } from './shared';

// Trigger choreography mirrors the goal kick but the kicker is an attacker on
// `kSide`, the ball sits on the flag at the chosen corner, and the box
// positioning (in applyCornerForces) is inverted: attackers crash the box,
// defenders pack it.
//   spot     — corner of the field (cornerX ∈ {0.01,0.99}, cornerY ∈ {0.01,0.99})
//   kSide    — attacking side awarded the corner
export function startCorner(state: MatchState, spot: Vec2, kSide: TeamSide): void {
  state.intendedReceiver = null;
  state.ballLastKicker = null;
  state.ballLastKickerSide = null;
  state.ballKickerLockUntil = 0;
  state.needsKickoffPass = false;

  state.cornerSpot = { x: spot.x, y: spot.y };

  // Taker: nearest non-GK (by Y) to the corner — usually the winger on that
  // side. Partner: nearest remaining mid/fwd, used as the short-corner option.
  const team = kSide === 'home' ? state.homePlayers : state.awayPlayers;
  const roles = kSide === 'home' ? HOME_ROLES : AWAY_ROLES;
  const onTop = spot.y < 0.5;
  const sameSide = (slotY: number) => onTop ? slotY < 0.5 : slotY > 0.5;
  const cand = team
    .filter(p => p.slotIndex !== 0)
    .map(p => ({ p, dy: Math.abs((state.pos[p.id]?.y ?? 0.5) - spot.y) }))
    .sort((a, b) => a.dy - b.dy);
  const taker = cand[0]?.p ?? team.find(p => sameSide(state.pos[p.id]?.y ?? 0.5)) ?? team[5];
  state.kickerId = taker.id;

  // Short partner: prefer a mid or fwd (not a defender, never the GK), close
  // to the corner but not the taker. Defensive midfielders / wingers naturally
  // fall out of the same Y-sort that picked the taker.
  const partnerCand = team
    .filter(p => p.slotIndex !== 0 && p.id !== taker.id)
    .filter(p => roles[p.slotIndex] === 'mid' || roles[p.slotIndex] === 'fwd')
    .map(p => ({ p, dy: Math.abs((state.pos[p.id]?.y ?? 0.5) - spot.y) }))
    .sort((a, b) => a.dy - b.dy);
  state.partnerId = partnerCand[0]?.p.id ?? null;

  state.possession = kSide;

  // Do NOT anchor the ball here — let it fly OOB on its real velocity (with
  // drag) so the user sees it actually leave the field. Anchoring at this
  // moment reads as the ball "hitting a virtual wall". The canPickup branch
  // in zoneEngine snaps it onto the flag later, which is the teleport the
  // user accepts. The kicker walks at their own stat speed in parallel.
  state.ballOwner = null;

  state.pendingImpulse = null;
  state.phase = 'corner_setup';
  state.phaseTicks = CORNER_SETUP_TICKS;
}

export function applyCornerForces(
  p: EnginePlayer,
  isGK: boolean,
  pSide: TeamSide,
  role: CarrierRole,
  base: Vec2,
  ppos: Vec2,
  pvel: Vec2,
  force: Vec2,
  ctx: PhaseForceCtx,
): boolean {
  const { phase, ball, kickerId, partnerId, intendedReceiver, cornerSpot } = ctx;
  const kickerSide: TeamSide | null = kickerId !== null ? ctx.sideOf(kickerId) : null;
  const spot = cornerSpot ?? ball;
  // The defending goal sits on the same x-side as the corner flag (the ball
  // went out behind it). Attackers cross INTO that box.
  const defendingGoalX = spot.x < 0.5 ? 0.0 : 1.0;
  const onTop = spot.y < 0.5;

  if (p.id === kickerId) {
    // During setup/holding, target a spot JUST OFF the field, beyond the
    // flag in the outward diagonal — so the ball sits between the kicker
    // and the pitch, like a real corner. The kicker walks past the flag
    // (triggering canPickup as they cross 0.025 of the spot) and stops on
    // the outside. On release, the target snaps back to the spot itself so
    // they step into the ball at the kick moment.
    const outX = spot.x + Math.sign(spot.x - 0.5) * 0.020;
    const outY = spot.y + Math.sign(spot.y - 0.5) * 0.020;
    const standOutside = phase === 'corner_setup' || phase === 'corner_holding';
    const target: Vec2 = standOutside
      ? { x: outX, y: outY }
      : { x: spot.x, y: spot.y };
    const gain = phase === 'corner_setup' ? 0.40
               : phase === 'corner_holding' ? 0.45
               : 0.55;
    const sf = spring(ppos, target, gain);
    force.x += sf.x;
    force.y += sf.y;
    return true;
  }

  // GKs stay on their line.
  if (isGK) {
    const sf = spring(ppos, base, 0.25);
    force.x += sf.x;
    force.y += sf.y;
    return true;
  }

  if (p.id === intendedReceiver) {
    pvel.x *= 0.5;
    pvel.y *= 0.5;
    return true;
  }

  if (pSide === kickerSide) {
    // Attacking team. Crowd the box with 4+ attackers (2 fwds + 2 mids)
    // plus a designated short-corner partner standing just inside the
    // field near the flag. Remaining mids cover the edge; defenders stay
    // back as counter cover except for a single wing-back pushed up.
    let targetX: number;
    let targetY: number;

    if (p.id === partnerId) {
      // Short-corner partner: stand ~0.10 from the flag along the goal line,
      // slightly inside the pitch — gives the kicker a realistic short option
      // without overlapping the corner spot itself.
      const partnerX = defendingGoalX < 0.5 ? 0.10 : 0.90;
      const partnerY = onTop ? 0.10 : 0.90;
      targetX = partnerX;
      targetY = partnerY;
    } else if (role === 'fwd') {
      // Forwards crash near/far post.
      const lane = p.slotIndex % 2;
      targetY = lane === 0 ? (onTop ? 0.42 : 0.58)   // near post / front of 6-yd
                           : (onTop ? 0.58 : 0.42);  // far post / penalty spot side
      targetX = defendingGoalX < 0.5 ? 0.07 : 0.93;
    } else if (role === 'mid') {
      // Up to two mids also crash the box; the rest hold the edge for
      // second balls. Use slotIndex to spread their target Y.
      const inBox = p.slotIndex % 2 === 0; // deterministic split
      if (inBox) {
        targetX = defendingGoalX < 0.5 ? 0.12 : 0.88;
        // Penalty spot / opposite half of box from the forwards.
        targetY = onTop ? 0.45 : 0.55;
      } else {
        // Edge of box (penalty arc area).
        targetX = defendingGoalX < 0.5 ? 0.20 : 0.80;
        targetY = clamp(base.y, 0.35, 0.65);
      }
    } else {
      // Defenders: one wing-back pushed up to the box edge for second
      // balls, the rest hold just past midfield to cover any counter.
      const advancedDef = p.slotIndex === 1 || p.slotIndex === 5;
      if (advancedDef) {
        targetX = defendingGoalX < 0.5 ? 0.25 : 0.75;
        targetY = clamp(base.y, 0.30, 0.70);
      } else {
        targetX = defendingGoalX < 0.5 ? 0.42 : 0.58;
        targetY = base.y;
      }
    }
    const target: Vec2 = { x: clamp(targetX, 0.05, 0.95), y: clamp(targetY, 0.05, 0.95) };
    const sf = spring(ppos, target, 0.18);
    force.x += sf.x;
    force.y += sf.y;
    return true;
  }

  // Defending team: pack the box. Defenders pick up attackers, mids cover
  // the edge, forwards retreat to mid for a counter.
  let targetX: number;
  let targetY: number;
  if (role === 'def') {
    // CBs/FBs inside the box across the y axis.
    targetX = defendingGoalX < 0.5 ? 0.10 : 0.90;
    const lane = p.slotIndex % 4;
    targetY = 0.30 + lane * 0.14;
  } else if (role === 'mid') {
    // Mids tighten to the edge of the box — the attacking team also has
    // mids in the box now, so don't leave the second-ball area undefended.
    targetX = defendingGoalX < 0.5 ? 0.16 : 0.84;
    targetY = clamp(base.y, 0.30, 0.70);
  } else {
    // Forwards drop to halfway line.
    targetX = defendingGoalX < 0.5 ? 0.45 : 0.55;
    targetY = base.y;
  }
  const target: Vec2 = { x: clamp(targetX, 0.05, 0.95), y: clamp(targetY, 0.05, 0.95) };
  const sf = spring(ppos, target, 0.14);
  force.x += sf.x;
  force.y += sf.y;
  return true;
}

export function tickCornerSetup(state: MatchState, t: number, callbacks: PhaseCallbacks): void {
  // Setup timer expired but the kicker hasn't reached the flag yet (the
  // pickup branch in zoneEngine would have transitioned us to holding the
  // moment they arrived). Extend the timer rather than teleporting — the
  // user wants the player to run at their own stat-based pace, not be
  // yanked to the spot because a counter ran out.
  if (state.cornerSpot) {
    const kp = state.pos[state.kickerId!];
    const d = Math.hypot(kp.x - state.cornerSpot.x, kp.y - state.cornerSpot.y);
    if (d > 0.025) {
      state.phaseTicks = 4;
      return;
    }
  }

  if (state.ballOwner !== state.kickerId) {
    state.ballOwner = state.kickerId;
    state.ballHeight = 0;
    state.ballHeightVel = 0;
    state.ballVel = { x: 0, y: 0 };
    if (state.cornerSpot) {
      state.ball = { x: state.cornerSpot.x, y: state.cornerSpot.y };
    }
    callbacks.setCarrier(state.kickerId!, sideOf(state, state.kickerId!));
  }

  state.vel[state.kickerId!] = { x: 0, y: 0 };
  state.phase = 'corner_holding';
  state.phaseTicks = CORNER_HOLD_TICKS;
  callbacks.snap(t);
}

export function tickCornerHolding(state: MatchState, t: number, callbacks: PhaseCallbacks): void {
  callbacks.resolvePass(t);
  if (state.phase === 'corner_holding') state.phase = 'live';
  callbacks.snap(t);
}

export function tickCornerRelease(state: MatchState, t: number, callbacks: PhaseCallbacks): void {
  const imp = state.pendingImpulse;
  if (imp !== null) {
    state.ballVel = imp.vel;
    state.ballHeight = imp.height;
    state.ballHeightVel = imp.heightVel;
    state.ballOwner = null;
    state.ballLastKicker = imp.kickerId;
    state.ballLastKickerSide = imp.kickerSide;
    state.ballKickerLockUntil = t + imp.lockUntil;
    state.intendedReceiver = imp.receiverId;
    state.pendingImpulse = null;

    state.vel[state.kickerId!] = { x: 0, y: 0 };
    state.kickFrozenUntil.set(state.kickerId!, t + KICK_FREEZE_MS);

    const rpos = state.pos[imp.receiverId];
    const kpos = state.pos[state.kickerId!];
    const dx = rpos.x - kpos.x;
    const dy = rpos.y - kpos.y;
    state.vel[state.kickerId!] = { x: dx * 0.001, y: dy * 0.001 };
  }
  state.cornerSpot = null;
  state.phase = 'live';
  callbacks.snap(t);
}
