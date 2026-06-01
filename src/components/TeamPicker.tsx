import { useMemo, useRef, useState } from 'react';
import type { Team } from '../types/game.d.ts';
import { calculateTeamStrength } from '../engine/simEngine';
import { TeamCrest } from './TeamCrest';
import { CountryBadge } from './CountryBadge';
import { countryName } from '../data/countries';
import { ScreenHeader } from './ScreenHeader';

export type TeamPickerMode = 'play' | 'promanager' | 'tournament';

export interface TeamSummary {
  id: string;
  name: string;
  colors?: [string, string] | string[];
  country?: string;
  league?: string | null;
  med: number;
  playerCount: number;
  topPlayerName?: string;
  topPlayerMed?: number;
}

interface Props {
  title: string;
  year: number;
  /** Lightweight summaries — full Team is only built on demand for the modal. */
  teams: TeamSummary[];
  mode: TeamPickerMode;
  minTeams: number;
  maxTeams: number;
  allowSpectate?: boolean;
  defaultSelectAll?: boolean;
  onBack: () => void;
  onConfirm: (result: { teamIds: string[]; userTeamId: string | null; spectate: boolean }) => void;
  /** Lazy full-team builder used by the squad modal. */
  buildTeam?: (teamId: string) => Team | null;
  /** When provided, the AÑO pill becomes a selector with these years. */
  availableYears?: number[];
  onYearChange?: (year: number) => void;
}

const PAGE_SIZE = 100;

