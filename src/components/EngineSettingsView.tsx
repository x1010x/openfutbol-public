import { useState } from 'react';
import { engineSettings, DEFAULT_ENGINE_SETTINGS, updateEngineSetting, resetEngineSettings } from '../engine/engineSettings';
import type { EngineSettings } from '../engine/engineSettings';

interface SettingDef {
  key: keyof EngineSettings;
  label: string;
  desc: string;
  tip?: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  group: string;
}

const SETTINGS: SettingDef[] = [
  // Board & Pressure
  {
    key: 'meterWinBase',
    label: 'Win Reward',
    desc: 'Base florentinómetro gain per victory (before context adjustments).',
    tip: 'Context bonuses stack on top: upset wins, dominant wins, and clean sheets add extra. This is just the floor.',
    min: 0, max: 1, step: 0.05,
    format: v => `+${v.toFixed(2)}`,
    group: 'Board & Pressure',
  },
  {
    key: 'meterDrawBase',
    label: 'Draw Impact',
    desc: 'Base florentinómetro change for a draw. Zero = draws are neutral; negative = board expects wins.',
    tip: 'Drawing against a much stronger team still gives a bonus on top of this base value.',
    min: -0.5, max: 0.5, step: 0.05,
    format: v => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2)),
    group: 'Board & Pressure',
  },
  {
    key: 'meterLossBase',
    label: 'Loss Penalty',
    desc: 'Base florentinómetro drop per defeat. Losses against much stronger teams are partially forgiven on top of this.',
    tip: 'Losing to a clearly better team? The engine adds a forgiveness bonus — but this base is still deducted.',
    min: -1, max: 0, step: 0.05,
    format: v => v.toFixed(2),
    group: 'Board & Pressure',
  },
  {
    key: 'meterWeeklyPositive',
    label: 'Weekly Positive Drift',
    desc: 'Meter gain each jornada when the club\'s weekly finances are in the black (income > salaries).',
    tip: 'Keeping a healthy budget makes the board happy, independent of results.',
    min: 0, max: 0.5, step: 0.05,
    format: v => `+${v.toFixed(2)}`,
    group: 'Board & Pressure',
  },
  {
    key: 'meterWeeklyNegative',
    label: 'Weekly Negative Drift',
    desc: 'Meter drop each jornada when the club runs a weekly loss (salaries > income).',
    tip: 'Big squads or high wages will hurt the board meter every jornada you\'re in the red.',
    min: -0.5, max: 0, step: 0.05,
    format: v => v.toFixed(2),
    group: 'Board & Pressure',
  },
  {
    key: 'boardKeepThreshold',
    label: 'Board Loyalty Threshold',
    desc: 'Meter score at which the board starts seriously considering keeping you at season end.',
    tip: 'Above this threshold = 60% chance you stay. Below it, the chance drops exponentially — a meter of 0 means near-certain firing. Raise this to make boards harder to please, lower it to get more job security.',
    min: 3, max: 9, step: 0.5,
    format: v => v.toFixed(1),
    group: 'Board & Pressure',
  },

  // Match Simulation
  {
    key: 'goalChanceMult',
    label: 'Goal Rate',
    desc: 'Multiplier on the base goal probability per attacking chance.',
    tip: 'At 1×, a balanced duel has roughly a 22% goal chance. 2× doubles that, leading to higher-scoring games. 0.5× makes defenses much more dominant.',
    min: 0.3, max: 2, step: 0.1,
    format: v => `${v.toFixed(1)}×`,
    group: 'Match Simulation',
  },
  {
    key: 'injuryMult',
    label: 'Injury Frequency',
    desc: 'Multiplier on per-minute injury probability (base: ~0.025% per player per minute).',
    tip: 'At 2×, you can expect roughly twice as many injuries per match. At 0× injuries are disabled. Squad depth matters more at higher values.',
    min: 0, max: 3, step: 0.1,
    format: v => `${v.toFixed(1)}×`,
    group: 'Match Simulation',
  },
  {
    key: 'staminaDecayMult',
    label: 'In-Match Fatigue',
    desc: 'How fast players lose stamina during a match. Affects substitution decisions and late-game performance.',
    tip: 'High physical stats reduce decay naturally. At 2×, substitutions and rotation become critical. At 0.5×, players tire very slowly.',
    min: 0.3, max: 2, step: 0.1,
    format: v => `${v.toFixed(1)}×`,
    group: 'Match Simulation',
  },
  {
    key: 'staminaRecoveryMult',
    label: 'Stamina Recovery',
    desc: 'How much stamina players recover between jornadas (base: 12–25 points depending on physical stat).',
    tip: 'At 2×, players are nearly full every match. At 0.5×, you must rotate heavily to avoid fielding exhausted lineups. Pairs with In-Match Fatigue.',
    min: 0.3, max: 2, step: 0.1,
    format: v => `${v.toFixed(1)}×`,
    group: 'Match Simulation',
  },
  {
    key: 'cardStrictness',
    label: 'Referee Strictness',
    desc: 'Scales yellow and red card thresholds. Higher = more cards, more red-card ejections, shorter-tempered officials.',
    tip: 'Cards trigger suspensions — more cards means more games missed. Pair with high strictness to make discipline a real factor in squad management.',
    min: 0.3, max: 2, step: 0.1,
    format: v => `${v.toFixed(1)}×`,
    group: 'Match Simulation',
  },

  // Transfer Market
  {
    key: 'aiClausulazoProb',
    label: 'AI Clausulazo Chance',
    desc: 'Per-jornada probability that a rival club activates a buyout clause on one of your players.',
    tip: 'Only affects players with a high enough media rating. At 5% (default) you\'ll see roughly one clausulazo per transfer window. Raise this for a more chaotic, aggressive market.',
    min: 0, max: 0.25, step: 0.01,
    format: v => `${(v * 100).toFixed(0)}%`,
    group: 'Transfer Market',
  },
  {
    key: 'aiTradeProb',
    label: 'AI Trade Activity',
    desc: 'Probability that AI teams swap bench players with each other each jornada.',
    tip: 'AI trades affect squad depth across the league, making rival teams stronger or weaker in specific positions. Disable (0%) for a static transfer landscape.',
    min: 0, max: 1, step: 0.05,
    format: v => `${(v * 100).toFixed(0)}%`,
    group: 'Transfer Market',
  },
  {
    key: 'aiSigningProb',
    label: 'AI Signing Activity',
    desc: 'Probability per jornada that an AI team signs a listed player or free agent.',
    tip: 'High values mean rivals actively build stronger squads and the free agent pool empties faster. Low values make the market more predictable — good players stay available longer.',
    min: 0, max: 1, step: 0.05,
    format: v => `${(v * 100).toFixed(0)}%`,
    group: 'Transfer Market',
  },
];

