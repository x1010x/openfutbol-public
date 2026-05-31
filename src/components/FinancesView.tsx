import type { Team } from '../types/game.d.ts';
import type { TeamFinances, TransferRecord } from '../store/leagueStore';
import { formatEuros, teamWeeklySalary, computePrice } from '../data/economy';
import { useT } from '../i18n';

const POS_COLOR: Record<string, string> = {
  POR: 'text-vga-yellow', DEF: 'text-vga-light-cyan',
  MED: 'text-vga-light-green', DEL: 'text-vga-light-red',
  AML: 'text-vga-light-magenta', AMR: 'text-vga-light-magenta',
};

interface Props {
  team: Team;
  finances: TeamFinances;
  rivalTeams: Team[];
  seasonYear: number;
  transferLog: TransferRecord[];
  onUpdateTicketPrice: (price: number) => void;
  onBack: () => void;
}

const Panel = ({ title, accent = 'text-vga-magenta', children, className = '', right }: {
  title: string; accent?: string; children: React.ReactNode; className?: string; right?: React.ReactNode;
}) => (
  <div className={`bg-vga-black border border-vga-blue flex flex-col ${className}`}>
    <div className={`${accent} text-[9px] uppercase tracking-widest px-2 py-1 border-b border-vga-blue flex items-center justify-between`}>
      <span>{title}</span>
      {right}
    </div>
    <div className="flex-1">{children}</div>
  </div>
);

const Tile = ({ label, value, color = 'text-vga-bright-white', sub }: {
  label: string; value: string; color?: string; sub?: string;
}) => (
  <div className="bg-vga-black border border-vga-blue p-2">
    <div className="text-vga-magenta text-[7px] uppercase tracking-widest truncate">{label}</div>
    <div className={`${color} text-[13px] font-bold tabular-nums truncate`}>{value}</div>
    {sub && <div className="text-vga-gray text-[7px] truncate">{sub}</div>}
  </div>
);