export const TeamPicker = ({
  title, year, teams, mode, minTeams, maxTeams,
  allowSpectate = true, defaultSelectAll, onBack, onConfirm, buildTeam,
  availableYears, onYearChange,
}: Props) => {
  const initialSelected = useMemo(() => {
    return defaultSelectAll ? new Set(teams.map(t => t.id)) : new Set<string>();
  }, [teams, defaultSelectAll]);

  const [selected, setSelected] = useState<Set<string>>(initialSelected);
  const [userTeamId, setUserTeamId] = useState<string | null>(null);
  const [spectate, setSpectate] = useState(false);
  const [query, setQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState<string | null>(null);
  const [previewTeam, setPreviewTeam] = useState<Team | null>(null);
  const [page, setPage] = useState(0);
  const [layout, setLayout] = useState<'grid' | 'list'>('list');

  const hasCountry = useMemo(() => teams.some(t => !!t.country), [teams]);

  const countries = useMemo(() => {
    if (!hasCountry) return [] as Array<[string, number]>;
    const map = new Map<string, number>();
    for (const t of teams) {
      const c = t.country || 'other';
      map.set(c, (map.get(c) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [teams, hasCountry]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return teams
      .filter(t => !countryFilter || (t.country || 'other') === countryFilter)
      .filter(t => !q || t.name.toLowerCase().includes(q))
      .sort((a, b) => b.med - a.med);
  }, [teams, query, countryFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, filtered.length);
  const pageSlice = filtered.slice(pageStart, pageEnd);

  // Lazy Team cache — built lazily for visible rows AND any selected team so
  // the right-side panel can show accurate engine MEDs (not summary approx).
  // Reset whenever the year changes (player stats depend on age).
  const teamCache = useRef<Map<string, Team>>(new Map());
  const cacheYearRef = useRef<number>(year);
  const [accurateBump, setAccurateBump] = useState(0);
  if (cacheYearRef.current !== year) {
    teamCache.current = new Map();
    cacheYearRef.current = year;
  }
  const accurateMed = (t: TeamSummary): { med: number; topName?: string; topMed?: number } => {
    if (!buildTeam) return { med: t.med, topName: t.topPlayerName, topMed: t.topPlayerMed };
    let full = teamCache.current.get(t.id);
    if (!full) {
      const built = buildTeam(t.id);
      if (!built) return { med: t.med, topName: t.topPlayerName, topMed: t.topPlayerMed };
      teamCache.current.set(t.id, built);
      full = built;
    }
    const med = Math.floor(calculateTeamStrength(full) / 2);
    const star = full.players.reduce((best, p) => (p.media > (best?.media ?? -1) ? p : best), full.players[0]);
    return { med, topName: star?.name, topMed: star?.media };
  };
  const enriched = useMemo(() => {
    return pageSlice.map(t => {
      const a = accurateMed(t);
      return { ...t, med: a.med, topPlayerName: a.topName ?? t.topPlayerName, topPlayerMed: a.topMed ?? t.topPlayerMed };
    });
  // accurateBump intentionally not in deps — invalidates when selection grows.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSlice, buildTeam, year, accurateBump]);

  // Reset to page 0 whenever the filter/search changes
  const resetPage = () => setPage(0);

  const selectedTeams = useMemo(
    () => teams.filter(t => selected.has(t.id)).sort((a, b) => b.med - a.med),
    [teams, selected]
  );
  const enrichedSelected = useMemo(() => {
    return selectedTeams.map(t => {
      const a = accurateMed(t);
      return { ...t, med: a.med, topPlayerName: a.topName ?? t.topPlayerName, topPlayerMed: a.topMed ?? t.topPlayerMed };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeams, buildTeam, year, accurateBump]);
  void setAccurateBump;

  const toggleTeam = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (userTeamId === id) setUserTeamId(null);
      } else if (next.size < maxTeams) {
        next.add(id);
      }
      return next;
    });
  };

  const setYo = (id: string) => {
    if (!selected.has(id)) {
      setSelected(prev => new Set(prev).add(id));
    }
    setUserTeamId(id);
    setSpectate(false);
  };

  const toggleSpectate = () => {
    setSpectate(s => {
      if (!s) setUserTeamId(null);
      return !s;
    });
  };

  const n = selected.size;
  const inRange = n >= minTeams && n <= maxTeams;
  const userOk = spectate || !!userTeamId;
  void mode;
  const canConfirm = inRange && userOk;

  const confirm = () => {
    if (!canConfirm) return;
    onConfirm({ teamIds: Array.from(selected), userTeamId, spectate });
  };

  const headerActions = (
    <div className="of-tp-head-actions">
      {availableYears && onYearChange ? (
        <label className="of-tp-pill of-tp-pill-info of-tp-year-select" title="Cambia la temporada">
          AÑO
          <select
            value={year}
            onChange={e => onYearChange(parseInt(e.target.value, 10))}
            className="of-tp-year-input"
          >
            {availableYears.map(y => (
              <option key={y} value={y}>{y}/{(y + 1).toString().slice(-2)}</option>
            ))}
          </select>
        </label>
      ) : (
        <div className="of-tp-pill of-tp-pill-info">
          AÑO {year}/{(year + 1).toString().slice(-2)}
        </div>
      )}
      <div className={`of-tp-pill ${inRange ? 'of-tp-pill-ok' : 'of-tp-pill-warn'}`}>
        {n} / {maxTeams}
      </div>
      <button
        className="of-tp-confirm"
        disabled={!canConfirm}
        onClick={confirm}
        title={!canConfirm ? `Selecciona ${minTeams}–${maxTeams} equipos y tu rol` : 'Empezar'}
      >
        CONTINUAR →
      </button>
    </div>
  );

  return (
    <div className="of-tp w-full max-w-[1600px] mx-auto flex flex-col gap-3 animate-in fade-in duration-300">
      <ScreenHeader title={title} subtitle={`${teams.length} equipos disponibles`} onBack={onBack} actions={headerActions} />

      <div className="of-tp-grid">
        {/* LEFT — team browser */}
        <div className="of-tp-panel">
          <div className="of-tp-toolbar">
            <input
              className="of-tp-search"
              placeholder="Buscar equipo…"
              value={query}
              onChange={e => { setQuery(e.target.value); resetPage(); }}
            />
            {hasCountry && countries.length > 1 && (
              <div className="of-tp-countries">
                <button
                  className={`of-tp-country ${countryFilter === null ? 'is-active' : ''}`}
                  onClick={() => { setCountryFilter(null); resetPage(); }}
                >TODOS</button>
                {countries.map(([c, count]) => (
                  <button
                    key={c}
                    className={`of-tp-country ${countryFilter === c ? 'is-active' : ''}`}
                    onClick={() => { setCountryFilter(p => p === c ? null : c); resetPage(); }}
                    title={`${countryName(c)} — ${count} equipos`}
                  >
                    <CountryBadge code={c} size="sm" /> <span className="of-tp-country-n">{count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="of-tp-meta-line">
            <div className="of-tp-view-toggle">
              <button className={`of-tp-view-btn ${layout === 'list' ? 'is-on' : ''}`} onClick={() => setLayout('list')} title="Vista compacta">≡</button>
              <button className={`of-tp-view-btn ${layout === 'grid' ? 'is-on' : ''}`} onClick={() => setLayout('grid')} title="Vista tarjetas">▦</button>
            </div>
            <span>Mostrando {pageStart + 1}–{pageEnd} de {filtered.length}</span>
            {pageCount > 1 && (
              <span className="of-tp-pager of-tp-pager-inline">
                <button className="of-tp-pager-btn" disabled={safePage === 0} onClick={() => setPage(0)} title="Primera">«</button>
                <button className="of-tp-pager-btn" disabled={safePage === 0} onClick={() => setPage(p => Math.max(0, p - 1))} title="Anterior">‹</button>
                <span className="of-tp-pager-info">{safePage + 1} / {pageCount}</span>
                <button className="of-tp-pager-btn" disabled={safePage >= pageCount - 1} onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} title="Siguiente">›</button>
                <button className="of-tp-pager-btn" disabled={safePage >= pageCount - 1} onClick={() => setPage(pageCount - 1)} title="Última">»</button>
              </span>
            )}
          </div>
          <div className={layout === 'grid' ? 'of-tp-cards' : 'of-tp-list'}>
            {enriched.map(team => {
              const isSel = selected.has(team.id);
              const isYo = userTeamId === team.id;
              if (layout === 'list') {
                return (
                  <div
                    key={team.id}
                    className={`of-tp-listrow ${isSel ? 'is-selected' : ''} ${isYo ? 'is-yo' : ''}`}
                    onClick={() => toggleTeam(team.id)}
                  >
                    <TeamCrest colors={team.colors} size="sm" title={team.name} teamId={team.id} />
                    <div className="of-tp-listrow-name" title={team.name}>{team.name}</div>
                    <div className="of-tp-listrow-flag">{team.country && <CountryBadge code={team.country} size="sm" />}</div>
                    <div className="of-tp-listrow-league" title={team.league || ''}>{team.league || '—'}</div>
                    <div className="of-tp-listrow-star" title={team.topPlayerName || ''}>★ {team.topPlayerName || '—'} <span>{team.topPlayerMed ?? 0}</span></div>
                    <div className="of-tp-listrow-med">MED {team.med}</div>
                    <div className="of-tp-listrow-actions" onClick={e => e.stopPropagation()}>
                      <button className={`of-tp-card-btn ${isSel ? 'is-on-pink' : ''}`} onClick={() => toggleTeam(team.id)} title={isSel ? 'Quitar' : 'Añadir'}>{isSel ? '−' : '+'}</button>
                      {buildTeam && (
                        <button className="of-tp-card-btn" onClick={() => { const t = buildTeam(team.id); if (t) setPreviewTeam(t); }} title="Ver plantilla">👁</button>
                      )}
                    </div>
                  </div>
                );
              }
              return (
                <div
                  key={team.id}
                  className={`of-tp-card ${isSel ? 'is-selected' : ''} ${isYo ? 'is-yo' : ''}`}
                  onClick={() => toggleTeam(team.id)}
                >
                  <div className="of-tp-card-head">
                    <TeamCrest colors={team.colors} size="lg" title={team.name} teamId={team.id} />
                    <div className="of-tp-card-meta">
                      <div className="of-tp-card-name">{team.name}</div>
                      <div className="of-tp-card-sub">
                        {team.country && <CountryBadge code={team.country} size="sm" />}
                        {team.league && <span className="of-tp-league" title={team.league}>{team.league}</span>}
                        <span className="of-tp-med">MED {team.med}</span>
                      </div>
                    </div>
                  </div>
                  <div className="of-tp-card-star">
                    <span className="of-tp-card-key">★</span>
                    <span className="of-tp-card-star-name">{team.topPlayerName ?? '—'}</span>
                    <span className="of-tp-card-star-med">{team.topPlayerMed ?? 0}</span>
                  </div>
                  <div className="of-tp-card-actions" onClick={e => e.stopPropagation()}>
                    <button
                      className={`of-tp-card-btn of-tp-card-btn-wide ${isSel ? 'is-on-pink' : ''}`}
                      onClick={() => toggleTeam(team.id)}
                    >
                      {isSel ? '− QUITAR' : '+ AÑADIR'}
                    </button>
                    {buildTeam && (
                      <button
                        className="of-tp-card-btn of-tp-card-btn-wide"
                        onClick={() => { const t = buildTeam(team.id); if (t) setPreviewTeam(t); }}
                        title="Ver plantilla completa"
                      >
                        VER PLANTILLA
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="of-tp-empty">Ningún equipo coincide con la búsqueda.</div>
            )}
          </div>
          {pageCount > 1 && (
            <div className="of-tp-pager">
              <button className="of-tp-pager-btn" disabled={safePage === 0} onClick={() => setPage(0)} title="Primera">«</button>
              <button className="of-tp-pager-btn" disabled={safePage === 0} onClick={() => setPage(p => Math.max(0, p - 1))} title="Anterior">‹</button>
              <span className="of-tp-pager-info">{safePage + 1} / {pageCount}</span>
              <button className="of-tp-pager-btn" disabled={safePage >= pageCount - 1} onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} title="Siguiente">›</button>
              <button className="of-tp-pager-btn" disabled={safePage >= pageCount - 1} onClick={() => setPage(pageCount - 1)} title="Última">»</button>
            </div>
          )}
        </div>

        {/* RIGHT — selection summary */}
        <div className="of-tp-panel of-tp-panel-side">
          <div className="of-tp-side-head">
            <div className="of-tp-side-title">SELECCIÓN</div>
            <div className="of-tp-side-count">{n}/{maxTeams}</div>
          </div>

          {allowSpectate && (
            <button
              onClick={toggleSpectate}
              className={`of-tp-spectate ${spectate ? 'is-on' : ''}`}
              title="Solo simular, sin controlar un equipo"
            >
              <span className="of-tp-spectate-led" /> ESPECTADOR
            </button>
          )}

          <div className="of-tp-side-list">
            {selectedTeams.length === 0 && (
              <div className="of-tp-empty">Aún no has elegido ningún equipo.</div>
            )}
            {enrichedSelected.map(team => {
              const isYo = userTeamId === team.id;
              return (
                <div key={team.id} className={`of-tp-row ${isYo ? 'is-yo' : ''}`}>
                  <TeamCrest colors={team.colors} size="sm" title={team.name} teamId={team.id} />
                  <div className="of-tp-row-name">{team.name}</div>
                  <div className="of-tp-row-med">MED {team.med}</div>
                  <button
                    onClick={() => setYo(team.id)}
                    disabled={spectate}
                    className={`of-tp-row-yo ${isYo ? 'is-on' : ''}`}
                    title="Marcar como mi equipo"
                  >
                    {isYo ? 'YO' : '·'}
                  </button>
                  <button
                    onClick={() => toggleTeam(team.id)}
                    className="of-tp-row-rm"
                    title="Quitar"
                  >×</button>
                </div>
              );
            })}
          </div>

          <div className="of-tp-side-foot">
            {!inRange && (
              <div className="of-tp-warn">
                {n < minTeams ? `Mínimo ${minTeams} equipos` : `Máximo ${maxTeams} equipos`}
              </div>
            )}
            {inRange && !userOk && (
              <div className="of-tp-warn">Elige un equipo o marca «Espectador»</div>
            )}
            {canConfirm && (
              <div className="of-tp-ok">
                Listo · {spectate ? 'Espectador' : `Controlas ${selectedTeams.find(t => t.id === userTeamId)?.name}`}
              </div>
            )}
          </div>
        </div>
      </div>

      {previewTeam && (
        <div className="of-tp-modal" onClick={() => setPreviewTeam(null)}>
          <div className="of-tp-modal-panel" onClick={e => e.stopPropagation()}>
            <div className="of-tp-modal-head">
              <div className="of-tp-modal-titles">
                <TeamCrest colors={previewTeam.colors} size="lg" title={previewTeam.name} teamId={previewTeam.id} />
                <div>
                  <div className="of-tp-modal-name">{previewTeam.name}</div>
                  <div className="of-tp-modal-sub">
                    <span className="of-tp-modal-count">{previewTeam.players.length} jugadores</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setPreviewTeam(null)} className="of-screenbar-back">CERRAR</button>
            </div>
            <div className="of-tp-modal-body">
              <table className="of-tp-roster">
                <thead>
                  <tr>
                    <th>#</th><th>POS</th><th>NOMBRE</th><th>EDAD</th><th>MED</th>
                  </tr>
                </thead>
                <tbody>
                  {[...previewTeam.players]
                    .sort((a, b) => b.media - a.media)
                    .map((p, i) => (
                      <tr key={p.id}>
                        <td className="of-tp-roster-num">{i + 1}</td>
                        <td className="of-tp-roster-pos">{p.preferredPos}</td>
                        <td className="of-tp-roster-name">{p.name}</td>
                        <td>{previewTeam.year - p.birthYear}</td>
                        <td className="of-tp-roster-med">{p.media}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
