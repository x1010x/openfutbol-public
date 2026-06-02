import type { Scenario } from '../types';
import { penaltyHome, penaltyAway } from './penalty';
import { throwInHomeTop, throwInAwayBottom } from './throwIn';
import { cornerHomeTop, cornerHomeBottom, cornerAwayTop } from './corner';
import {
  freeKickShootNearHome,
  freeKickShootMidHome,
  freeKickShootHome,
  freeKickShootFarHome,
  freeKickShootLateralMidTopHome,
  freeKickShootLateralFarTopHome,
  freeKickShootLateralMidBottomHome,
  freeKickShootLateralFarBottomHome,
  freeKickCrossNearHome,
  freeKickCrossHome,
  freeKickCrossNearBottomHome,
  freeKickCrossBottomHome,
  freeKickCrossBylineHome,
  freeKickCrossNearAway,
  freeKickPassHome,
  freeKickShootMidAway,
} from './freeKick';
import { goalKickHome, goalKickAway } from './goalKick';
import {
  shotCloseCentral,
  shotPenaltySpotRange,
  shotEdgeOfBoxCentral,
  shotTightAngleNearPost,
  shotFromTheSide,
  shotLongRangeCentral,
  shotAwayFromCenter,
} from './shots';
import {
  shotTopPost,
  shotBottomPost,
  shotCrossbar,
  shotJustInsideTopPost,
  shotJustOutsideTopPost,
  shotJustInsideBottomPost,
  shotJustOutsideBottomPost,
} from './postShots';
import {
  tackleFromFront,
  tackleFromBehind,
  tackleLateral,
  looseBallMidfield,
  looseBallRolling,
  surroundedByDefenders,
} from './duels';
import { oneVoneHome, longShotHome, counterAttackHome, highPressOnGK } from './openPlay';
import {
  yellowReiteration,
  secondYellow,
  secondYellowCynical,
  dogsoRed,
  aggressionRed,
  injuryHardFoul,
  walkoffTopRight,
  walkoffTopLeft,
  offBallAggression,
} from './discipline';

export interface ScenarioGroup {
  label: string;
  scenarios: Scenario[];
}

export const SCENARIO_GROUPS: ScenarioGroup[] = [
  {
    label: 'Penaltis',
    scenarios: [penaltyHome, penaltyAway],
  },
  {
    label: 'Faltas',
    scenarios: [
      freeKickShootNearHome,
      freeKickShootMidHome,
      freeKickShootHome,
      freeKickShootFarHome,
      freeKickShootLateralMidTopHome,
      freeKickShootLateralFarTopHome,
      freeKickShootLateralMidBottomHome,
      freeKickShootLateralFarBottomHome,
      freeKickCrossNearHome,
      freeKickCrossHome,
      freeKickCrossNearBottomHome,
      freeKickCrossBottomHome,
      freeKickCrossBylineHome,
      freeKickCrossNearAway,
      freeKickPassHome,
      freeKickShootMidAway,
    ],
  },
  {
    label: 'Córners',
    scenarios: [cornerHomeTop, cornerHomeBottom, cornerAwayTop],
  },
  {
    label: 'Saques de banda',
    scenarios: [throwInHomeTop, throwInAwayBottom],
  },
  {
    label: 'Saques de puerta',
    scenarios: [goalKickHome, goalKickAway],
  },
  {
    label: 'Tiros',
    scenarios: [
      shotCloseCentral,
      shotPenaltySpotRange,
      shotEdgeOfBoxCentral,
      shotTightAngleNearPost,
      shotFromTheSide,
      shotLongRangeCentral,
      shotAwayFromCenter,
    ],
  },
  {
    label: 'Palos y línea de gol',
    scenarios: [
      shotTopPost,
      shotBottomPost,
      shotCrossbar,
      shotJustInsideTopPost,
      shotJustOutsideTopPost,
      shotJustInsideBottomPost,
      shotJustOutsideBottomPost,
    ],
  },
  {
    label: 'Duelos y robos',
    scenarios: [
      tackleFromFront,
      tackleFromBehind,
      tackleLateral,
      looseBallMidfield,
      looseBallRolling,
      surroundedByDefenders,
    ],
  },
  {
    label: 'Juego abierto',
    scenarios: [oneVoneHome, longShotHome, counterAttackHome, highPressOnGK],
  },
  {
    label: 'Disciplina (tarjetas / expulsiones / lesiones)',
    scenarios: [
      yellowReiteration,
      secondYellow,
      secondYellowCynical,
      dogsoRed,
      aggressionRed,
      injuryHardFoul,
      walkoffTopRight,
      walkoffTopLeft,
      offBallAggression,
    ],
  },
];

export const SCENARIOS: Scenario[] = SCENARIO_GROUPS.flatMap(g => g.scenarios);

export const SCENARIOS_BY_ID = new Map<string, Scenario>(SCENARIOS.map(s => [s.id, s]));
