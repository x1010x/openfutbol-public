// Per-frame update: advances game time, interpolates between timeline keyframes,
// fires queued timeline events (driving the animation state machine + transient
// overlays), positions the ball, and updates the scoreboard/minute DOM. Holds no
// state of its own — everything mutated lives on the Scene (scene.rt cursors and
// overlay timers) so the renderer owns construction and this owns motion.

import type { RefObject } from 'react';
import type { Ticker } from 'pixi.js';
import type { Keyframe } from '../types/match';
import {
  tickPlayerAnim, tickGKAnim,
  firePlayerEvent, fireCelebration, fireGKEvent,
  playerAnimKey, gkAnimKey,
  dirFromDelta, MOVE_THRESHOLD,
  type Dir8,
} from './states';
import { lerp, toCanvasX, toCanvasY, ballHeightLevel, applyAnim, toDisplayMs } from './layout';
import type { Scene } from './renderer';

export interface AnimatorCtx {
  speedRef: { current: number };
  homeTeamName: string;
  awayTeamName: string;
  logsRef: RefObject<HTMLDivElement | null>;
  scoreRef: RefObject<HTMLSpanElement | null>;
  minuteRef: RefObject<HTMLSpanElement | null>;
}

export function updateScene(scene: Scene, ticker: Ticker, ctx: AnimatorCtx): void {
  const { timeline, rt } = scene;
  const { speedRef, homeTeamName, awayTeamName, logsRef, scoreRef, minuteRef } = ctx;
  const kfs = timeline.keyframes;

  rt.gameTime = Math.min(rt.gameTime + ticker.deltaMS * speedRef.current, timeline.durationMs);
  const gt = rt.gameTime;

  // Second-half side switch: once the half-time whistle has passed we mirror
  // the pitch horizontally (x → 1-x) so the teams visibly change ends. The
  // engine timeline is unchanged (home still attacks x=1 internally); only the
  // rendering flips. `mir` maps an absolute x; `mdx` flips a horizontal delta
  // (for facing); GK sprite sets are swapped below since their atlas is
  // left/right-goal specific.
  const flipped = scene.halfTimeMs !== null && gt >= scene.halfTimeMs;
  const mir = (x: number) => (flipped ? 1 - x : x);
  const mdx = (dx: number) => (flipped ? -dx : dx);

  // Advance keyframe pointer
  while (rt.kfPointer < kfs.length - 2 && kfs[rt.kfPointer + 1].t <= gt) rt.kfPointer++;

  const kfA: Keyframe = kfs[rt.kfPointer];
  const kfB: Keyframe = kfs[rt.kfPointer + 1] ?? kfA;
  const span = kfB.t - kfA.t;
  const t = span > 0 ? Math.min(1, (gt - kfA.t) / span) : 1;

  // Process animation events up to current game time
  while (rt.evtPtr < timeline.events.length && timeline.events[rt.evtPtr].t <= gt) {
    const ev = timeline.events[rt.evtPtr];
    rt.evtPtr++;

    // Field player events (actor / target) — holdUntil is in real-time.
    // Override facing direction toward the kick target so the kick anim points
    // at the receiver / goal rather than wherever the player was running.
    let kickDir: Dir8 | null = null;
    if (ev.kind === 'pass_short' || ev.kind === 'pass_forward'
        || ev.kind === 'pass_back' || ev.kind === 'pass_lateral'
        || ev.kind === 'goal_kick') {
      if (ev.target) {
        const tpos = kfA.positions[ev.target];
        // dirFromDelta returns one of the 8 cardinals; the throw
        // atlas has N/S/NE/NW/SE/SW and playerAnimKey falls back
        // E→SE, W→SW, so all 8 deltas resolve to a valid frame.
        if (tpos) kickDir = dirFromDelta(mdx(tpos.x - ev.at.x), tpos.y - ev.at.y);
      }
    } else if (ev.kind === 'shot_on' || ev.kind === 'shot_off') {
      const goalX = ev.side === 'home' ? 1.0 : 0.0;
      kickDir = dirFromDelta(mdx(goalX - ev.at.x), 0.5 - ev.at.y);
    } else if (ev.kind === 'reception' && ev.log === 'Fuera de banda') {
      // Throw-in pickup: face the intended receiver if provided.
      if (ev.target) {
        const tpos = kfA.positions[ev.target];
        if (tpos) kickDir = dirFromDelta(mdx(tpos.x - ev.at.x), tpos.y - ev.at.y);
      }

      if (!kickDir) {
        // Fallback: face back into the field if no target.
        const onTop = ev.at.y < 0.5;
        const homeAttacksRight = (ev.side === 'home') !== flipped;
        const lateral: 'E' | 'W' = homeAttacksRight ? 'E' : 'W';
        if (onTop) {
          kickDir = (lateral === 'E' ? 'SE' : 'SW') as Dir8;
        } else {
          kickDir = (lateral === 'E' ? 'NE' : 'NW') as Dir8;
        }
      }
    }
    if (ev.kind || ev.log) {
      const teamStr = ev.side === 'home' ? homeTeamName : (ev.side === 'away' ? awayTeamName : '');
      const actionStr = ev.log || ev.kind; // fallback to kind if no log
      console.log(`[Match2D] Event: ${ev.kind} [${teamStr}] (${ev.log}) at ${ev.t}ms`);

      if (logsRef.current && actionStr && actionStr !== 'shot_on') {
        const el = document.createElement('div');
        const dispT = toDisplayMs(ev.t, timeline.durationMs, timeline.nominalMatchMs);
        const m = Math.floor(dispT / 60000);
        const s = Math.floor((dispT % 60000) / 1000);
        el.className = 'text-[8px] text-vga-bright-white mb-1 font-mono uppercase leading-tight';
        const prefix = teamStr ? `${teamStr}: ` : '';
        el.innerText = `[${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}] ${prefix}${actionStr}`;
        logsRef.current.appendChild(el);
        if (logsRef.current.children.length > 25) {
          logsRef.current.removeChild(logsRef.current.firstChild!);
        }
        logsRef.current.scrollTop = logsRef.current.scrollHeight;
      }
    }
    for (const [id, anim] of scene.animMap) {
      const isActor = ev.actor === id;
      const isTarget = ev.target === id;
      if (isActor && kickDir) anim.dir = kickDir;
      if (isActor || isTarget) firePlayerEvent(anim, ev, gt, isActor, isTarget);
    }

    // GK-specific events (save, goal_kick, distribution)
    if (ev.kind === 'save' || ev.kind === 'goal_kick' ||
        ev.kind === 'pass_short' || ev.kind === 'pass_forward' ||
        ev.kind === 'pass_back' || ev.kind === 'pass_lateral' ||
        ev.kind === 'gk_distribute') {
      const gkId = ev.side === 'home' ? scene.homeGK : scene.awayGK;
      const isGK = ev.actor === gkId;
      if (isGK) {
        const gkAnim = scene.gkAnimMap.get(gkId);
        if (gkAnim) {
          const gkPos = kfA.positions[gkId] ?? { x: ev.side === 'home' ? 0.015 : 0.985, y: 0.5 };
          const targetPos = ev.target ? kfA.positions[ev.target] : undefined;
          // Dive directions are vertical (x-mirror-agnostic); pass the effective
          // home/away so the swapped sprite set picks the right diagonal frames.
          fireGKEvent(gkAnim, ev, gt, ev.at, gkPos, (ev.side === 'home') !== flipped, targetPos);
        }
      }
    }

    // Celebration for all teammates on goal
    if (ev.kind === 'goal') {
      for (const [id, anim] of scene.animMap) {
        if (scene.playerSideMap.get(id) === ev.side) {
          fireCelebration(anim, gt);
          // Randomize direction for variety
          const dirs: Dir8[] = ['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW'];
          anim.dir = dirs[Math.floor(Math.random() * dirs.length)];
        }
      }
      scene.goalOverlay.visible = true;
      rt.goalTimer = 180;
    }

    if (ev.kind === 'throw_in') {
      console.log('[Match2D] TRIGGERING FUERA OVERLAY');
      scene.fueraOverlay.visible = true;
      rt.fueraTimer = 180; // Show for ~3 seconds
    }
    // Shot off where the ball actually leaves the field (not a
    // post graze). Triggers the same FUERA cue as a throw-in
    // while the corner / goal-kick sequence resets play.
    if (ev.kind === 'shot_off' && ev.log === 'Disparo fuera') {
      scene.fueraOverlay.visible = true;
      rt.fueraTimer = 180;
    }
    // Corner: replace whatever overlay was just queued (a shot_off
    // emitted on the same tick will have flipped FUERA on) and show
    // CORNER instead. Covers both "shot deflected wide" and "pass
    // touched by defender over their own goal line".
    if (ev.kind === 'corner') {
      scene.fueraOverlay.visible = false;
      rt.fueraTimer = 0;
      scene.cornerOverlay.visible = true;
      rt.cornerTimer = 180;
    }
    if (ev.kind === 'foul') {
      scene.foulOverlay.visible = true;
      rt.foulTimer = 180;
    }
    if (ev.kind === 'penalty') {
      scene.penaltyOverlay.visible = true;
      rt.penaltyTimer = 180;
    }
    if (ev.kind === 'card') {
      // Reset children, then arrange based on detail. The card event
      // fires immediately after its foul/penalty event so the timers
      // get extended to keep the whole tableau on-screen through the
      // walk-off (red / second-yellow take ~8 game-seconds before the
      // free kick is taken).
      scene.cardYLeft.visible = false;
      scene.cardYRight.visible = false;
      scene.cardRed.visible = false;
      scene.cardOverlay.visible = true;
      if (ev.detail === 'yellow') {
        scene.cardYLeft.visible = true;
        scene.cardYLeft.x = 0;
        rt.cardTimer = 180;
      } else if (ev.detail === 'second_yellow') {
        scene.cardYLeft.visible  = true; scene.cardYLeft.x  = -scene.cardSpacing;
        scene.cardYRight.visible = true; scene.cardYRight.x = 0;
        scene.cardRed.visible    = true; scene.cardRed.x    = scene.cardSpacing;
        rt.cardTimer = 480;
      } else {
        // 'red' (direct)
        scene.cardRed.visible = true;
        scene.cardRed.x = 0;
        rt.cardTimer = 480;
      }
      // Keep foul/penalty overlay on-screen for at least as long as
      // the card itself — otherwise the card lingers alone after the
      // foul icon disappears.
      if (rt.foulTimer > 0)    rt.foulTimer    = Math.max(rt.foulTimer,    rt.cardTimer);
      if (rt.penaltyTimer > 0) rt.penaltyTimer = Math.max(rt.penaltyTimer, rt.cardTimer);
    }
  }

  // Update overlays
  if (rt.fueraTimer > 0) {
    rt.fueraTimer -= ticker.deltaTime;
    if (rt.fueraTimer <= 0) scene.fueraOverlay.visible = false;
  }
  if (rt.goalTimer > 0) {
    rt.goalTimer -= ticker.deltaTime;
    if (rt.goalTimer <= 0) scene.goalOverlay.visible = false;
  }
  if (rt.cornerTimer > 0) {
    rt.cornerTimer -= ticker.deltaTime;
    if (rt.cornerTimer <= 0) scene.cornerOverlay.visible = false;
  }
  if (rt.foulTimer > 0) {
    rt.foulTimer -= ticker.deltaTime;
    if (rt.foulTimer <= 0) scene.foulOverlay.visible = false;
  }
  if (rt.penaltyTimer > 0) {
    rt.penaltyTimer -= ticker.deltaTime;
    if (rt.penaltyTimer <= 0) scene.penaltyOverlay.visible = false;
  }
  if (rt.cardTimer > 0) {
    rt.cardTimer -= ticker.deltaTime;
    if (rt.cardTimer <= 0) scene.cardOverlay.visible = false;
  }

  // Update player sprites
  for (const [id, entry] of scene.spriteMap) {
    const posA = kfA.positions[id];
    const posB = kfB.positions[id];
    if (!posA || !posB) continue;

    const nx = lerp(posA.x, posB.x, t);
    const ny = lerp(posA.y, posB.y, t);

    const dx = posB.x - posA.x;
    const dy = posB.y - posA.y;
    const spd = Math.sqrt(dx * dx + dy * dy);
    // Force not moving if game just started and is paused/at t=0
    const moving = (gt > 0) && spd >= (entry.isGK ? 0.0012 : MOVE_THRESHOLD);

    let key: string;
    let animSpeedBase = 0.09;

    if (entry.isGK) {
      const gkAnim = scene.gkAnimMap.get(id)!;
      const ballFlying = kfA.ballState === 'flying';
      const gkHolding = kfA.ballState === 'gk_holding';
      tickGKAnim(gkAnim, gt, ballFlying, gkHolding, moving);
      // After the change of ends the keeper stands at the opposite goal, so it
      // needs the other side's sprite set (left↔right). Swap the atlas and the
      // home/away flag the key generator uses.
      const effHomeGK = entry.isHomeGK !== flipped;
      entry.atlas = effHomeGK ? scene.gkLeftAtlas : scene.gkRightAtlas;
      key = gkAnimKey(effHomeGK, gkAnim.state, kfA.ball.y, posA.y, kfA.ball.x, posA.x, gkAnim.throwDir);

      if (gkAnim.state === 'throw') {
        animSpeedBase = 0.16;
      } else if (gkAnim.state === 'punt') {
        animSpeedBase = 0.135;
      }
    } else {
      const anim = scene.animMap.get(id)!;
      // Only update facing direction when not locked in a one-shot anim
      if (moving && anim.holdUntil === null) {
        anim.dir = dirFromDelta(mdx(dx), dy);
      } else if (gt === 0 || (anim.state === 'idle' && anim.holdUntil === null)) {
        // If idle or at start, face the ball to stay focused on the play
        const bdx = kfA.ball.x - nx;
        const bdy = kfA.ball.y - ny;
        if (Math.hypot(bdx, bdy) > 0.01) {
          anim.dir = dirFromDelta(mdx(bdx), bdy);
        }
      }
      tickPlayerAnim(anim, gt, moving);

      // Wall stance override. While the foul phases publish wallIds,
      // any wall member that has stopped moving snaps into the
      // "barrier" pose facing the ball. dirFromDelta can return N/S
      // when |dx| is small, but the atlas has no N/S barrier — bias
      // the choice so the result is always one of E/W/NE/NW/SE/SW.
      const wallIds = kfA.wallIds;
      if (!moving && wallIds && wallIds.includes(id) && anim.holdUntil === null) {
        const bdx = mdx(kfA.ball.x - nx);
        const bdy = kfA.ball.y - ny;
        const ax = Math.abs(bdx), ay = Math.abs(bdy);
        let bdir: Dir8;
        if (ay < ax * 0.4) {
          bdir = bdx > 0 ? 'E' : 'W';
        } else {
          bdir = ((bdy < 0 ? 'N' : 'S') + (bdx > 0 ? 'E' : 'W')) as Dir8;
        }
        anim.state = 'barrier';
        anim.dir = bdir;
      }

      key = playerAnimKey(anim.state, anim.dir);

      if (anim.state === 'kick' || anim.state === 'throw') {
        animSpeedBase = 0.16;
      }
    }
    entry.sp.x = toCanvasX(mir(nx));
    entry.sp.y = toCanvasY(ny);
    applyAnim(entry, key);
    // Sync animation playback with speed linearly so frames fit the phase duration exactly
    entry.sp.animationSpeed = (speedRef.current === 0) ? 0 : animSpeedBase * speedRef.current;
  }

  // Ball
  let bx = lerp(kfA.ball.x, kfB.ball.x, t);
  let by = lerp(kfA.ball.y, kfB.ball.y, t);
  let bHeight = lerp(kfA.ballHeight ?? 0, kfB.ballHeight ?? 0, t);
  const bState = kfA.ballState ?? 'free';

  // Prevent premature ball movement before it's actually released
  if (kfA.ballState === 'carried' && kfB.ballState === 'flying') {
    bx = kfA.ball.x;
    by = kfA.ball.y;
    bHeight = kfA.ballHeight ?? 0;
  }

  if (bState === 'gk_holding' || bState === 'throw_in_holding') {
    scene.ballSp.visible = false;
    scene.shadowSp.visible = false;
  } else {
    scene.ballSp.visible = true;
    scene.shadowSp.visible = bHeight > 0.005;

    const screenX = toCanvasX(mir(bx));
    const screenY = toCanvasY(by);

    scene.shadowSp.x = screenX;
    scene.shadowSp.y = screenY;

    scene.ballSp.x = screenX;
    scene.ballSp.y = screenY - (bHeight * 280);

    // If the ball is stationary or visually held, don't play the spinning animation
    const bDx = kfB.ball.x - kfA.ball.x;
    const bDy = kfB.ball.y - kfA.ball.y;
    const bMoving = Math.hypot(bDx, bDy) > 0.0001 && !(kfA.ballState === 'carried' && kfB.ballState === 'flying');

    if (bHeight > 0.005) {
       const hLevel = ballHeightLevel(bHeight);
       const hKey = `ball_h${hLevel}`;
       if (scene.ballAtlas.animations[hKey] && scene.ballSp.textures !== scene.ballAtlas.animations[hKey]) {
         scene.ballSp.textures = scene.ballAtlas.animations[hKey];
       }
       const sKey = `ball_shadow_h${hLevel}`;
       if (scene.ballAtlas.animations[sKey] && scene.shadowSp.textures !== scene.ballAtlas.animations[sKey]) {
         scene.shadowSp.textures = scene.ballAtlas.animations[sKey];
       }
       if (bMoving) {
         scene.ballSp.play();
         scene.shadowSp.play();
       } else {
         scene.ballSp.stop();
         scene.shadowSp.stop();
       }
    } else {
       if (scene.ballAtlas.animations['ball_ground'] && scene.ballSp.textures !== scene.ballAtlas.animations['ball_ground']) {
         scene.ballSp.textures = scene.ballAtlas.animations['ball_ground'];
       }
       if (bMoving) {
         scene.ballSp.play();
       } else {
         scene.ballSp.stop();
       }
    }
  }

  // Score tracking (pointer-based, O(1) per frame)
  let scoreChanged = false;
  while (rt.goalIdx < scene.goalEvents.length && scene.goalEvents[rt.goalIdx].t <= gt) {
    if (scene.goalEvents[rt.goalIdx].side === 'home') rt.homeScore++;
    else rt.awayScore++;
    rt.goalIdx++;
    scoreChanged = true;
  }
  if (scoreChanged && scoreRef.current) {
    scoreRef.current.textContent = `${rt.homeScore} - ${rt.awayScore}`;
  }

  // Minute display — remap the compressed timeline time to a 0–90' match minute.
  if (minuteRef.current) {
    const dispT = toDisplayMs(gt, timeline.durationMs, timeline.nominalMatchMs);
    const cap = timeline.nominalMatchMs ? timeline.nominalMatchMs / 60000 : Infinity;
    const min = Math.min(cap, Math.floor(dispT / 60000));
    minuteRef.current.textContent = `${min}'`;
  }
}