const GROUPS = ['Board & Pressure', 'Match Simulation', 'Transfer Market'] as const;

export const EngineSettingsView = () => {
  const [values, setValues] = useState<EngineSettings>({ ...engineSettings });
  const [expanded, setExpanded] = useState<string | null>(null);

  const handleChange = <K extends keyof EngineSettings>(key: K, raw: string) => {
    const value = parseFloat(raw) as EngineSettings[K];
    updateEngineSetting(key, value);
    setValues(prev => ({ ...prev, [key]: value }));
  };

  const handleResetOne = (key: keyof EngineSettings) => {
    const def = DEFAULT_ENGINE_SETTINGS[key] as EngineSettings[typeof key];
    updateEngineSetting(key, def);
    setValues(prev => ({ ...prev, [key]: def }));
  };

  const handleResetAll = () => {
    resetEngineSettings();
    setValues({ ...DEFAULT_ENGINE_SETTINGS });
  };

  const isDefault = (key: keyof EngineSettings) =>
    Math.abs((values[key] as number) - (DEFAULT_ENGINE_SETTINGS[key] as number)) < 0.0001;

  const anyChanged = SETTINGS.some(d => !isDefault(d.key));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-center">
        <p className="text-vga-gray text-[7px] leading-relaxed max-w-xs">
          Tune every game-balance constant. Defaults represent the intended experience. Changes take effect on the next relevant event.
        </p>
        {anyChanged && (
          <button
            onClick={handleResetAll}
            className="text-[7px] px-2 py-1 border border-vga-red text-vga-light-red hover:bg-vga-red hover:text-vga-bright-white shrink-0"
          >
            RESET ALL
          </button>
        )}
      </div>

      {GROUPS.map(group => (
        <div key={group} className="flex flex-col gap-3">
          <div className="text-vga-cyan text-[8px] font-bold uppercase border-b border-vga-cyan pb-0.5 tracking-widest">
            {group}
          </div>

          {SETTINGS.filter(d => d.group === group).map(def => {
            const val = values[def.key] as number;
            const changed = !isDefault(def.key);
            const isOpen = expanded === def.key;

            return (
              <div key={def.key} className={`flex flex-col gap-1 pb-2 border-b border-vga-black/40 ${changed ? 'border-vga-yellow/20' : ''}`}>
                <div className="flex justify-between items-center gap-2">
                  <button
                    className="text-left flex items-center gap-1 min-w-0"
                    onClick={() => setExpanded(isOpen ? null : def.key)}
                  >
                    <span className={`text-[8px] font-bold uppercase tracking-wide ${changed ? 'text-vga-yellow' : 'text-vga-bright-white'}`}>
                      {def.label}
                    </span>
                    <span className="text-vga-gray text-[6px]">{isOpen ? '▲' : '▼'}</span>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`text-[9px] font-mono font-bold w-10 text-right ${changed ? 'text-vga-yellow' : 'text-vga-gray'}`}>
                      {def.format(val)}
                    </span>
                    {changed && (
                      <button
                        onClick={() => handleResetOne(def.key)}
                        className="text-[7px] px-1 border border-vga-gray text-vga-gray hover:border-vga-bright-white hover:text-vga-bright-white"
                        title="Reset to default"
                      >
                        ↺
                      </button>
                    )}
                  </div>
                </div>

                <input
                  type="range"
                  min={def.min}
                  max={def.max}
                  step={def.step}
                  value={val}
                  onChange={e => handleChange(def.key, e.target.value)}
                  className="w-full h-1 accent-vga-yellow cursor-pointer"
                />

                {isOpen && (
                  <div className="mt-1 bg-vga-black border border-vga-gray p-2 flex flex-col gap-1">
                    <p className="text-vga-bright-white text-[7px] leading-relaxed">{def.desc}</p>
                    {def.tip && (
                      <p className="text-vga-cyan text-[7px] leading-relaxed border-t border-vga-gray/40 pt-1">
                        💡 {def.tip}
                      </p>
                    )}
                    <p className="text-vga-gray/60 text-[6px]">
                      Default: {def.format(DEFAULT_ENGINE_SETTINGS[def.key] as number)}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      <p className="text-vga-gray/50 text-[6px] text-center mt-1 leading-relaxed">
        Settings are saved automatically and persist across sessions. These are not difficulty presets — they are raw engine knobs. Combine them thoughtfully.
      </p>
    </div>
  );
};
