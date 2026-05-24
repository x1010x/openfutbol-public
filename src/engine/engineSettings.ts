const LS_KEY = 'openfutbol_engine_settings';

export interface EngineSettings {
  // Board & Pressure
  meterWinBase: number;
  meterDrawBase: number;
  meterLossBase: number;
  meterWeeklyPositive: number;
  meterWeeklyNegative: number;
  boardKeepThreshold: number;
  // Match Simulation
  goalChanceMult: number;
  injuryMult: number;
  staminaDecayMult: number;
  staminaRecoveryMult: number;
  cardStrictness: number;
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
  goalChanceMult: 1.0,
  injuryMult: 1.0,
  staminaDecayMult: 1.0,
  staminaRecoveryMult: 1.0,
  cardStrictness: 1.0,
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
