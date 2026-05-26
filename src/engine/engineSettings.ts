const LS_KEY = 'openfutbol_engine_settings';

export interface EngineSettings {
  // Board & Pressure
  meterWinBase: number;
  meterDrawBase: number;
  meterLossBase: number;
  meterWeeklyPositive: number;
  meterWeeklyNegative: number;
  boardKeepThreshold: number;
  firingRiskMult: number;
  seasonObjectiveBonus: number;
  seasonObjectivePenalty: number;
  transferGoodDelta: number;
  transferBadDelta: number;
  // Match Simulation
  goalChanceMult: number;
  injuryMult: number;
  staminaDecayMult: number;
  staminaRecoveryMult: number;
  cardStrictness: number;
  possessionDiffExp: number;
  matchEventRate: number;
  assistRate: number;
  // Player & Tactics
  oopPenalty: number;
  gkOopPenalty: number;
  moodLineupBonus: number;
  moodBenchPenalty: number;
  // Transfer Market
  aiClausulazoProb: number;
  aiTradeProb: number;
  aiSigningProb: number;
}

export const DEFAULT_ENGINE_SETTINGS: Readonly<EngineSettings> = {
  meterWinBase: 0.30,
  meterDrawBase: 0.00,
  meterLossBase: -0.35,
  meterWeeklyPositive: 0.10,
  meterWeeklyNegative: -0.15,
  boardKeepThreshold: 6.0,
  firingRiskMult: 1.0,
  seasonObjectiveBonus: 1.5,
  seasonObjectivePenalty: -1.5,
  transferGoodDelta: 0.2,
  transferBadDelta: -0.3,
  goalChanceMult: 1.0,
  injuryMult: 1.0,
  staminaDecayMult: 1.0,
  staminaRecoveryMult: 1.0,
  cardStrictness: 1.0,
  possessionDiffExp: 2.5,
  matchEventRate: 0.25,
  assistRate: 0.7,
  oopPenalty: 0.825,
  gkOopPenalty: 0.45,
  moodLineupBonus: 20,
  moodBenchPenalty: 15,
  aiClausulazoProb: 0.05,
  aiTradeProb: 0.45,
  aiSigningProb: 0.28,
};

export const engineSettings: EngineSettings = { ...DEFAULT_ENGINE_SETTINGS };

export function loadEngineSettings(): void {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<EngineSettings>;
    Object.assign(engineSettings, DEFAULT_ENGINE_SETTINGS, parsed);
  } catch { /* ignore corrupt data */ }
}

export function saveEngineSettings(): void {
  localStorage.setItem(LS_KEY, JSON.stringify(engineSettings));
}

export function updateEngineSetting<K extends keyof EngineSettings>(key: K, value: EngineSettings[K]): void {
  engineSettings[key] = value;
  saveEngineSettings();
}

export function resetEngineSettings(): void {
  Object.assign(engineSettings, DEFAULT_ENGINE_SETTINGS);
  saveEngineSettings();
}
