// Foul resolution: classify a foul's severity, decide cards/injuries, then run
// the consequences (free kick or red-card walk-off). executeFoul is the entry
// point; detectSeverity/decideCard are its internal decision steps.

import type { Vec2, PlayerId, TeamSide } from '../../types/match';
import type { MatchState } from '../types';
import type { EnginePlayer } from '../zoneEngine';
import { emit as stateEmit, snap as stateSnap, roleOf, resetCarry as stateResetCarry } from '../state';
import { startFoul, startExpulsion, isInPenaltyArea } from '../phases';
import { clamp, KICK_FREEZE_MS } from './shared';

const DOWN_MS = 2000;
// Reiteration thresholds for the yellow / second-yellow paths. The counter
// (EnginePlayer.foulsCommitted) is cumulative for the match, so the second
// threshold is "3 for the first + 2 more" = 5 total before another normal
// foul tips into a second yellow. cynical fouls still bypass the counter
// and book on their own.
const REITERATION_THRESHOLD_FIRST  = 3;
const REITERATION_THRESHOLD_SECOND = 5;

type FoulSeverity = 'dogso' | 'cynical' | 'reckless' | 'normal';
type CardKind = 'yellow' | 'red' | 'second_yellow';
// Why a card was given — drives the visible log string. 'reiteration' is the
// fouls-count path; the others mirror the severity that triggered the booking.
type CardReason = 'reiteration' | 'cynical' | 'reckless' | 'dogso';

const CARD_REASON_TEXT: Record<CardReason, string> = {
  reiteration: 'reiteración',
  cynical:     'falta táctica',
  reckless:    'entrada peligrosa',
  dogso:       'ocasión manifiesta de gol',
};

// Inspect the state at the moment of the foul and classify it. Used by the
// card decision tree and the injury roll. The DOGSO and cynical checks rely
// on positions/velocity captured before checkTackle zeroes the carrier — call
// this BEFORE mutating state.vel[carrier.id].
function detectSeverity(
  state: MatchState,
  carrier: EnginePlayer,
  opp: EnginePlayer,
  cSide: TeamSide,
): FoulSeverity {
  const cpos = state.pos[carrier.id];
  const opps = cSide === 'home' ? state.awayPlayers : state.homePlayers;
  const oppOutfielders = opps.filter(p => p.slotIndex !== 0 && p.id !== opp.id);

  // DOGSO — carrier in shooting range with no covering rival outfielders
  // between him and the goal. The keeper is the only one left. Y is scaled by
  // 1.5 to roughly normalise the field aspect when measuring distance.
  const goalX = cSide === 'home' ? 1.0 : 0.0;
  const distToGoal = Math.hypot(cpos.x - goalX, (cpos.y - 0.5) * 1.5);
  const inShootingRange = distToGoal < 0.30;
  const defendersAhead = oppOutfielders.filter(d => {
    const dpos = state.pos[d.id];
    return cSide === 'home' ? dpos.x > cpos.x : dpos.x < cpos.x;
  });
  if (inShootingRange && defendersAhead.length === 0) return 'dogso';

  // RECKLESS — defender lunged in: big speed gap, low defending stat, tackler
  // arrived from behind. Models the "agresión" path (straight red).
  // Beaten-for-pace gap uses acceleration (the burst that leaves a defender
  // lunging) and the defender's reading (markSkill); flat stats for legacy data.
  const carrierPace = carrier.attr ? carrier.attr.acceleration * 99 : carrier.speed;
  const oppPace = opp.attr ? opp.attr.acceleration * 99 : opp.speed;
  const oppRead = opp.attr ? opp.attr.markSkill * 99 : opp.defending;
  const speedGap = carrierPace - oppPace;
  const tacklerBehind = cSide === 'home'
    ? state.pos[opp.id].x < cpos.x - 0.005
    : state.pos[opp.id].x > cpos.x + 0.005;
  if (speedGap > 15 && oppRead < 70 && tacklerBehind) return 'reckless';

  // CYNICAL — professional foul stopping a breakaway. Carrier was sprinting
  // forward and no other rival was within ~0.15 (covering distance).
  const cvel = state.vel[carrier.id];
  const cvelMag = Math.hypot(cvel.x, cvel.y);
  const goingForward = cSide === 'home' ? cvel.x > 0.008 : cvel.x < -0.008;
  const coveringNearby = oppOutfielders.some(d => {
    const dpos = state.pos[d.id];
    return Math.hypot(dpos.x - cpos.x, dpos.y - cpos.y) < 0.15;
  });
  if (cvelMag > 0.012 && goingForward && !coveringNearby) return 'cynical';

  return 'normal';
}

