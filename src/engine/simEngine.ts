import type { Team, MatchState, MatchEvent, Player, Position } from '../types/game.d.ts';
import { FORMATIONS, buildSlotMap, effectiveStat, positionLevelFactor } from './formations';
import { t } from '../i18n';
import { engineSettings } from './engineSettings';

export const calculateTeamStrength = (team: Team, sentOff: string[] = [], stamina?: Record<string, number>) => {
  if (!team.lineup || !team.formation) return 0;
  const slots = FORMATIONS[team.formation];
  if (!slots) return 0;
  let total = 0;
  for (let i = 0; i < team.lineup.length && i < slots.length; i++) {
    const pid = team.lineup[i];
    if (sentOff.includes(pid)) continue;
    const p = team.players.find(pp => pp.id === pid);
    if (!p) continue;
    // Temporarily override stamina on player object so effectiveAbility reads the match value.
    const overrideStam = stamina ? (stamina[pid] ?? p.stamina ?? 99) : (p.stamina ?? 99);
    const ca = p.current_ability ?? (p.media ?? 50) * 2;
    const stamFactor = 0.8 + 0.2 * (overrideStam / 99);
    total += ca * positionLevelFactor(p, slots[i]) * stamFactor;
  }
  return total / 11;
};

const INJURY_CHANCE_PER_MIN = 0.00025;
const STAMINA_DECAY_BASE = 0.25;
const STAMINA_DECAY_FIS = 0.15;

// Stamina points an on-pitch player loses per played minute. Físico is the only
// per-player driver (high físico lasts longer): físico 99 → 0.25/min, físico 0
// → 0.40/min, then scaled by the engine-setting multiplier. Single source of
// truth so the text-sim writeback and the 2D ENERGIA bar deplete identically.
export function staminaDecayPerMin(physical: number): number {
  return (STAMINA_DECAY_BASE + (1 - physical / 99) * STAMINA_DECAY_FIS) * engineSettings.staminaDecayMult;
}

const calcStoppage = (events: MatchEvent[], fromMin: number, toMin: number): number => {
  const half = events.filter(e => e.minute > fromMin && e.minute <= toMin);
  const goals    = half.filter(e => e.type === 'goal').length;
  const subs     = half.filter(e => e.type === 'sub').length;
  const injuries = half.filter(e => e.type === 'injury').length;
  const reds     = half.filter(e => e.type === 'red').length;
  const isFirst  = fromMin === 0;
  const base = isFirst ? 1 : 3;
  const raw  = base + goals * 0.5 + subs * 0.3 + injuries * 0.5 + reds * 0.3;
  return Math.round(Math.min(isFirst ? 3 : 7, Math.max(isFirst ? 1 : 3, raw)));
};