export const FinancesView = ({ team, finances, rivalTeams, seasonYear, transferLog, onUpdateTicketPrice, onBack }: Props) => {
  const t = useT();
  const weeklyWageBill = Math.floor(teamWeeklySalary(team, seasonYear));
  const last = finances.lastHomeMatch;
  const opponent = last ? rivalTeams.find(r => r.id === last.opponentId) : null;
  const seasonNet = finances.seasonIncome - finances.seasonSalaries;

  const squadValue = team.players.reduce((sum, p) => sum + computePrice(p, seasonYear), 0);
  const totalAssets = team.budget + squadValue;

  // Derived metrics
  const cashRunwayWeeks = weeklyWageBill > 0 ? Math.floor(team.budget / weeklyWageBill) : 999;
  const homeWeeks = finances.weeks.filter(w => w.income > 0);
  const avgHomeIncome = homeWeeks.length > 0 ? Math.round(homeWeeks.reduce((s, w) => s + w.income, 0) / homeWeeks.length) : 0;
  const avgWeeklyNet = finances.weeks.length > 0
    ? Math.round(finances.weeks.reduce((s, w) => s + (w.income - w.salaries), 0) / finances.weeks.length)
    : 0;
  const totalTvBonus = finances.weeks.reduce((s, w) => s + (w.tvBonus ?? 0), 0);
  const seasonProgressJ = finances.weeks.length;

  // Top earners + payroll composition
  const topEarners = [...team.players].sort((a, b) => (b.contract?.salary ?? 0) - (a.contract?.salary ?? 0)).slice(0, 5);
  const payrollByGroup: Record<string, number> = { POR: 0, DEF: 0, MED: 0, AML: 0, AMR: 0, DEL: 0 };
  for (const p of team.players) {
    payrollByGroup[p.position] = (payrollByGroup[p.position] ?? 0) + (p.contract?.salary ?? 0);
  }
  const totalWeeklyPayroll = Object.values(payrollByGroup).reduce((a, b) => a + b, 0);

  const moneyClass = (n: number) => n < 0 ? 'text-vga-light-red' : 'text-vga-light-green';

  const myTransfers = transferLog.filter(r => r.fromTeamName === team.name || r.toTeamName === team.name);
  const transferDirection = (r: TransferRecord): 'in' | 'out' => r.toTeamName === team.name ? 'in' : 'out';
  const inflowsThisSeason = myTransfers
    .filter(r => r.year === seasonYear && r.kind !== 'retirement' && transferDirection(r) === 'out')
    .reduce((s, r) => s + r.amount, 0);
  const outflowsThisSeason = myTransfers
    .filter(r => r.year === seasonYear && r.kind !== 'retirement' && transferDirection(r) === 'in')
    .reduce((s, r) => s + r.amount, 0);
  const transferBalance = inflowsThisSeason - outflowsThisSeason;

  const sortedWeeks = [...finances.weeks].sort((a, b) => b.jornada - a.jornada);
  const maxWeekBar = Math.max(1, ...finances.weeks.map(w => Math.max(w.income, w.salaries)));

  const adjustTicket = (delta: number) => onUpdateTicketPrice(Math.max(3, team.ticketPrice + delta));

  return (
    <div className="w-full flex flex-col gap-3 animate-in fade-in duration-300 px-2">
      {/* Header */}
      <div className="bg-vga-black border border-vga-blue px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-vga-magenta text-[10px] uppercase tracking-widest">{t('section.finances')}</span>
          <span className="text-vga-bright-white text-[11px] font-bold">{team.name}</span>
          <span className="text-vga-gray text-[8px]">J{seasonProgressJ} · {seasonYear}/{(seasonYear + 1).toString().slice(-2)}</span>
        </div>
        <button onClick={onBack} className="bg-vga-red text-vga-bright-white px-3 py-1 text-[8px] border border-vga-black hover:bg-vga-light-red font-bold uppercase">
          {t('btn.back')}
        </button>
      </div>

      {/* Headline tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        <Tile label="Caja" value={formatEuros(team.budget)} color={moneyClass(team.budget)} sub={`${cashRunwayWeeks}+ semanas de salarios`} />
        <Tile label="Salario semanal" value={formatEuros(weeklyWageBill)} color="text-vga-light-red" sub={`${formatEuros(weeklyWageBill * 4)} al mes`} />
        <Tile label="Ingresos temporada" value={formatEuros(finances.seasonIncome)} color="text-vga-light-green" sub={`${avgHomeIncome > 0 ? formatEuros(avgHomeIncome) : '—'} / partido casa`} />
        <Tile label="Salarios temporada" value={formatEuros(finances.seasonSalaries)} color="text-vga-light-red" sub={`${formatEuros(weeklyWageBill * Math.max(0, 46 - seasonProgressJ))} por pagar`} />
        <Tile label="Balance temporada" value={formatEuros(seasonNet)} color={moneyClass(seasonNet)} sub={`${formatEuros(avgWeeklyNet)} / sem promedio`} />
        <Tile label="Balance fichajes" value={formatEuros(transferBalance)} color={moneyClass(transferBalance)} sub={`${formatEuros(outflowsThisSeason)} salidas`} />
        <Tile label="Valor plantilla" value={formatEuros(squadValue)} color="text-vga-cyan" sub={`${team.players.length} jugadores`} />
        <Tile label="Activos totales" value={formatEuros(totalAssets)} color={moneyClass(totalAssets)} sub={totalTvBonus > 0 ? `TV +${formatEuros(totalTvBonus)}` : ''} />
      </div>

      {/* Stadium + ticket controls + last home */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        <Panel title="Estadio">
          <div className="p-3 flex flex-col gap-1 text-[9px]">
            <div className="flex justify-between"><span className="text-vga-magenta text-[7px] uppercase">Nombre</span><span className="text-vga-bright-white">{team.stadiumName ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-vga-magenta text-[7px] uppercase">Aforo</span><span className="text-vga-bright-white tabular-nums">{team.stadiumCapacity.toLocaleString('es-ES')}</span></div>
            <div className="flex justify-between"><span className="text-vga-magenta text-[7px] uppercase">Asistencia media</span><span className="text-vga-bright-white tabular-nums">{last ? last.attendance.toLocaleString('es-ES') : '—'}</span></div>
            <div className="flex justify-between"><span className="text-vga-magenta text-[7px] uppercase">% Ocupación última</span><span className={`tabular-nums ${last && last.fillPct >= 0.85 ? 'text-vga-light-green' : last && last.fillPct >= 0.6 ? 'text-vga-yellow' : 'text-vga-light-red'}`}>{last ? Math.round(last.fillPct * 100) + '%' : '—'}</span></div>
          </div>
        </Panel>

        <Panel title="Precio entrada" right={<span className="text-vga-light-green text-[8px] font-bold">{team.ticketPrice} €</span>}>
          <div className="p-3 flex flex-col gap-2 text-[9px]">
            <div className="flex items-center justify-between gap-1">
              {[-5, -1, +1, +5].map(d => (
                <button
                  key={d}
                  onClick={() => adjustTicket(d)}
                  className={`flex-1 text-[10px] font-bold px-2 py-1 border ${d < 0 ? 'border-vga-light-red text-vga-light-red hover:bg-vga-light-red hover:text-vga-black' : 'border-vga-light-green text-vga-light-green hover:bg-vga-light-green hover:text-vga-black'}`}
                >
                  {d > 0 ? `+${d}` : d}
                </button>
              ))}
            </div>
            <div className="text-vga-gray text-[7px] mt-1">Sube demasiado y la taquilla baja. Baja demasiado y dejas dinero en la mesa.</div>
            <div className="grid grid-cols-3 gap-1 mt-1 text-center">
              <button onClick={() => onUpdateTicketPrice(Math.max(3, Math.round(team.ticketPrice * 0.7)))} className="text-[8px] px-1 py-1 border border-vga-gray text-vga-gray hover:border-vga-bright-white hover:text-vga-bright-white uppercase">Barato</button>
              <button onClick={() => onUpdateTicketPrice(Math.max(3, Math.round(team.ticketPrice * 1.0)))} className="text-[8px] px-1 py-1 border border-vga-gray text-vga-gray hover:border-vga-bright-white hover:text-vga-bright-white uppercase">Justo</button>
              <button onClick={() => onUpdateTicketPrice(Math.max(3, Math.round(team.ticketPrice * 1.3)))} className="text-[8px] px-1 py-1 border border-vga-gray text-vga-gray hover:border-vga-bright-white hover:text-vga-bright-white uppercase">Caro</button>
            </div>
          </div>
        </Panel>

        <Panel title="Último partido en casa">
          {last ? (
            <div className="p-3 flex flex-col gap-1 text-[9px]">
              <div className="text-vga-bright-white truncate">{opponent?.name ?? '—'}</div>
              <div className="flex justify-between"><span className="text-vga-magenta text-[7px] uppercase">Asistencia</span><span className="text-vga-bright-white tabular-nums">{last.attendance.toLocaleString('es-ES')} ({Math.round(last.fillPct * 100)}%)</span></div>
              <div className="flex justify-between"><span className="text-vga-magenta text-[7px] uppercase">Capacidad</span><span className="text-vga-gray tabular-nums">{last.capacity.toLocaleString('es-ES')}</span></div>
              <div className="flex justify-between"><span className="text-vga-magenta text-[7px] uppercase">Ingresos</span><span className="text-vga-light-green font-bold tabular-nums">{formatEuros(last.income)}</span></div>
              <div className="flex justify-between"><span className="text-vga-magenta text-[7px] uppercase">€ por asistente</span><span className="text-vga-cyan tabular-nums">{last.attendance > 0 ? formatEuros(Math.round(last.income / last.attendance)) : '—'}</span></div>
            </div>
          ) : (
            <div className="p-3 text-vga-gray text-[8px]">Aún sin partidos en casa.</div>
          )}
        </Panel>
      </div>

      {/* Payroll breakdown + top earners */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <Panel title="Distribución salarial">
          <div className="p-3 flex flex-col gap-1">
            {(['POR', 'DEF', 'MED', 'AML', 'AMR', 'DEL'] as const).map(pos => {
              const amount = payrollByGroup[pos] ?? 0;
              const pct = totalWeeklyPayroll > 0 ? (amount / totalWeeklyPayroll) * 100 : 0;
              return (
                <div key={pos} className="grid grid-cols-[2.4rem_1fr_minmax(4.5rem,auto)] items-center gap-2 text-[8px]">
                  <span className={`${POS_COLOR[pos]} font-bold uppercase`}>{pos}</span>
                  <div className="h-2 bg-vga-blue/30 border border-vga-blue">
                    <div className={`h-full ${POS_COLOR[pos].replace('text-', 'bg-')}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-right text-vga-bright-white tabular-nums">{formatEuros(amount)} <span className="text-vga-gray text-[7px]">({pct.toFixed(0)}%)</span></span>
                </div>
              );
            })}
            <div className="mt-2 pt-2 border-t border-vga-blue text-[8px] text-vga-gray">
              Total semanal: <span className="text-vga-light-red font-bold">{formatEuros(totalWeeklyPayroll)}</span>
            </div>
          </div>
        </Panel>

        <Panel title="Top 5 sueldos">
          {topEarners.length === 0 || topEarners.every(p => (p.contract?.salary ?? 0) === 0) ? (
            <div className="p-3 text-vga-gray text-[8px]">Sin sueldos registrados.</div>
          ) : (
            <table className="w-full text-[9px]">
              <thead>
                <tr className="text-vga-magenta text-[7px] uppercase">
                  <th className="text-left pl-2 py-1">#</th>
                  <th className="text-left">Jugador</th>
                  <th className="text-left">Pos</th>
                  <th className="text-right">Sueldo / sem</th>
                  <th className="text-right pr-2">Sueldo / año</th>
                </tr>
              </thead>
              <tbody>
                {topEarners.map((p, i) => (
                  <tr key={p.id}>
                    <td className={`pl-2 py-0.5 ${i === 0 ? 'text-vga-yellow font-bold' : 'text-vga-magenta'}`}>{i + 1}</td>
                    <td className="text-vga-bright-white truncate max-w-[140px]">{p.name}</td>
                    <td className={`${POS_COLOR[p.position] ?? 'text-vga-white'} font-bold uppercase`}>{p.position}</td>
                    <td className="text-right text-vga-light-red font-bold tabular-nums">{formatEuros(p.contract?.salary ?? 0)}</td>
                    <td className="text-right pr-2 text-vga-gray tabular-nums">{formatEuros((p.contract?.salary ?? 0) * 52)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      {/* Transfer log + weekly finances */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <Panel title={`Historial de fichajes · ${myTransfers.length}`}>
          {myTransfers.length === 0 ? (
            <div className="p-3 text-vga-gray text-[8px] text-center">{t('misc.noTransfers')}</div>
          ) : (
            <div className="flex flex-col gap-0.5 max-h-[40vh] overflow-y-auto p-2">
              {myTransfers.map(r => {
                const dir = transferDirection(r);
                const isRetirement = r.kind === 'retirement';
                const other = dir === 'in' ? r.fromTeamName : r.toTeamName;
                const amountColor = isRetirement ? 'text-vga-gray' : dir === 'in' ? 'text-vga-light-red' : 'text-vga-light-green';
                const amountPrefix = isRetirement ? '' : dir === 'in' ? '−' : '+';
                const posColor = POS_COLOR[r.playerPosition] ?? 'text-vga-bright-white';
                return (
                  <div key={r.id} className="bg-vga-black border border-vga-blue/40 px-2 py-1 text-[8px] flex items-center gap-2">
                    <span className="text-vga-magenta shrink-0 w-7 text-[7px] font-bold">J{r.jornada}</span>
                    <span className={`${posColor} shrink-0 w-7 text-[7px] font-bold`}>{r.playerPosition}</span>
                    <span className="text-vga-bright-white flex-1 truncate">{r.playerName}</span>
                    <span className="text-vga-cyan shrink-0 text-[7px] truncate max-w-[120px]">
                      {isRetirement ? 'retirado' : `${dir === 'in' ? '←' : '→'} ${other ?? 'Libre'}`}
                    </span>
                    <span className={`shrink-0 font-bold tabular-nums ${amountColor}`}>
                      {isRetirement ? '—' : `${amountPrefix}${formatEuros(r.amount)}`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="Finanzas por semana">
          {finances.weeks.length === 0 ? (
            <div className="p-3 text-vga-gray text-[8px] text-center">{t('misc.noWeeklyMoves')}</div>
          ) : (
            <div className="max-h-[40vh] overflow-y-auto p-2">
              <table className="w-full text-[9px]">
                <thead>
                  <tr className="text-vga-magenta text-[7px] uppercase">
                    <th className="text-left pl-2 py-1">Jor</th>
                    <th className="text-right">Ingresos</th>
                    <th className="text-right">Salarios</th>
                    <th className="text-right pr-2">Neto</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedWeeks.map(w => {
                    const net = w.income - w.salaries;
                    const incomePct = (w.income / maxWeekBar) * 100;
                    const salaryPct = (w.salaries / maxWeekBar) * 100;
                    return (
                      <tr key={w.jornada}>
                        <td className="pl-2 py-0.5 text-vga-yellow font-bold tabular-nums">J{w.jornada}</td>
                        <td className="text-right text-vga-light-green tabular-nums">
                          <div className="inline-flex items-center gap-1 justify-end">
                            <div className="bg-vga-light-green/40 h-1.5" style={{ width: `${incomePct * 0.5}px` }} />
                            {formatEuros(w.income)}
                          </div>
                          {w.tvBonus != null && w.tvBonus > 0 && (
                            <div className="text-[7px] text-vga-yellow">TV +{formatEuros(w.tvBonus)}</div>
                          )}
                        </td>
                        <td className="text-right text-vga-light-red tabular-nums">
                          <div className="inline-flex items-center gap-1 justify-end">
                            <div className="bg-vga-light-red/40 h-1.5" style={{ width: `${salaryPct * 0.5}px` }} />
                            −{formatEuros(w.salaries)}
                          </div>
                        </td>
                        <td className={`text-right pr-2 font-bold tabular-nums ${moneyClass(net)}`}>{formatEuros(net)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <div className="bg-vga-black border border-vga-magenta px-3 py-1.5 text-[8px] text-vga-magenta text-center uppercase tracking-wider">
        {t('misc.financeWarning')}
      </div>
    </div>
  );
};
