import { useRef, useState } from 'react';
import { engineSettings, DEFAULT_ENGINE_SETTINGS, updateEngineSetting, resetEngineSettings } from '../engine/engineSettings';
import type { EngineSettings } from '../engine/engineSettings';
import { useT } from '../i18n';

interface SettingDef {
  key: keyof EngineSettings;
  labelKey: string;
  descKey: string;
  tipKey?: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  group: 'board' | 'match' | 'tactics' | 'transfer' | 'negotiation' | 'economy' | 'reputation' | 'ui';
}

const pct  = (v: number) => `${(v * 100).toFixed(0)}%`;
const mult = (v: number) => `${v.toFixed(1)}×`;
const sign = (v: number) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2));
const fix2 = (v: number) => v.toFixed(2);
const fix1 = (v: number) => v.toFixed(1);
const int  = (v: number) => Math.round(v).toString();

const SETTINGS: SettingDef[] = [
  // Board & Pressure
  { key: 'meterWinBase',            labelKey: 'engine.meterWinBase.label',            descKey: 'engine.meterWinBase.desc',            tipKey: 'engine.meterWinBase.tip',            min: 0,    max: 1,    step: 0.05, format: v => `+${v.toFixed(2)}`,                     group: 'board' },
  { key: 'meterDrawBase',           labelKey: 'engine.meterDrawBase.label',           descKey: 'engine.meterDrawBase.desc',           tipKey: 'engine.meterDrawBase.tip',           min: -0.5, max: 0.5,  step: 0.05, format: sign,                                        group: 'board' },
  { key: 'meterLossBase',           labelKey: 'engine.meterLossBase.label',           descKey: 'engine.meterLossBase.desc',           tipKey: 'engine.meterLossBase.tip',           min: -1,   max: 0,    step: 0.05, format: fix2,                                        group: 'board' },
  { key: 'meterWeeklyPositive',     labelKey: 'engine.meterWeeklyPositive.label',     descKey: 'engine.meterWeeklyPositive.desc',     tipKey: 'engine.meterWeeklyPositive.tip',     min: 0,    max: 0.5,  step: 0.05, format: v => `+${v.toFixed(2)}`,                     group: 'board' },
  { key: 'meterWeeklyNegative',     labelKey: 'engine.meterWeeklyNegative.label',     descKey: 'engine.meterWeeklyNegative.desc',     tipKey: 'engine.meterWeeklyNegative.tip',     min: -0.5, max: 0,    step: 0.05, format: fix2,                                        group: 'board' },
  { key: 'boardKeepThreshold',      labelKey: 'engine.boardKeepThreshold.label',      descKey: 'engine.boardKeepThreshold.desc',      tipKey: 'engine.boardKeepThreshold.tip',      min: 3,    max: 9,    step: 0.5,  format: fix1,                                        group: 'board' },
  { key: 'firingRiskMult',          labelKey: 'engine.firingRiskMult.label',          descKey: 'engine.firingRiskMult.desc',          tipKey: 'engine.firingRiskMult.tip',          min: 0,    max: 3,    step: 0.1,  format: mult,                                        group: 'board' },
  { key: 'seasonObjectiveBonus',    labelKey: 'engine.seasonObjectiveBonus.label',    descKey: 'engine.seasonObjectiveBonus.desc',    tipKey: 'engine.seasonObjectiveBonus.tip',    min: 0,    max: 5,    step: 0.25, format: v => `+${v.toFixed(2)}`,                     group: 'board' },
  { key: 'seasonObjectivePenalty',  labelKey: 'engine.seasonObjectivePenalty.label',  descKey: 'engine.seasonObjectivePenalty.desc',  tipKey: 'engine.seasonObjectivePenalty.tip',  min: -5,   max: 0,    step: 0.25, format: fix2,                                        group: 'board' },
  { key: 'transferGoodDelta',       labelKey: 'engine.transferGoodDelta.label',       descKey: 'engine.transferGoodDelta.desc',       tipKey: 'engine.transferGoodDelta.tip',       min: 0,    max: 1,    step: 0.05, format: v => `+${v.toFixed(2)}`,                     group: 'board' },
  { key: 'transferBadDelta',        labelKey: 'engine.transferBadDelta.label',        descKey: 'engine.transferBadDelta.desc',        tipKey: 'engine.transferBadDelta.tip',        min: -1,   max: 0,    step: 0.05, format: fix2,                                        group: 'board' },

  // Match Simulation
  { key: 'goalChanceMult',          labelKey: 'engine.goalChanceMult.label',          descKey: 'engine.goalChanceMult.desc',          tipKey: 'engine.goalChanceMult.tip',          min: 0.3,  max: 2,    step: 0.1,  format: mult,                                        group: 'match' },
  { key: 'injuryMult',              labelKey: 'engine.injuryMult.label',              descKey: 'engine.injuryMult.desc',              tipKey: 'engine.injuryMult.tip',              min: 0,    max: 3,    step: 0.1,  format: mult,                                        group: 'match' },
  { key: 'staminaDecayMult',        labelKey: 'engine.staminaDecayMult.label',        descKey: 'engine.staminaDecayMult.desc',        tipKey: 'engine.staminaDecayMult.tip',        min: 0.3,  max: 2,    step: 0.1,  format: mult,                                        group: 'match' },
  { key: 'staminaRecoveryMult',     labelKey: 'engine.staminaRecoveryMult.label',     descKey: 'engine.staminaRecoveryMult.desc',     tipKey: 'engine.staminaRecoveryMult.tip',     min: 0.3,  max: 2,    step: 0.1,  format: mult,                                        group: 'match' },
  { key: 'cardStrictness',          labelKey: 'engine.cardStrictness.label',          descKey: 'engine.cardStrictness.desc',          tipKey: 'engine.cardStrictness.tip',          min: 0.3,  max: 2,    step: 0.1,  format: mult,                                        group: 'match' },
  { key: 'possessionDiffExp',       labelKey: 'engine.possessionDiffExp.label',       descKey: 'engine.possessionDiffExp.desc',       tipKey: 'engine.possessionDiffExp.tip',       min: 1,    max: 5,    step: 0.25, format: mult,                                        group: 'match' },
  { key: 'matchEventRate',          labelKey: 'engine.matchEventRate.label',          descKey: 'engine.matchEventRate.desc',          tipKey: 'engine.matchEventRate.tip',          min: 0.05, max: 0.6,  step: 0.05, format: pct,                                         group: 'match' },
  { key: 'assistRate',              labelKey: 'engine.assistRate.label',              descKey: 'engine.assistRate.desc',              tipKey: 'engine.assistRate.tip',              min: 0,    max: 1,    step: 0.05, format: pct,                                         group: 'match' },

  // Player & Tactics
  { key: 'oopPenalty',              labelKey: 'engine.oopPenalty.label',              descKey: 'engine.oopPenalty.desc',              tipKey: 'engine.oopPenalty.tip',              min: 0.3,  max: 1,    step: 0.025,format: v => `${(v * 100).toFixed(1)}%`,            group: 'tactics' },
  { key: 'gkOopPenalty',            labelKey: 'engine.gkOopPenalty.label',            descKey: 'engine.gkOopPenalty.desc',            tipKey: 'engine.gkOopPenalty.tip',            min: 0.1,  max: 0.9,  step: 0.05, format: v => `${(v * 100).toFixed(0)}%`,            group: 'tactics' },
  { key: 'moodLineupBonus',         labelKey: 'engine.moodLineupBonus.label',         descKey: 'engine.moodLineupBonus.desc',                                                       min: 0,    max: 40,   step: 1,    format: v => `+${int(v)}`,                           group: 'tactics' },
  { key: 'moodBenchPenalty',        labelKey: 'engine.moodBenchPenalty.label',        descKey: 'engine.moodBenchPenalty.desc',        tipKey: 'engine.moodBenchPenalty.tip',        min: 0,    max: 40,   step: 1,    format: v => `-${int(v)}`,                           group: 'tactics' },

  // Transfer Market
  { key: 'aiClausulazoProb',        labelKey: 'engine.aiClausulazoProb.label',        descKey: 'engine.aiClausulazoProb.desc',        tipKey: 'engine.aiClausulazoProb.tip',        min: 0,    max: 0.25, step: 0.01, format: pct,                                         group: 'transfer' },
  { key: 'aiTradeProb',             labelKey: 'engine.aiTradeProb.label',             descKey: 'engine.aiTradeProb.desc',             tipKey: 'engine.aiTradeProb.tip',             min: 0,    max: 1,    step: 0.05, format: pct,                                         group: 'transfer' },
  { key: 'aiSigningProb',           labelKey: 'engine.aiSigningProb.label',           descKey: 'engine.aiSigningProb.desc',           tipKey: 'engine.aiSigningProb.tip',           min: 0,    max: 1,    step: 0.05, format: pct,                                         group: 'transfer' },

  // Negotiations
  { key: 'offerInsultThreshold',    labelKey: 'engine.offerInsultThreshold.label',    descKey: 'engine.offerInsultThreshold.desc',    tipKey: 'engine.offerInsultThreshold.tip',    min: 0.3,  max: 1,    step: 0.05, format: pct,                                         group: 'negotiation' },
  { key: 'offerInsultBlockProb',    labelKey: 'engine.offerInsultBlockProb.label',    descKey: 'engine.offerInsultBlockProb.desc',    tipKey: 'engine.offerInsultBlockProb.tip',    min: 0,    max: 1,    step: 0.05, format: pct,                                         group: 'negotiation' },
  { key: 'offerInstantAcceptMult',  labelKey: 'engine.offerInstantAcceptMult.label',  descKey: 'engine.offerInstantAcceptMult.desc',  tipKey: 'engine.offerInstantAcceptMult.tip',  min: 1.2,  max: 3,    step: 0.1,  format: mult,                                        group: 'negotiation' },
  { key: 'offerRejectBlockProb',    labelKey: 'engine.offerRejectBlockProb.label',    descKey: 'engine.offerRejectBlockProb.desc',    tipKey: 'engine.offerRejectBlockProb.tip',    min: 0,    max: 1,    step: 0.05, format: pct,                                         group: 'negotiation' },
  { key: 'offerNegotiationRange',   labelKey: 'engine.offerNegotiationRange.label',   descKey: 'engine.offerNegotiationRange.desc',   tipKey: 'engine.offerNegotiationRange.tip',   min: 0.2,  max: 2,    step: 0.1,  format: mult,                                        group: 'negotiation' },
  { key: 'clausulazoMult',          labelKey: 'engine.clausulazoMult.label',          descKey: 'engine.clausulazoMult.desc',          tipKey: 'engine.clausulazoMult.tip',          min: 1,    max: 5,    step: 0.25, format: mult,                                        group: 'negotiation' },

  // Economy
  { key: 'transferPriceMult',       labelKey: 'engine.transferPriceMult.label',       descKey: 'engine.transferPriceMult.desc',       tipKey: 'engine.transferPriceMult.tip',       min: 0.3,  max: 3,    step: 0.1,  format: mult,                                        group: 'economy' },
  { key: 'salaryMult',              labelKey: 'engine.salaryMult.label',              descKey: 'engine.salaryMult.desc',              tipKey: 'engine.salaryMult.tip',              min: 0.3,  max: 3,    step: 0.1,  format: mult,                                        group: 'economy' },
  { key: 'ticketRevenueMult',       labelKey: 'engine.ticketRevenueMult.label',       descKey: 'engine.ticketRevenueMult.desc',       tipKey: 'engine.ticketRevenueMult.tip',       min: 0.3,  max: 3,    step: 0.1,  format: mult,                                        group: 'economy' },
  { key: 'agePeakBonusMult',        labelKey: 'engine.agePeakBonusMult.label',        descKey: 'engine.agePeakBonusMult.desc',        tipKey: 'engine.agePeakBonusMult.tip',        min: 1,    max: 2,    step: 0.05, format: mult,                                        group: 'economy' },

  // Reputation
  { key: 'reputationGainMult',      labelKey: 'engine.reputationGainMult.label',      descKey: 'engine.reputationGainMult.desc',      tipKey: 'engine.reputationGainMult.tip',      min: 0,    max: 3,    step: 0.1,  format: mult,                                        group: 'reputation' },
  { key: 'reputationLossMult',      labelKey: 'engine.reputationLossMult.label',      descKey: 'engine.reputationLossMult.desc',      tipKey: 'engine.reputationLossMult.tip',      min: 0,    max: 3,    step: 0.1,  format: mult,                                        group: 'reputation' },

  // Match (additional)
  { key: 'homeAdvantageMult',       labelKey: 'engine.homeAdvantageMult.label',       descKey: 'engine.homeAdvantageMult.desc',       tipKey: 'engine.homeAdvantageMult.tip',       min: 0,    max: 2,    step: 0.1,  format: mult,                                        group: 'match' },

  // UI
  { key: 'matchScreenMaxWidthPx',   labelKey: 'engine.matchScreenMaxWidthPx.label',   descKey: 'engine.matchScreenMaxWidthPx.desc',                                                  min: 900,  max: 3200, step: 50,   format: v => `${int(v)} px`,                         group: 'ui' },
];

