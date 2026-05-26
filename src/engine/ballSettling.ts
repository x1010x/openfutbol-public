// Minimal ball physics for the post-goal celebration window: integration +
// drag + gravity, plus containment inside the conceded goal frame (soft bounces
// off the back wall and the inside of each post). No contacts, no goal
// re-detection, no event emission. See CLAUDE.md "Ball-in-the-net effect".

import type { MatchState } from './types';

export function simulateBallSettling(state: MatchState): void {
  const AIR_FRICTION    = 0.96;
  const GROUND_FRICTION = 0.85;
  const GRAVITY         = 0.005;

  state.ball.x += state.ballVel.x;
  state.ball.y += state.ballVel.y;
  const drag = state.ballHeight > 0.003 ? AIR_FRICTION : GROUND_FRICTION;
  state.ballVel.x *= drag;
  state.ballVel.y *= drag;

  state.ballHeight += state.ballHeightVel;
  state.ballHeightVel -= GRAVITY;
  if (state.ballHeight < 0) {
    if (Math.abs(state.ballHeightVel) > 0.012) {
      state.ballHeight = 0;
      state.ballHeightVel = -state.ballHeightVel * 0.35;
      state.ballVel.x *= 0.82;
      state.ballVel.y *= 0.82;
    } else {
      state.ballHeight = 0;
      state.ballHeightVel = 0;
      state.ballVel.x *= 0.60;
      state.ballVel.y *= 0.60;
    }
  }

  // Conceded goal containment. celebGoalPos.x is 0 (home goal) or 1 (away
  // goal); the net depth runs ~0.031 past that line. Posts at y in
  // [0.44, 0.56]. Only clamp once the ball is at-or-past the line, otherwise
  // a rebound off the crossbar wouldn't get a chance to fall back out.
  const goalX = state.celebGoalPos.x;
  const homeGoal = goalX < 0.5;
  const NET_DEPTH = 0.027; // Adjusted to bring the net limit slightly forward
  const yMin = 0.428, yMax = 0.564; // Adjusted to fit just inside the true visual posts
  const backX = homeGoal ? goalX - NET_DEPTH : goalX + NET_DEPTH;
  const pastLine = homeGoal ? state.ball.x <= goalX : state.ball.x >= goalX;
  if (pastLine) {
    let hitNet = false;
    if (homeGoal ? state.ball.x < backX : state.ball.x > backX) {
      state.ball.x = backX;
      state.ballVel.x = -state.ballVel.x * 0.05; // Absorbed by the net, barely bounces
      hitNet = true;
    }
    if (state.ball.y < yMin) {
      state.ball.y = yMin;
      state.ballVel.y = -state.ballVel.y * 0.05;
      hitNet = true;
    } else if (state.ball.y > yMax) {
      state.ball.y = yMax;
      state.ballVel.y = -state.ballVel.y * 0.05;
      hitNet = true;
    }

    if (hitNet) {
      // The net fabric absorbs most of the remaining spin and speed
      state.ballVel.x *= 0.3;
      state.ballVel.y *= 0.3;
      // If the ball hits the back/side net while in the air, kill upward momentum so it drops
      if (state.ballHeight > 0) {
        state.ballHeightVel = Math.min(state.ballHeightVel, -0.02);
      }
    }

    // Extra ground friction inside the goal so it doesn't slowly roll back out to the pitch
    if (state.ballHeight <= 0.005) {
      state.ballVel.x *= 0.85;
      state.ballVel.y *= 0.85;
    }
  }

  if (Math.hypot(state.ballVel.x, state.ballVel.y) < 0.002) {
    state.ballVel.x = 0;
    state.ballVel.y = 0;
  }
}
