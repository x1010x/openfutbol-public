import type { Team } from '../types/game.d.ts';
import type { TeamFinances } from '../store/leagueStore';
import { formatEuros, teamWeeklySalary } from '../data/economy';
import { useT } from '../i18n';

interface Props {
  team: Team;
  finances: TeamFinances;
  rivalTeams: Team[];
  seasonYear: number;
  onUpdateTicketPrice: (price: number) => void;
  onBack: () => void;
}

export const FinancesView = ({ team, finances, rivalTeams, seasonYear, onUpdateTicketPrice, onBack }: Props) => {
  const t = useT();
  const weeklyWageBill = Math.floor(teamWeeklySalary(team, seasonYear));
  const last = finances.lastHomeMatch;
  const opponent = last ? rivalTeams.find(r => r.id === last.opponentId) : null;
  const seasonNet = finances.seasonIncome - finances.seasonSalaries;

  const moneyClass = (n: number) =>
    n < 0 ? 'text-vga-light-red' : 'text-vga-light-green';

  return (
    <div className="w-full max-w-2xl flex flex-col gap-4 animate-in fade-in duration-300">
      <div className="bg-vga-blue p-2 border-2 border-vga-white flex justify-between items-center vga-panel">
        <h2 className="text-vga-yellow text-xs uppercase font-bold">{t('section.finances')}</h2>
        <button onClick={onBack} className="bg-vga-red text-vga-bright-white px-3 py-1 text-[8px] border border-vga-black hover:bg-vga-light-red">
          {t('btn.back')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-vga-gray border-4 border-vga-blue p-4">
          <h3 className="text-vga-blue text-[10px] font-bold mb-4 border-b border-vga-blue">{t('section.accounts')}</h3>
          <div className="flex flex-col gap-2 text-[8px]">
            <div className="flex justify-between">
              <span className="text-vga-black">{t('misc.budgetLabel')}</span>
              <span className={`text-[10px] font-bold ${moneyClass(team.budget)}`}>{formatEuros(team.budget)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-vga-black">{t('misc.weeklySalary')}</span>
              <span className="text-[10px] font-bold text-vga-light-red">−{formatEuros(weeklyWageBill)}</span>
            </div>
            <div className="border-t border-vga-white pt-2 mt-1 flex flex-col gap-1">
              <div className="flex justify-between">
                <span className="text-vga-black">{t('misc.seasonIncome')}</span>
                <span className="text-vga-light-green font-bold">{formatEuros(finances.seasonIncome)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-vga-black">{t('misc.seasonSalaries')}</span>
                <span className="text-vga-light-red font-bold">−{formatEuros(finances.seasonSalaries)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-vga-black">{t('misc.seasonBalance')}</span>
                <span className={`font-bold ${moneyClass(seasonNet)}`}>{formatEuros(seasonNet)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-vga-gray border-4 border-vga-blue p-4">
          <h3 className="text-vga-blue text-[10px] font-bold mb-4 border-b border-vga-blue">{t('section.stadiumGate')}</h3>
          <div className="flex flex-col gap-3 text-[8px]">
            <div>
              <span className="block text-vga-black">{t('misc.nameLabel')}</span>
              <span className="text-[10px] text-vga-blue font-bold">{team.stadiumName}</span>
            </div>
            <div>
              <span className="block text-vga-black">{t('misc.capacityLabel')}</span>
              <span className="text-[10px] text-vga-black font-bold">{team.stadiumCapacity.toLocaleString()} {t('misc.spectators')}</span>
            </div>
            <div className="mt-1 pt-2 border-t border-vga-white">
              <span className="block text-vga-black mb-2">{t('misc.ticketLabel')}</span>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => onUpdateTicketPrice(Math.max(3, team.ticketPrice - 1))}
                  className="bg-vga-red text-vga-bright-white px-2 py-1 border border-black text-[10px]"
                >-</button>
                <span className="text-vga-black font-bold text-sm">{team.ticketPrice} €</span>
                <button
                  onClick={() => onUpdateTicketPrice(team.ticketPrice + 1)}
                  className="bg-vga-green text-vga-bright-white px-2 py-1 border border-black text-[10px]"
                >+</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-vga-gray border-4 border-vga-blue p-4">
        <h3 className="text-vga-blue text-[10px] font-bold mb-3 border-b border-vga-blue">{t('section.lastHomeMatch')}</h3>
        {last ? (
          <div className="grid grid-cols-3 gap-2 text-center text-[8px]">
            <div className="bg-vga-black border border-vga-gray p-2">
              <div className="text-vga-cyan text-[7px] uppercase">{t('misc.rivalLabel')}</div>
              <div className="text-vga-bright-white text-[9px] truncate">{opponent?.name ?? '—'}</div>
            </div>
            <div className="bg-vga-black border border-vga-gray p-2">
              <div className="text-vga-cyan text-[7px] uppercase">{t('misc.attendanceLabel')}</div>
              <div className="text-vga-bright-white text-[9px]">{last.attendance.toLocaleString()}</div>
              <div className="text-vga-yellow text-[7px]">{t('misc.fillPctLabel', { pct: String(Math.round(last.fillPct * 100)) })}</div>
            </div>
            <div className="bg-vga-black border border-vga-gray p-2">
              <div className="text-vga-cyan text-[7px] uppercase">{t('misc.gateLabel')}</div>
              <div className="text-vga-light-green text-[9px] font-bold">{formatEuros(last.income)}</div>
            </div>
          </div>
        ) : (
          <div className="bg-vga-black border border-vga-gray p-3 text-center text-[8px] text-vga-gray">
            {t('misc.noHomeMatches')}
          </div>
        )}
      </div>

      <div className="bg-vga-gray border-4 border-vga-blue p-4">
        <h3 className="text-vga-blue text-[10px] font-bold mb-3 border-b border-vga-blue">{t('section.weeklyFinances')}</h3>
        {finances.weeks.length === 0 ? (
          <div className="bg-vga-black border border-vga-gray p-3 text-center text-[8px] text-vga-gray">
            {t('misc.noWeeklyMoves')}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2 text-[7px] text-vga-black uppercase border-b border-vga-blue pb-1 mb-1">
              <div>{t('label.jornada')}</div>
              <div className="text-right">{t('label.income')}</div>
              <div className="text-right">{t('label.salaries')}</div>
              <div className="text-right">{t('label.net')}</div>
            </div>
            <div className="flex flex-col gap-0.5 max-h-64 overflow-y-auto">
              {[...finances.weeks].sort((a, b) => b.jornada - a.jornada).map(w => {
                const net = w.income - w.salaries;
                return (
                  <div key={w.jornada} className="flex flex-col bg-vga-black border border-vga-gray">
                    <div className="grid grid-cols-4 gap-2 text-[8px] px-2 py-1">
                      <div className="text-vga-yellow font-bold">J{w.jornada}</div>
                      <div className="text-right text-vga-light-green">{formatEuros(w.income)}</div>
                      <div className="text-right text-vga-light-red">−{formatEuros(w.salaries)}</div>
                      <div className={`text-right font-bold ${moneyClass(net)}`}>{formatEuros(net)}</div>
                    </div>
                    {w.tvBonus != null && w.tvBonus > 0 && (
                      <div className="px-2 pb-1 text-[6px] text-vga-yellow">
                        TV +{formatEuros(w.tvBonus)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="bg-vga-magenta p-2 border-2 border-vga-white text-[7px] text-vga-bright-white text-center">
        {t('misc.financeWarning')}
      </div>
    </div>
  );
};