export const simulateMinute = (state: MatchState, userTeamId?: string): MatchState => {
  if (state.isFinished) return state;

  const nextMinute = state.minute + 1;
  let stoppageTime1 = state.stoppageTime1;
  let stoppageTime2 = state.stoppageTime2;
  let newEvents: MatchEvent[] = [...state.events];
  let homeScore = state.homeScore;
  let awayScore = state.awayScore;
  const homeSentOff = [...state.homeSentOff];
  const awaySentOff = [...state.awaySentOff];
  const homeYellows = [...state.homeYellows];
  const awayYellows = [...state.awayYellows];
  let homeShots = state.homeShots;
  let awayShots = state.awayShots;
  let homeShotsOnTarget = state.homeShotsOnTarget;
  let awayShotsOnTarget = state.awayShotsOnTarget;
  let homeFouls = state.homeFouls;
  let awayFouls = state.awayFouls;
  const newHomeStamina = { ...state.homeStamina };
  const newAwayStamina = { ...state.awayStamina };
  const homeInjuredInMatch = [...state.homeInjuredInMatch];
  const awayInjuredInMatch = [...state.awayInjuredInMatch];
  let homeSubsUsed = state.homeSubsUsed;
  let awaySubsUsed = state.awaySubsUsed;
  let homeTeam = state.homeTeam;
  let awayTeam = state.awayTeam;

  // AI Tactical Substitutions
  if (nextMinute >= 60 && nextMinute <= 88 && nextMinute % 5 === 0) {
    for (const isHome of [true, false] as const) {
      const team = isHome ? homeTeam : awayTeam;
      if (team.id === userTeamId) continue;
      
      const subsUsed = isHome ? homeSubsUsed : awaySubsUsed;
      if (subsUsed >= 3) continue;

      const stamMap = isHome ? newHomeStamina : newAwayStamina;
      const injured = isHome ? homeInjuredInMatch : awayInjuredInMatch;
      const sentOff = isHome ? homeSentOff : awaySentOff;

      const tired = team.lineup
        .filter(id => id && !injured.includes(id) && !sentOff.includes(id))
        .map(id => ({ id, stam: stamMap[id] ?? 99 }))
        .filter(x => x.stam < 55)
        .sort((a, b) => a.stam - b.stam);

      if (tired.length > 0) {
        const inLineup = new Set(team.lineup);
        const bench = team.players
          .filter(p => 
            !inLineup.has(p.id) && 
            !injured.includes(p.id) && 
            !sentOff.includes(p.id) && 
            (p.injuryWeeksRemaining ?? 0) === 0 && 
            p.suspensionMatches === 0 &&
            (stamMap[p.id] ?? p.stamina ?? 99) > 80
          )
          .sort((a, b) => b.media - a.media);

        if (bench.length > 0) {
          const playerOutId = tired[0].id;
          const playerIn = bench[0];
          const playerOut = team.players.find(p => p.id === playerOutId)!;

          const newLineup = team.lineup.map(id => id === playerOutId ? playerIn.id : id);
          newEvents.push({
            minute: nextMinute,
            type: 'sub',
            description: t('commentary.sub', { team: team.name, in: playerIn.fullName, out: playerOut.fullName }),
            teamId: team.id,
            playerId: playerIn.id,
            playerOffId: playerOutId,
          });

          if (isHome) {
            homeTeam = { ...homeTeam, lineup: newLineup };
            homeSubsUsed++;
            newHomeStamina[playerIn.id] = playerIn.stamina ?? 99;
          } else {
            awayTeam = { ...awayTeam, lineup: newLineup };
            awaySubsUsed++;
            newAwayStamina[playerIn.id] = playerIn.stamina ?? 99;
          }
        }
      }
    }
  }

  const sf = (pid: string, stamMap: Record<string, number>): number =>
    (stamMap[pid] ?? 99) / 99;

  const homeStrength = calculateTeamStrength(homeTeam, homeSentOff, newHomeStamina);
  const awayStrength = calculateTeamStrength(awayTeam, awaySentOff, newAwayStamina);

  const homeSlotMap = buildSlotMap(homeTeam);
  const awaySlotMap = buildSlotMap(awayTeam);
  const slotOf = (playerId: string, isHome: boolean): Position => {
    const m = isHome ? homeSlotMap : awaySlotMap;
    const team = isHome ? homeTeam : awayTeam;
    const fallback = team.players.find(p => p.id === playerId)?.position ?? 'MED';
    return m.get(playerId) ?? fallback;
  };

  const homeBoost = state.homeBoost;

  const POSSESSION_EXP = engineSettings.possessionDiffExp;
  const homePow = Math.pow(homeStrength * homeBoost, POSSESSION_EXP);
  const awayPow = Math.pow(awayStrength || 1, POSSESSION_EXP);
  const homeProb = homePow / (homePow + awayPow);
  const homeHasBall = Math.random() < homeProb;
  const homePossession = state.homePossession + (homeHasBall ? 1 : 0);
  const awayPossession = state.awayPossession + (homeHasBall ? 0 : 1);

  if (Math.random() < engineSettings.matchEventRate) {
    const isHomeEvent = homeHasBall;
    const attackingTeam = isHomeEvent ? homeTeam : awayTeam;
    const defendingTeam = isHomeEvent ? awayTeam : homeTeam;
    const atkStamMap = isHomeEvent ? newHomeStamina : newAwayStamina;
    const defStamMap = isHomeEvent ? newAwayStamina : newHomeStamina;

    const rand = Math.random();

    // GOL / OCASIÓN (40% de los eventos)
    if (rand < 0.4) {
      const actingSentOff = isHomeEvent ? homeSentOff : awaySentOff;
      const defSentOffNow = isHomeEvent ? awaySentOff : homeSentOff;
      const attackLineup = attackingTeam.players.filter(p => attackingTeam.lineup.includes(p.id) && !actingSentOff.includes(p.id));
      const defenseLineup = defendingTeam.players.filter(p => defendingTeam.lineup.includes(p.id) && !defSentOffNow.includes(p.id));

      const positionWeights: Record<string, number> = { DEL: 4, AML: 3, AMR: 3, MED: 2, DEF: 0.6, POR: 0 };
      const shooterPool = attackLineup.filter(p => slotOf(p.id, isHomeEvent) !== 'POR');
      let shooter: Player | undefined;
      if (shooterPool.length > 0) {
        const weights = shooterPool.map(p => positionWeights[slotOf(p.id, isHomeEvent)] ?? 1);
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let r = Math.random() * totalWeight;
        for (let i = 0; i < shooterPool.length; i++) {
          r -= weights[i];
          if (r <= 0) { shooter = shooterPool[i]; break; }
        }
        if (!shooter) shooter = shooterPool[shooterPool.length - 1];
      }

      const gk = defenseLineup.find(p => slotOf(p.id, !isHomeEvent) === 'POR');
      const defs = defenseLineup.filter(p => slotOf(p.id, !isHomeEvent) === 'DEF');
      const defenderPool = defs.length > 0 ? defs : defenseLineup.filter(p => slotOf(p.id, !isHomeEvent) !== 'POR');
      const defender = defenderPool.length > 0 ? defenderPool[Math.floor(Math.random() * defenderPool.length)] : undefined;

      const attackerBoost = isHomeEvent ? homeBoost : 1;
      const defenderBoost = isHomeEvent ? 1 : homeBoost;
      const shooterSlot = shooter ? slotOf(shooter.id, isHomeEvent) : 'DEL';
      const gkSlot: Position = 'POR';
      const defenderSlot = defender ? slotOf(defender.id, !isHomeEvent) : 'DEF';
      const shooterSHO = (shooter ? effectiveStat(shooter, 'shooting', shooterSlot) * sf(shooter.id, atkStamMap) : 50) * attackerBoost;
      const gkDef = (gk ? effectiveStat(gk, 'goalkeeping', gkSlot) * sf(gk.id, defStamMap) : 50) * defenderBoost;
      const defDef = (defender ? effectiveStat(defender, 'defending', defenderSlot) * sf(defender.id, defStamMap) : 50) * defenderBoost;
      const defenseValue = (gkDef + defDef) / 2;
      const duelRatio = shooterSHO / Math.max(defenseValue, 1);
      const attackerStrength = isHomeEvent ? homeStrength : awayStrength;
      const defenderStrength = isHomeEvent ? awayStrength : homeStrength;
      const teamRatio = attackerStrength / Math.max(defenderStrength, 1);
      const goalChance = Math.max(0.04, Math.min(0.55, 0.22 * engineSettings.goalChanceMult * Math.pow(duelRatio, 1.8) * Math.pow(teamRatio, 0.6)));

      if (isHomeEvent) homeShots++; else awayShots++;

      if (shooter && Math.random() < goalChance) {
        if (isHomeEvent) { homeScore++; homeShotsOnTarget++; }
        else { awayScore++; awayShotsOnTarget++; }

        const ownGk = attackLineup.find(p => slotOf(p.id, isHomeEvent) === 'POR');
        const scorer = (ownGk && Math.random() < 0.0008) ? ownGk : shooter;

        let assistant: Player | undefined;
        if (Math.random() < engineSettings.assistRate) {
          const possibleAssistants = attackLineup.filter(p => p.id !== scorer.id && slotOf(p.id, isHomeEvent) !== 'POR');
          if (possibleAssistants.length > 0) {
            assistant = possibleAssistants[Math.floor(Math.random() * possibleAssistants.length)];
          }
        }

        newEvents.push({
          minute: nextMinute,
          type: 'goal',
          description: assistant
            ? t('commentary.goalAssist', { team: attackingTeam.name, scorer: scorer.fullName, assist: assistant.fullName })
            : t('commentary.goal', { team: attackingTeam.name, scorer: scorer.fullName }),
          teamId: attackingTeam.id,
          playerId: scorer.id,
          assistantId: assistant?.id
        });
      } else {
        const shooterLabel = shooter ? shooter.fullName : attackingTeam.name;
        const onTarget = Math.random() < 0.4;
        if (onTarget) {
          if (isHomeEvent) homeShotsOnTarget++; else awayShotsOnTarget++;
          const gkLabel = gk ? gk.fullName : t('label.player');
          newEvents.push({
            minute: nextMinute,
            type: 'shot',
            description: t('commentary.shot', { shooter: shooterLabel, keeper: gkLabel }),
            teamId: attackingTeam.id
          });
        } else {
          newEvents.push({
            minute: nextMinute,
            type: 'shot',
            description: t('commentary.shotWide', { team: attackingTeam.name, shooter: shooterLabel }),
            teamId: attackingTeam.id
          });
        }
      }
    }
    // FALTAS Y TARJETAS (20% de los eventos)
    else if (rand < 0.6) {
      if (isHomeEvent) awayFouls++; else homeFouls++;

      const defSentOff = isHomeEvent ? awaySentOff : homeSentOff;
      const defYellows = isHomeEvent ? awayYellows : homeYellows;
      const attackingSentOff = isHomeEvent ? homeSentOff : awaySentOff;

      const attackers = attackingTeam.players.filter(p =>
        attackingTeam.lineup.includes(p.id) &&
        !attackingSentOff.includes(p.id) &&
        slotOf(p.id, isHomeEvent) !== 'POR'
      );
      const defenderPool = defendingTeam.players.filter(p =>
        defendingTeam.lineup.includes(p.id) &&
        !defSentOff.includes(p.id) &&
        slotOf(p.id, !isHomeEvent) !== 'POR'
      );
      const defenders = defenderPool.filter(p => slotOf(p.id, !isHomeEvent) === 'DEF');
      const defenderCandidates = defenders.length > 0 ? defenders : defenderPool;

      if (attackers.length > 0 && defenderCandidates.length > 0) {
        const attacker = attackers[Math.floor(Math.random() * attackers.length)];
        const defender = defenderCandidates[Math.floor(Math.random() * defenderCandidates.length)];
        const attackerSlot = slotOf(attacker.id, isHomeEvent);
        const defenderSlot = slotOf(defender.id, !isHomeEvent);

        const atkBoost = isHomeEvent ? homeBoost : 1;
        const defBoost = isHomeEvent ? 1 : homeBoost;
        const attackerSkill = (effectiveStat(attacker, 'dribbling', attackerSlot) + effectiveStat(attacker, 'speed', attackerSlot)) * atkBoost * sf(attacker.id, atkStamMap);
        const defenderSkill = (effectiveStat(defender, 'defending', defenderSlot) + effectiveStat(defender, 'physical', defenderSlot)) * defBoost * sf(defender.id, defStamMap);
        const gap = attackerSkill - defenderSkill;
        const cardMod = Math.max(0.5, Math.min(1.7, 1 + gap * 0.01));
        const yellowThreshold = 0.15 * cardMod * engineSettings.cardStrictness;
        const redThreshold = yellowThreshold + 0.02 * cardMod * engineSettings.cardStrictness;
        const cardRand = Math.random();

        if (cardRand < yellowThreshold) {
          if (defYellows.includes(defender.id)) {
            defSentOff.push(defender.id);
            newEvents.push({
              minute: nextMinute,
              type: 'red',
              description: t('commentary.yellowRed', { defender: defender.fullName, team: defendingTeam.name, attacker: attacker.fullName }),
              teamId: defendingTeam.id,
              playerId: defender.id,
            });
          } else {
            defYellows.push(defender.id);
            newEvents.push({
              minute: nextMinute,
              type: 'yellow',
              description: t('commentary.yellow', { defender: defender.fullName, attacker: attacker.fullName, team: defendingTeam.name }),
              teamId: defendingTeam.id,
              playerId: defender.id,
            });
          }
        } else if (cardRand < redThreshold) {
          defSentOff.push(defender.id);
          newEvents.push({
            minute: nextMinute,
            type: 'red',
            description: t('commentary.red', { defender: defender.fullName, team: defendingTeam.name, attacker: attacker.fullName }),
            teamId: defendingTeam.id,
            playerId: defender.id,
          });
        }
      }
    }
  }

  // Desgaste de stamina para todos los titulares activos
  for (const [pid, stam] of Object.entries(newHomeStamina)) {
    if (homeSentOff.includes(pid) || homeInjuredInMatch.includes(pid)) continue;
    const p = homeTeam.players.find(pp => pp.id === pid);
    if (!p || !homeTeam.lineup.includes(pid)) continue;
    newHomeStamina[pid] = Math.max(1, stam - staminaDecayPerMin(p.stats.physical));
  }
  for (const [pid, stam] of Object.entries(newAwayStamina)) {
    if (awaySentOff.includes(pid) || awayInjuredInMatch.includes(pid)) continue;
    const p = awayTeam.players.find(pp => pp.id === pid);
    if (!p || !awayTeam.lineup.includes(pid)) continue;
    newAwayStamina[pid] = Math.max(1, stam - staminaDecayPerMin(p.stats.physical));
  }

  // Sorteo de lesiones
  for (const isHome of [true, false] as const) {
    const team = isHome ? homeTeam : awayTeam;
    const sentOff = isHome ? homeSentOff : awaySentOff;
    const injured = isHome ? homeInjuredInMatch : awayInjuredInMatch;
    const stamMap = isHome ? newHomeStamina : newAwayStamina;

    for (const pid of team.lineup) {
      if (sentOff.includes(pid) || injured.includes(pid)) continue;
      if (Math.random() >= INJURY_CHANCE_PER_MIN * engineSettings.injuryMult) continue;

      const player = team.players.find(p => p.id === pid);
      if (!player) continue;

      newEvents.push({
        minute: nextMinute,
        type: 'injury',
        description: t('commentary.injury', { player: player.fullName, team: team.name }),
        teamId: team.id,
        playerId: pid,
      });
      injured.push(pid);

      const subsUsed = isHome ? homeSubsUsed : awaySubsUsed;
      const inLineup = new Set(team.lineup);
      const bench = team.players.filter(p =>
        !inLineup.has(p.id) &&
        !injured.includes(p.id) &&
        !sentOff.includes(p.id) &&
        (p.injuryWeeksRemaining ?? 0) === 0 &&
        p.suspensionMatches === 0
      );

      if (subsUsed < 3 && bench.length > 0) {
        const sub = bench.reduce((best, p) => p.media > best.media ? p : best, bench[0]);
        const newLineup = team.lineup.map(id => id === pid ? sub.id : id);
        stamMap[sub.id] = sub.stamina ?? 99;
        newEvents.push({
          minute: nextMinute,
          type: 'sub',
          description: t('commentary.sub', { team: team.name, in: sub.fullName, out: player.fullName }),
          teamId: team.id,
          playerId: sub.id,
          playerOffId: pid,
        });
        if (isHome) {
          homeTeam = { ...homeTeam, lineup: newLineup };
          homeSubsUsed++;
        } else {
          awayTeam = { ...awayTeam, lineup: newLineup };
          awaySubsUsed++;
        }
      } else {
        stamMap[pid] = 1;
      }
    }
  }

  // Compute stoppage time at the end of each half
  if (nextMinute === 45 && stoppageTime1 === 0) {
    stoppageTime1 = calcStoppage(newEvents, 0, 45);
    newEvents.push({ minute: 45, type: 'commentary', description: t('commentary.stoppageFirst', { min: String(stoppageTime1) }) });
  }
  if (nextMinute === 90 && stoppageTime2 === 0) {
    stoppageTime2 = calcStoppage(newEvents, 45, 90);
    newEvents.push({ minute: 90, type: 'commentary', description: t('commentary.stoppageSecond', { min: String(stoppageTime2) }) });
  }

  const isFinished = nextMinute >= 90 + stoppageTime2;

  if (isFinished) {
    newEvents.push({ minute: 90 + stoppageTime2, type: 'commentary', description: t('commentary.fulltime') });
  }

  return {
    ...state,
    homeTeam,
    awayTeam,
    minute: nextMinute,
    homeScore,
    awayScore,
    isFinished,
    events: newEvents,
    homeSentOff,
    awaySentOff,
    homeYellows,
    awayYellows,
    homePossession,
    awayPossession,
    homeShots,
    awayShots,
    homeShotsOnTarget,
    awayShotsOnTarget,
    homeFouls,
    awayFouls,
    homeStamina: newHomeStamina,
    awayStamina: newAwayStamina,
    homeInjuredInMatch,
    awayInjuredInMatch,
    homeSubsUsed,
    awaySubsUsed,
    stoppageTime1,
    stoppageTime2,
  };
};