const GROUPS = ['board', 'reputation', 'match', 'tactics', 'transfer', 'negotiation', 'economy', 'ui'] as const;

export const EngineSettingsView = () => {
  const t = useT();
  const [values, setValues] = useState<EngineSettings>({ ...engineSettings });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [importError, setImportError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(engineSettings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'engine-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(false);
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as Partial<EngineSettings>;
        const keys = Object.keys(DEFAULT_ENGINE_SETTINGS) as (keyof EngineSettings)[];
        for (const key of keys) {
          const val = parsed[key];
          if (typeof val === 'number' && isFinite(val)) {
            updateEngineSetting(key, val as EngineSettings[typeof key]);
          }
        }
        setValues({ ...engineSettings });
      } catch {
        setImportError(true);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const isDefault = (key: keyof EngineSettings) =>
    Math.abs((values[key] as number) - (DEFAULT_ENGINE_SETTINGS[key] as number)) < 0.0001;

  const anyChanged = SETTINGS.some(d => !isDefault(d.key));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-center">
        <p className="text-vga-gray text-[7px] leading-relaxed max-w-xs">
          {t('engine.intro')}
        </p>
        {anyChanged && (
          <button
            onClick={handleResetAll}
            className="text-[7px] px-2 py-1 border border-vga-red text-vga-light-red hover:bg-vga-red hover:text-vga-bright-white shrink-0"
          >
            {t('engine.resetAll')}
          </button>
        )}
      </div>

      {GROUPS.map(group => (
        <div key={group} className="flex flex-col gap-3">
          <div className="text-vga-cyan text-[8px] font-bold uppercase border-b border-vga-cyan pb-0.5 tracking-widest">
            {t(`engine.group.${group}`)}
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
                      {t(def.labelKey)}
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
                    <p className="text-vga-bright-white text-[7px] leading-relaxed">{t(def.descKey)}</p>
                    {def.tipKey && (
                      <p className="text-vga-cyan text-[7px] leading-relaxed border-t border-vga-gray/40 pt-1">
                        💡 {t(def.tipKey)}
                      </p>
                    )}
                    <p className="text-vga-gray/60 text-[6px]">
                      {t('engine.default')} {def.format(DEFAULT_ENGINE_SETTINGS[def.key] as number)}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleExport}
          className="flex-1 text-[7px] py-1 border border-vga-light-green text-vga-light-green hover:bg-vga-light-green hover:text-vga-black"
        >
          {t('engine.export')}
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex-1 text-[7px] py-1 border border-vga-cyan text-vga-cyan hover:bg-vga-cyan hover:text-vga-black"
        >
          {t('engine.import')}
        </button>
        <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
      </div>
      {importError && (
        <p className="text-vga-light-red text-[7px] text-center">{t('engine.importError')}</p>
      )}

      <p className="text-vga-gray/50 text-[6px] text-center mt-1 leading-relaxed">
        {t('engine.footer')}
      </p>
    </div>
  );
};
