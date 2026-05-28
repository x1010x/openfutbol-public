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

  // Top 5 position competences for display
  const topPositions = [...(player.positions ?? [])].sort((a, b) => b.level - a.level).slice(0, 5);

  const primaryPosCode = topPositions[0]?.code ?? 'MC';
  const attrs = useMemo(
    () => synthesizeAttributes(ca, primaryPosCode, player.id),
    [ca, primaryPosCode, player.id],
  );

  return (
    <div className="w-full max-w-3xl flex flex-col gap-4 animate-in fade-in duration-300">
      <div className="bg-vga-blue p-2 border-2 border-vga-white flex justify-between items-center vga-panel">
        <h2 className="text-vga-yellow text-xs uppercase font-bold truncate">{t('section.playerFile')}</h2>
        <button onClick={onBack} className="bg-vga-red text-vga-bright-white px-3 py-1 text-[8px] border border-vga-black hover:bg-vga-light-red shrink-0">
          {t('btn.back')}
        </button>
      </div>

      <div className="bg-vga-blue border-4 border-vga-bright-white p-3 text-vga-bright-white vga-panel">
        <div className="flex items-baseline gap-3 border-b border-vga-cyan pb-2 mb-3">
          <span className={`text-[16px] font-bold ${POS_COLOR[player.position] ?? 'text-vga-yellow'}`}>{player.position}</span>
          <PlayerName player={player} useShirt className="text-[18px] font-bold truncate" />
          <span className="text-[10px] text-vga-cyan">#{player.number}</span>
        </div>
        <div className="text-[8px] text-vga-cyan mb-3 truncate">{player.fullName}</div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-[8px]">
          <div className="bg-vga-black border border-vga-gray p-2">
            <div className="text-vga-cyan text-[7px] uppercase">{t('label.team')}</div>
            <div className="text-vga-bright-white text-[10px] truncate">{teamName ?? t('label.freeAgent')}</div>
          </div>
          <div className="bg-vga-black border border-vga-gray p-2">
            <div className="text-vga-cyan text-[7px] uppercase">{t('label.age')}</div>
            <div className="text-vga-bright-white text-[10px]">{t('misc.ageYears', { age: String(age) })}</div>
          </div>
          <div className="bg-vga-black border border-vga-gray p-2">
            <div className="text-vga-cyan text-[7px] uppercase">CA</div>
            <div className="text-vga-light-green text-[10px] font-bold">{ca}</div>
            {pa != null && <div className="text-vga-cyan text-[7px]">PA {pa}</div>}
          </div>
          <div className="bg-vga-black border border-vga-gray p-2">
            <div className="text-vga-cyan text-[7px] uppercase">{t('label.value')}</div>
            <div className="text-vga-light-green text-[10px]">{formatEuros(price)}</div>
          </div>
        </div>

        <div className="flex gap-3 items-stretch flex-wrap">
          <div className="flex flex-col items-center justify-center bg-vga-black vga-panel-inset px-3 py-2 min-w-[80px]">
            <PlayerPhoto sourceId={player.source_id} size="lg" className="mb-1" />
            <span className="text-[8px] text-vga-cyan">CA</span>
            <span className="text-3xl text-vga-light-green leading-none">{ca}</span>
          </div>
          <div className="flex-1 flex flex-col gap-1 justify-center min-w-[160px]">
            {topPositions.length > 0 ? topPositions.map(pos => (
              <div key={pos.code} className="flex items-center gap-2">
                <span className="text-vga-cyan text-[8px] w-10 shrink-0">{pos.code}</span>
                <div className="flex-1 bg-vga-black h-2 border border-vga-gray">
                  <div className="bg-vga-light-green h-full" style={{ width: `${(pos.level / 20) * 100}%` }} />
                </div>
                <span className="text-vga-bright-white text-[8px] w-4 text-right">{pos.level}</span>
              </div>
            )) : (
              <div className="text-vga-gray text-[8px]">{player.position}</div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-vga-blue border-2 border-vga-bright-white p-2 vga-panel">
        <h3 className="text-vga-yellow text-[10px] font-bold mb-2 uppercase border-b border-vga-cyan pb-1">
          Atributos
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[8px]">
          <div>
            <div className="text-vga-cyan text-[8px] uppercase mb-1 border-b border-vga-cyan pb-1">Técnica</div>
            {TECH_LABELS.map(([key, label]) => (
              <div key={key} className="flex justify-between leading-tight py-px">
                <span className="text-vga-bright-white truncate">{label}</span>
                <span className={`${attrColor(attrs.technical[key])} font-bold w-5 text-right`}>{attrs.technical[key]}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="text-vga-cyan text-[8px] uppercase mb-1 border-b border-vga-cyan pb-1">Mental</div>
            {MENT_LABELS.map(([key, label]) => (
              <div key={key} className="flex justify-between leading-tight py-px">
                <span className="text-vga-bright-white truncate">{label}</span>
                <span className={`${attrColor(attrs.mental[key])} font-bold w-5 text-right`}>{attrs.mental[key]}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="text-vga-cyan text-[8px] uppercase mb-1 border-b border-vga-cyan pb-1">Físico</div>
            {PHYS_LABELS.map(([key, label]) => (
              <div key={key} className="flex justify-between leading-tight py-px">
                <span className="text-vga-bright-white truncate">{label}</span>
                <span className={`${attrColor(attrs.physical[key])} font-bold w-5 text-right`}>{attrs.physical[key]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-vga-gray border-2 border-vga-blue p-2">
        <h3 className="text-vga-blue text-[10px] font-bold mb-2 uppercase border-b border-vga-blue pb-1">
          {t('section.currentSeason', { year: String(seasonYear), yy: yy(seasonYear) })}
        </h3>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-[10px] text-center">
          <div className="bg-vga-black border border-vga-gray p-2">
            <div className="text-[7px] text-vga-cyan uppercase">{t('label.apps.s')}</div>
            <div className="text-vga-bright-white font-bold">{player.seasonStats.appearances}</div>
          </div>
          <div className="bg-vga-black border border-vga-gray p-2">
            <div className="text-[7px] text-vga-cyan uppercase">{t('label.minutes.s')}</div>
            <div className="text-vga-bright-white font-bold">{player.seasonStats.minutes}</div>
          </div>
          <div className="bg-vga-black border border-vga-gray p-2">
            <div className="text-[7px] text-vga-cyan uppercase">{t('label.goals.s')}</div>
            <div className="text-vga-light-green font-bold">{player.seasonStats.goals}</div>
          </div>
          <div className="bg-vga-black border border-vga-gray p-2">
            <div className="text-[7px] text-vga-cyan uppercase">{t('label.assists.s')}</div>
            <div className="text-vga-light-cyan font-bold">{player.seasonStats.assists}</div>
          </div>
          <div className="bg-vga-black border border-vga-gray p-2">
            <div className="text-[7px] text-vga-cyan uppercase">{t('label.yellows.s')}</div>
            <div className="text-vga-yellow font-bold">{player.seasonStats.yellowCards}</div>
          </div>
          <div className="bg-vga-black border border-vga-gray p-2">
            <div className="text-[7px] text-vga-cyan uppercase">{t('label.reds.s')}</div>
            <div className="text-vga-light-red font-bold">{player.seasonStats.redCards}</div>
          </div>
        </div>
      </div>

      <div className="bg-vga-gray border-2 border-vga-magenta p-2">
        <h3 className="text-vga-magenta text-[10px] font-bold mb-2 uppercase border-b border-vga-magenta pb-1">
          {t('label.matches')} · {totalSeasons}T · {totalGoals}G · {totalAssists}A
        </h3>
        {sortedHistory.length === 0 ? (
          <div className="text-[8px] text-vga-black text-center p-2">
            {t('misc.noMatchesYet')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[8px]">
              <thead>
                <tr className="text-vga-blue text-left border-b border-vga-blue">
                  <th className="px-1 py-1">{t('trophy.year')}</th>
                  <th className="px-1 py-1">{t('label.team')}</th>
                  <th className="px-1 py-1 text-center">{t('label.position')}</th>
                  <th className="px-1 py-1 text-center">{t('label.age')}</th>
                  <th className="px-1 py-1 text-center">{t('label.media').toUpperCase()}</th>
                  <th className="px-1 py-1 text-right">G</th>
                  <th className="px-1 py-1 text-right">A</th>
                  <th className="px-1 py-1 text-right">TA</th>
                  <th className="px-1 py-1 text-right">TR</th>
                </tr>
              </thead>
              <tbody>
                {sortedHistory.map((r, i) => {
                  const caAtYear = caAtAge(ca, age, r.age);
                  return (
                    <tr key={i} className={i % 2 === 0 ? 'bg-vga-black' : 'bg-vga-gray'}>
                      <td className={`px-1 py-1 ${i % 2 === 0 ? 'text-vga-yellow' : 'text-vga-blue'}`}>{r.year}</td>
                      <td className={`px-1 py-1 truncate ${i % 2 === 0 ? 'text-vga-bright-white' : 'text-vga-black'}`}>{r.teamName}</td>
                      <td className={`px-1 py-1 text-center ${POS_COLOR[r.position] ?? 'text-vga-yellow'}`}>{r.position}</td>
                      <td className={`px-1 py-1 text-center ${i % 2 === 0 ? 'text-vga-bright-white' : 'text-vga-black'}`}>{r.age}</td>
                      <td className={`px-1 py-1 text-center font-bold ${i % 2 === 0 ? 'text-vga-light-green' : 'text-vga-blue'}`}>{caAtYear}</td>
                      <td className={`px-1 py-1 text-right ${i % 2 === 0 ? 'text-vga-light-green' : 'text-vga-blue'}`}>{r.goals}</td>
                      <td className={`px-1 py-1 text-right ${i % 2 === 0 ? 'text-vga-light-cyan' : 'text-vga-blue'}`}>{r.assists}</td>
                      <td className={`px-1 py-1 text-right ${i % 2 === 0 ? 'text-vga-yellow' : 'text-vga-blue'}`}>{r.yellowCards}</td>
                      <td className={`px-1 py-1 text-right ${i % 2 === 0 ? 'text-vga-light-red' : 'text-vga-blue'}`}>{r.redCards}</td>
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