// Card-issuing rules. DOGSO/reckless → straight red. Cynical or reiteration
// (3rd+ foul of the match) → yellow, or second yellow if already booked. v1
// returns null for goalkeepers (caller is responsible for skipping the call).
function decideCard(severity: FoulSeverity, opp: EnginePlayer): { kind: CardKind; reason: CardReason } | null {
  if (severity === 'dogso')    return { kind: 'red', reason: 'dogso' };
  if (severity === 'reckless') return { kind: 'red', reason: 'reckless' };

  const reiterationThreshold = opp.yellowCount === 0
    ? REITERATION_THRESHOLD_FIRST
    : REITERATION_THRESHOLD_SECOND;
  // Cynical takes precedence as the reason — it's a more specific narrative
  // than "they just hit X fouls". Reiteration only labels the booking when
  // the severity itself wouldn't have warranted one.
  const isCynical    = severity === 'cynical';
  const isReiterated = opp.foulsCommitted >= reiterationThreshold;
  if (!isCynical && !isReiterated) return null;

  const kind: CardKind = opp.yellowCount >= 1 ? 'second_yellow' : 'yellow';
  const reason: CardReason = isCynical ? 'cynical' : 'reiteration';
  return { kind, reason };
}

// Run the post-detection portion of a foul: increment the tackler's foul
// counter, roll an injury on the victim, freeze the actors, decide the
// card, emit the foul/card events, and either start the free-kick (no red)
// or stash pendingFoul + start the walk-off (red / 2nd yellow). Pulled out
// of checkTackle so the sandbox can call it directly to bypass the dice and
// force a specific severity (otherwise the cynical/dogso/reckless paths are
// hard to reach naturally in a 10-second clip).
//
// opts.forceSeverity: skip detectSeverity and use the given category. Used
//   by sandbox scenarios that pin a specific card-path.
// opts.forceInjury: skip the random roll and inject the carrier with the
//   "definitely injured" outcome. Used by the injury sandbox scenario.
export function executeFoul(
  state: MatchState,
  t: number,
  tacklerId: PlayerId,
  victimId: PlayerId,
  opts?: { forceSeverity?: FoulSeverity; forceInjury?: boolean },
): void {
  const tackler = state.playerMap.get(tacklerId)!;
  const victim  = state.playerMap.get(victimId)!;
  const vSide: TeamSide = state.homeSet.has(victimId) ? 'home' : 'away';

  const severity = opts?.forceSeverity ?? detectSeverity(state, victim, tackler, vSide);
  tackler.foulsCommitted++;

  // Injury roll on the victim. opts.forceInjury bypasses the roll for sandbox
  // scenarios that want to guarantee the injured-slow visual.
  if (!victim.injured) {
    if (opts?.forceInjury) {
      victim.injured = true;
      state.injuredIds.add(victim.id);
    } else {
      const injuryBase = severity === 'reckless' ? 0.18
                       : severity === 'dogso'    ? 0.10
                       : severity === 'cynical'  ? 0.06
                                                 : 0.03;
      const physicalFactor = 1 - (victim.attr?.resilience ?? victim.physical / 99);
      const injuryProb = clamp(injuryBase * (0.5 + physicalFactor), 0, 0.5);
      if (state.rng() < injuryProb) {
        victim.injured = true;
        state.injuredIds.add(victim.id);
      }
    }
    // Surface a fresh injury as a timeline event so the log shows it and the
    // manager can register it on close (see managerBridge.timelineToMatchResult).
    if (victim.injured) {
      stateEmit(state, t, 'injury', vSide, victim.id, tackler.id, '¡Lesión!');
    }
  }

  const atkSide: TeamSide = vSide;
  // Free kick is taken from where the fouled player fell.
  const spot: Vec2 = { x: state.pos[victim.id].x, y: state.pos[victim.id].y };
  state.downUntil.set(victim.id, t + DOWN_MS);
  state.vel[victim.id] = { x: 0, y: 0 };
  state.kickFrozenUntil.set(tackler.id, t + KICK_FREEZE_MS);
  state.vel[tackler.id] = { x: 0, y: 0 };
  stateResetCarry(state, victim);

  // Card decision (resolved BEFORE choosing set-piece vs walk-off path).
  // v1 skips goalkeepers entirely.
  const tacklerRole = roleOf(state, tackler);
  const card = tacklerRole === 'gk' ? null : decideCard(severity, tackler);
  if (card) {
    if (card.kind === 'yellow') {
      tackler.yellowCount = 1;
    } else {
      tackler.redCard = true;
      state.expelledIds.add(tackler.id);
    }
  }
  const sendOff = card?.kind === 'red' || card?.kind === 'second_yellow';

  stateSnap(state, t);

  const isPenalty = isInPenaltyArea(spot, atkSide);

  if (sendOff) {
    state.pendingFoul = { spot, atkSide, victimId: victim.id, severity, expelledId: tackler.id };
    startExpulsion(state);
  } else {
    startFoul(state, spot, atkSide, victim.id);
  }

  stateEmit(state, t, isPenalty ? 'penalty' : 'foul', atkSide, tackler.id, victim.id,
    isPenalty ? '¡Penalti!' : '¡Falta!');

  if (card) {
    const tacklerSide: TeamSide = vSide === 'home' ? 'away' : 'home';
    const reasonText = CARD_REASON_TEXT[card.reason];
    const cardLog = card.kind === 'yellow'
      ? `¡Tarjeta amarilla por ${reasonText}!`
      : card.kind === 'second_yellow'
        ? `¡Doble amarilla por ${reasonText}! Expulsión`
        : `¡Tarjeta roja directa por ${reasonText}! Expulsión`;
    stateEmit(state, t, 'card', tacklerSide, tackler.id, victim.id, cardLog, card.kind);
  }

  stateSnap(state, t);
}
