import { useMemo } from 'react';
import type { Player } from '../types/game.d.ts';
import type { PlayerSeasonRecord } from '../store/leagueStore';
import { formatEuros, computePrice, playerAge } from '../data/economy';
import { PlayerPhoto } from './PlayerPhoto';
import { PlayerName } from './PlayerName';
import { useT } from '../i18n';
import { synthesizeAttributes } from '../data/playerAttributes';

const TECH_LABELS: Array<[keyof ReturnType<typeof synthesizeAttributes>['technical'], string]> = [
  ['corners', 'Córners'], ['crossing', 'Centros'], ['dribbling', 'Regate'],
  ['finishing', 'Definición'], ['firstTouch', 'Primer toque'], ['freeKicks', 'Tiros libres'],
  ['heading', 'Cabeza'], ['longShots', 'Tiros lejanos'], ['longThrows', 'Saques largos'],
  ['marking', 'Marcaje'], ['passing', 'Pase'], ['penaltyTaking', 'Penaltis'],
  ['tackling', 'Entrada'], ['technique', 'Técnica'],
];
const MENT_LABELS: Array<[keyof ReturnType<typeof synthesizeAttributes>['mental'], string]> = [
  ['aggression', 'Agresividad'], ['anticipation', 'Anticipación'], ['bravery', 'Valentía'],
  ['composure', 'Compostura'], ['concentration', 'Concentración'], ['decisions', 'Decisiones'],
  ['determination', 'Determinación'], ['flair', 'Talento'], ['leadership', 'Liderazgo'],
  ['offTheBall', 'Sin balón'], ['positioning', 'Posición'], ['teamwork', 'Trabajo en equipo'],
  ['vision', 'Visión'], ['workRate', 'Ritmo de trabajo'],
];
const PHYS_LABELS: Array<[keyof ReturnType<typeof synthesizeAttributes>['physical'], string]> = [
  ['acceleration', 'Aceleración'], ['agility', 'Agilidad'], ['balance', 'Equilibrio'],
  ['jumping', 'Salto'], ['naturalFitness', 'Forma física'], ['pace', 'Velocidad'],
  ['stamina', 'Resistencia'], ['strength', 'Fuerza'],
];

const attrColor = (v: number): string => {
  if (v >= 16) return 'text-vga-light-green';
  if (v >= 12) return 'text-vga-yellow';
  if (v >= 8) return 'text-vga-bright-white';
  return 'text-vga-gray';
};

interface Props {
  player: Player;
  teamName: string | null;
  history: PlayerSeasonRecord[];
  seasonYear: number;
  onBack: () => void;
}

const POS_COLOR: Record<string, string> = {
  POR: 'text-vga-light-cyan',
  DEF: 'text-vga-light-green',
  MED: 'text-vga-yellow',
  AML: 'text-vga-light-magenta',
  AMR: 'text-vga-light-magenta',
  DEL: 'text-vga-light-red',
};

const PEAK_AGE = 28;

const ageFactor = (a: number): number => Math.max(0.7, Math.min(1.0, 1 - Math.abs(a - PEAK_AGE) * 0.02));

const caAtAge = (currentCa: number, currentAge: number, targetAge: number): number => {
  const cur = ageFactor(currentAge);
  const tgt = ageFactor(targetAge);
  if (cur === 0) return currentCa;
  return Math.round(currentCa * (tgt / cur));
};

