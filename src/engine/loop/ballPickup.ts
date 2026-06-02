// Per-tick ball handling outside open-play carrying: while a set-piece is in
// its *_setup phase the ball is a static fetch target (the kicker picks it up
// explicitly when close enough, transitioning to holding); during celebration
// it settles into the net; otherwise normal live physics run. Extracted
// verbatim from simulateFromState's tick loop.

import type { MatchState } from '../types';
import { emit as stateEmit, snap as stateSnap, sideOf, setCarrier } from '../state';
import { CORNER_HOLD_TICKS, FOUL_HOLD_TICKS, PENALTY_RUNUP_DIST, isWallSet } from '../phases';
import { findBestPassTarget } from '../effectors';
import { simulateBallTick, simulateBallSettling } from '../ballPhysics';

export function tickSetupAndBallPhysics(state: MatchState, t: number): void {
  // During kickoff_setup / throw_in_setup / goal_kick_setup the ball is a static fetch target — no
  // physics, no contact detection. The kicker picks it up explicitly when close enough.
  const phaseTag = state.phase;
  if ((phaseTag === 'kickoff_setup' || phaseTag === 'throw_in_setup' || phaseTag === 'goal_kick_setup' || phaseTag === 'corner_setup' || phaseTag === 'foul_setup') && state.ballOwner === null && state.kickerId !== null) {
    // Throw-in: let the ball keep flying with real physics (drag + gravity)
    // so it visibly leaves the field instead of pinning at the touchline.
    // simulateBallTick's early return at !'live' keeps it integration-only —
    // no contacts, no OOB re-trigger.
    if (phaseTag === 'throw_in_setup') {
      simulateBallTick(state, t, { setCarrier: (id, s) => setCarrier(state, id, s) });

      // Once the ball has settled — stopped under its own physics, or
      // drifted far past the line — return it to the throw-in spot so it's
      // ready for the kicker. This is the "regresará al punto de saque"
      // case the user described, applied independently of kicker arrival.
      if (state.throwInSpot) {
        const settled = Math.hypot(state.ballVel.x, state.ballVel.y) < 0.005 && state.ballHeight < 0.01;
        const farOOB = state.ball.y < -0.10 || state.ball.y > 1.10
                     || state.ball.x < -0.05 || state.ball.x > 1.05;
        const atSpot = Math.hypot(state.ball.x - state.throwInSpot.x, state.ball.y - state.throwInSpot.y) < 0.005;
        if (!atSpot && (settled || farOOB)) {
          state.ball = { x: state.throwInSpot.x, y: state.throwInSpot.y };
          state.ballVel = { x: 0, y: 0 };
          state.ballHeight = 0;
          state.ballHeightVel = 0;
          stateSnap(state, t);
        }
      }
    }

    const kpos = state.pos[state.kickerId];
    let canPickup = false;
    if (phaseTag === 'throw_in_setup' && state.throwInSpot) {
      // Throw-in: only pickup once the kicker has crossed the touchline so
      // the throw fires from behind the line (not from inside the pitch).
      // Snapping here looked like a teleport in the renderer; the kicker's
      // spring target sits past the line so they will naturally cross it.
      const onTop = state.throwInSpot.y < 0.5;
      const pastLine = onTop ? kpos.y <= 0.0 : kpos.y >= 1.0;
      const nearSpot = Math.abs(kpos.x - state.throwInSpot.x) < 0.06;
      canPickup = pastLine && nearSpot;
    } else if (phaseTag === 'goal_kick_setup' && state.goalKickSpot) {
      // For goal kicks, the kicker walks to a wind-up spot *behind* the ball.
      // We trigger the pickup when they get near that wind-up spot.
      const attackSign = sideOf(state, state.kickerId) === 'home' ? 1 : -1;
      const windUpX = state.goalKickSpot.x - attackSign * 0.012;
      const nearWindUp = Math.hypot(kpos.x - windUpX, kpos.y - state.goalKickSpot.y) < 0.08;
      canPickup = nearWindUp;
    } else if (phaseTag === 'corner_setup' && state.cornerSpot) {
      // Corner: kicker walks straight to the flag. Tight pickup radius so
      // the ball doesn't anchor before they've actually arrived.
      canPickup = Math.hypot(kpos.x - state.cornerSpot.x, kpos.y - state.cornerSpot.y) < 0.025;
    } else if (phaseTag === 'foul_setup' && state.foulSpot) {
      // Foul: kicker walks to a wind-up spot behind the ball. For penalties
      // the spot is PENALTY_RUNUP_DIST (~5.8 m) back so the kicker is
      // clearly behind the ball and has a visible run-up; for other fouls
      // the original 0.012 step-back is used. Pickup also waits for the
      // defensive wall to settle (isWallSet returns true instantly for penalties).
      const attackSign = sideOf(state, state.kickerId) === 'home' ? 1 : -1;
      const runUpDist = state.foulVariant === 'penalty' ? PENALTY_RUNUP_DIST : 0.012;
      const windUpX = state.foulSpot.x - attackSign * runUpDist;
      const kickerArrived = Math.hypot(kpos.x - windUpX, kpos.y - state.foulSpot.y) < 0.05;
      canPickup = kickerArrived && isWallSet(state);
    } else if (phaseTag === 'kickoff_setup') {
      const pickupRadius = 0.05;
      canPickup = Math.hypot(kpos.x - state.ball.x, kpos.y - state.ball.y) < pickupRadius;
    }

    if (canPickup) {
      state.ballOwner = state.kickerId;
      state.ballHeight = 0;
      state.ballHeightVel = 0;
      state.ballVel = { x: 0, y: 0 };

      if (phaseTag === 'throw_in_setup' && state.throwInSpot) {
        // Anchor ball on the touchline (not on the kicker who stands off-pitch).
        state.ball = { x: state.throwInSpot.x, y: state.throwInSpot.y };

        // Snap kicker to exact stand spot and kill velocity to prevent "marionette" sliding
        const onTop = state.throwInSpot.y < 0.5;
        state.pos[state.kickerId] = { x: state.throwInSpot.x, y: onTop ? -0.034 : 1.010 };
        state.vel[state.kickerId] = { x: 0, y: 0 };

        const side = sideOf(state, state.kickerId);
        setCarrier(state, state.kickerId, side);

        // Early receiver selection so the taker faces them during the hold window.
        const bestReceiverId = findBestPassTarget(state);
        state.intendedReceiver = bestReceiverId;

        stateEmit(state, t, 'reception', side, state.kickerId, bestReceiverId ?? undefined, 'Fuera de banda');

        // Short holding window: the renderer transitions the kicker from
        // running to throw anim and the engine has a beat to "get into
        // position facing the receiver". tickPhase throw_in_holding will
        // call resolvePass (with isThrowIn=true) and advance to release.
        state.phase = 'throw_in_holding';
        state.phaseTicks = 4;
        stateSnap(state, t);
      } else if (phaseTag === 'goal_kick_setup' && state.goalKickSpot) {
        // Anchor the ball exactly on the spot
        state.ball = { x: state.goalKickSpot.x, y: state.goalKickSpot.y };
        state.vel[state.kickerId] = { x: 0, y: 0 };

        const side = sideOf(state, state.kickerId);
        setCarrier(state, state.kickerId, side);
        stateSnap(state, t);
      } else if (phaseTag === 'corner_setup' && state.cornerSpot) {
        // Anchor ball on the flag (already there from startCorner) and
        // transfer ownership. DO NOT snap the kicker — they've walked here
        // organically and any further "set to exact spot" reads as a
        // teleport. Transition to holding immediately so the engine isn't
        // still waiting for the setup timer to expire.
        state.ball = { x: state.cornerSpot.x, y: state.cornerSpot.y };
        state.vel[state.kickerId] = { x: 0, y: 0 };
        const side = sideOf(state, state.kickerId);
        setCarrier(state, state.kickerId, side);
        state.phase = 'corner_holding';
        state.phaseTicks = CORNER_HOLD_TICKS;
        stateSnap(state, t);
      } else if (phaseTag === 'foul_setup' && state.foulSpot) {
        // Anchor ball on the foul spot (already there from startFoul). Snap
        // the kicker to the exact wind-up spot so the holding tableau reads
        // as a clean idle stance behind the ball — without this they freeze
        // wherever they happened to be when canPickup fired (up to 0.05 off
        // target) and the residual offset spring-jitters during holding.
        state.ball = { x: state.foulSpot.x, y: state.foulSpot.y };
        const attackSign = sideOf(state, state.kickerId) === 'home' ? 1 : -1;
        const runUpDist = state.foulVariant === 'penalty' ? PENALTY_RUNUP_DIST : 0.012;
        state.pos[state.kickerId] = {
          x: state.foulSpot.x - attackSign * runUpDist,
          y: state.foulSpot.y,
        };
        state.vel[state.kickerId] = { x: 0, y: 0 };
        const side = sideOf(state, state.kickerId);
        setCarrier(state, state.kickerId, side);
        state.phase = 'foul_holding';
        state.phaseTicks = FOUL_HOLD_TICKS;
        stateSnap(state, t);
      } else {
        state.ball = { ...kpos };
      }
    }
  } else if (state.ballOwner === null && phaseTag === 'celebration') {
    // Goal scored: let the ball settle into the net under gravity. No events,
    // no contact, no re-detection — pure visual physics until kickoff_setup.
    simulateBallSettling(state);
  } else if (state.ballOwner === null && phaseTag !== 'freeze') {
    // Ball physics run while live AND during setup phases (so the ball can fly OOB naturally).
    // simulateBallTick has an early return to prevent collisions/OOB triggers during setup.
    simulateBallTick(state, t, { setCarrier: (id, s) => setCarrier(state, id, s) });
  }
}