export const PlayerDetailView = ({ player, teamName, history, seasonYear, onBack }: Props) => {
  const t = useT();
  const age = playerAge(player, seasonYear);
  const price = computePrice(player, seasonYear);
  const sortedHistory = [...history].sort((a, b) => a.year - b.year);
  const totalGoals = sortedHistory.reduce((s, r) => s + r.goals, 0) + player.seasonStats.goals;
  const totalAssists = sortedHistory.reduce((s, r) => s + r.assists, 0) + player.seasonStats.assists;
  const totalSeasons = sortedHistory.length + 1;
  const yy = (y: number) => (y + 1).toString().slice(-2);

  const ca = player.current_ability ?? Math.round((player.media ?? 50) * 2);
  const pa = player.potential_ability;
  // UI scale 0-100 (CA/PA are stored on the 1-200 FM scale).
  const caDisplay = Math.round(ca / 2);
  const paDisplay = pa != null ? Math.round(pa / 2) : null;

  // Top 5 position competences for display
  const topPositions = [...(player.positions ?? [])].sort((a, b) => b.level - a.level).slice(0, 5);

  const primaryPosCode = topPositions[0]?.code ?? 'MC';
  const attrs = useMemo(
    () => player.attributes ?? synthesizeAttributes(ca, primaryPosCode, player.id),
    [player.attributes, ca, primaryPosCode, player.id],
  );

  const PanelTitle = ({ children, accent = 'text-vga-magenta', right }: { children: React.ReactNode; accent?: string; right?: React.ReactNode }) => (
    <div className={`px-3 py-1.5 border-b border-vga-blue text-[9px] uppercase tracking-widest flex items-center justify-between ${accent}`}>
      <span>{children}</span>
      {right}
    </div>
  );

  return (
    <div className="w-full flex flex-col gap-2 animate-in fade-in duration-300" style={{ maxWidth: 1800, marginLeft: 'auto', marginRight: 'auto' }}>
      {/* Top HUD */}
      <div className="flex items-center justify-between border border-vga-blue bg-vga-black px-3 py-1 text-[8px] uppercase">
        <div className="flex items-center gap-3 text-vga-cyan">
          <span className="text-vga-yellow">[*]</span>
          <span className="text-vga-bright-white truncate max-w-[26ch]">{t('section.playerFile')}</span>
          <span className="text-vga-magenta">|</span>
          <span>{teamName ?? t('label.freeAgent')}</span>
        </div>
        <button
          onClick={onBack}
          className="text-[8px] px-3 py-0.5 bg-vga-red text-vga-bright-white border border-vga-bright-white hover:bg-vga-light-red uppercase font-bold tracking-wider"
        >
          {t('btn.back')}
        </button>
      </div>

      {/* Identity panel */}
      <div className="border border-vga-blue bg-vga-black">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-3 border-b border-vga-blue">
          <PlayerPhoto sourceId={player.source_id} size="xl" className="border-2 border-vga-blue" />
          <div className="min-w-0">
            <div className="flex items-baseline gap-3 mb-1 flex-wrap">
              <PlayerName player={player} useShirt className="text-[18px] font-bold text-vga-bright-white truncate" />
              <span className="text-[10px] text-vga-cyan">#{player.number}</span>
              {topPositions.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  {topPositions.map(pos => {
                    const tone = pos.level >= 18 ? 'border-vga-light-green text-vga-light-green'
                               : pos.level >= 14 ? 'border-vga-yellow text-vga-yellow'
                               : 'border-vga-gray text-vga-gray';
                    return (
                      <span
                        key={pos.code}
                        className={`text-[7px] uppercase font-bold px-1.5 py-0.5 border ${tone} font-mono`}
                        title={`Nivel ${pos.level}/20`}
                      >
                        {pos.code} {pos.level}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="text-[8px] text-vga-gray truncate uppercase">{player.fullName}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <BigStat label={t('label.team')} value={teamName ?? t('label.freeAgent')} color="text-vga-bright-white" />
            <BigStat label="CA" value={String(caDisplay)} color="text-vga-light-green" extra={paDisplay != null ? `PA ${paDisplay}` : undefined} />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 text-[8px]">
          <MiniTile label={t('label.age')}   value={t('misc.ageYears', { age: String(age) })} color="text-vga-bright-white" />
          <MiniTile label="CA"               value={String(caDisplay)} color="text-vga-light-green" extra={paDisplay != null ? `PA ${paDisplay}` : undefined} />
          <MiniTile label={t('label.value')} value={formatEuros(price)} color="text-vga-light-green" />
          <MiniTile label="Sueldo"           value={formatEuros(player.contract?.salary ?? 0)} color="text-vga-cyan" />
        </div>
      </div>

      {/* Attributes panel */}
      <div className="border border-vga-blue bg-vga-black">
        <PanelTitle accent="text-vga-magenta" right={player.stats_year != null ? (
          <span className="text-vga-light-green text-[7px] bg-vga-black border border-vga-light-green px-1 py-0.5">{player.stats_year}</span>
        ) : undefined}>Atributos</PanelTitle>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-2 p-3 text-[8px]">
          <AttrColumn title="Técnica" labels={TECH_LABELS} values={attrs.technical as Record<string, number>} />
          <AttrColumn title="Mental"  labels={MENT_LABELS} values={attrs.mental as Record<string, number>} />
          <AttrColumn title="Físico"  labels={PHYS_LABELS} values={attrs.physical as Record<string, number>} />
        </div>
      </div>

      {/* Current season stats */}
      <div className="border border-vga-blue bg-vga-black">
        <PanelTitle accent="text-vga-magenta">{t('section.currentSeason', { year: String(seasonYear), yy: yy(seasonYear) })}</PanelTitle>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 p-3 text-center">
          <SeasonTile label={t('label.apps.s')}      value={player.seasonStats.appearances} color="text-vga-bright-white" />
          <SeasonTile label={t('label.minutes.s')}   value={player.seasonStats.minutes}     color="text-vga-bright-white" />
          <SeasonTile label={t('label.goals.s')}     value={player.seasonStats.goals}       color="text-vga-light-green" />
          <SeasonTile label={t('label.assists.s')}   value={player.seasonStats.assists}     color="text-vga-light-cyan" />
          <SeasonTile label={t('label.yellows.s')}   value={player.seasonStats.yellowCards} color="text-vga-yellow" />
          <SeasonTile label={t('label.reds.s')}      value={player.seasonStats.redCards}    color="text-vga-light-red" />
        </div>
      </div>

      {/* Market actions now live in the squad inspector side panel. */}

      {/* History */}
      <div className="border border-vga-blue bg-vga-black">
        <PanelTitle accent="text-vga-magenta">
          {t('label.matches')} · {totalSeasons}T · {totalGoals}G · {totalAssists}A
        </PanelTitle>
        {sortedHistory.length === 0 ? (
          <div className="text-[8px] text-vga-gray italic text-center p-3">
            {t('misc.noMatchesYet')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[8px]">
              <thead>
                <tr className="text-vga-magenta uppercase tracking-widest border-b border-vga-blue text-[7px]">
                  <th className="px-3 py-1 text-left">{t('trophy.year')}</th>
                  <th className="px-3 py-1 text-left">{t('label.team')}</th>
                  <th className="px-3 py-1 text-center">{t('label.position')}</th>
                  <th className="px-3 py-1 text-center">{t('label.age')}</th>
                  <th className="px-3 py-1 text-center">{t('label.media').toUpperCase()}</th>
                  <th className="px-3 py-1 text-right">G</th>
                  <th className="px-3 py-1 text-right">A</th>
                  <th className="px-3 py-1 text-right">TA</th>
                  <th className="px-3 py-1 text-right">TR</th>
                </tr>
              </thead>
              <tbody>
                {sortedHistory.map((r, i) => {
                  const caAtYear = Math.round(caAtAge(ca, age, r.age) / 2);
                  return (
                    <tr key={i} className="border-b border-vga-blue/40 last:border-b-0">
                      <td className="px-3 py-1 text-vga-yellow font-mono">{r.year}</td>
                      <td className="px-3 py-1 text-vga-bright-white truncate">{r.teamName}</td>
                      <td className={`px-3 py-1 text-center font-bold ${POS_COLOR[r.position] ?? 'text-vga-yellow'}`}>{r.position}</td>
                      <td className="px-3 py-1 text-center text-vga-gray font-mono">{r.age}</td>
                      <td className="px-3 py-1 text-center font-bold text-vga-light-green font-mono">{caAtYear}</td>
                      <td className="px-3 py-1 text-right text-vga-light-green font-mono">{r.goals}</td>
                      <td className="px-3 py-1 text-right text-vga-light-cyan font-mono">{r.assists}</td>
                      <td className="px-3 py-1 text-right text-vga-yellow font-mono">{r.yellowCards}</td>
                      <td className="px-3 py-1 text-right text-vga-light-red font-mono">{r.redCards}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const BigStat = ({ label, value, color, extra }: { label: string; value: string; color: string; extra?: string }) => (
  <div className="border border-vga-blue px-3 py-2 text-center min-w-[6rem]">
    <div className="text-vga-gray text-[7px] uppercase tracking-widest">{label}</div>
    <div className={`${color} text-[12px] font-bold font-mono leading-tight truncate`}>{value}</div>
    {extra && <div className="text-vga-cyan text-[7px] font-mono">{extra}</div>}
  </div>
);

const MiniTile = ({ label, value, color, extra }: { label: string; value: string; color: string; extra?: string }) => (
  <div className="border border-vga-blue bg-vga-black px-2 py-1.5">
    <div className="text-vga-gray text-[7px] uppercase tracking-widest">{label}</div>
    <div className={`${color} text-[10px] font-bold font-mono leading-tight truncate`}>{value}</div>
    {extra && <div className="text-vga-cyan text-[7px] font-mono">{extra}</div>}
  </div>
);

const SeasonTile = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className="border border-vga-blue bg-vga-black px-2 py-2">
    <div className="text-vga-gray text-[7px] uppercase tracking-widest">{label}</div>
    <div className={`${color} text-[14px] font-bold font-mono`}>{value}</div>
  </div>
);


const AttrColumn = <T extends string>({ title, labels, values }: { title: string; labels: Array<[T, string]>; values: Record<string, number> }) => (
  <div>
    <div className="text-vga-cyan text-[8px] uppercase tracking-widest mb-1 border-b border-vga-blue pb-1">{title}</div>
    {labels.map(([key, label]) => (
      <div key={key} className="flex justify-between leading-tight py-px">
        <span className="text-vga-bright-white truncate">{label}</span>
        <span className={`${attrColor(values[key])} font-bold w-5 text-right font-mono`}>{values[key]}</span>
      </div>
    ))}
  </div>
);
