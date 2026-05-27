import { useEffect, useRef, useState } from 'react';
import type { V3Screen } from '../../AppV3';
import { MOCK_GAME_STATE } from '../../data/v3/mockGameState';
import { TeamCrest } from './TeamCrest';
import { formatEuros, formatGoalDiff } from '../../data/v3/format';

interface TopBarProps {
  current: V3Screen;
  onNavigate: (screen: V3Screen) => void;
}

const TABS: Array<{ id: Exclude<V3Screen, 'menu'>; label: string; accent: string; icon: string }> = [
  { id: 'liga',       label: 'Liga',       accent: 'var(--cat-league)',  icon: '/assets/icons/v3/liga.svg'       },
  { id: 'plantilla',  label: 'Plantilla',  accent: 'var(--cat-squad)',   icon: '/assets/icons/v3/plantilla.svg'  },
  { id: 'alineacion', label: 'Alineación', accent: 'var(--cat-squad)',   icon: '/assets/icons/v3/alineacion.svg' },
  { id: 'resultados', label: 'Resultados', accent: 'var(--cat-league)',  icon: '/assets/icons/v3/resultados.svg' },
  { id: 'finanzas',   label: 'Finanzas',   accent: 'var(--cat-finance)', icon: '/assets/icons/v3/finanzas.svg'   },
  { id: 'mercado',    label: 'Mercado',    accent: 'var(--cat-finance)', icon: '/assets/icons/v3/mercado.svg'    },
  { id: 'club',       label: 'Club',       accent: 'var(--cat-club)',    icon: '/assets/icons/v3/club.svg'       },
  { id: 'opciones',   label: 'Opciones',   accent: 'var(--text-dim)',    icon: '/assets/icons/v3/opciones.svg'   },
];

function positionColor(pos: number, total: number): string {
  if (pos === 1) return 'var(--cat-finance)';
  if (pos <= 3) return 'var(--cat-league)';
  if (pos > total - 3) return 'var(--cat-club)';
  return 'var(--text)';
}

function cashColor(cash: number): string {
  if (cash < 0) return 'var(--cat-club)';
  if (cash < 1_000_000) return 'var(--cat-finance)';
  return 'var(--cat-league)';
}

function goalDiffColor(diff: number): string {
  return diff >= 0 ? 'var(--cat-league)' : 'var(--cat-club)';
}

function florentinoColor(val: number): string {
  if (val >= 7) return 'var(--cat-league)';
  if (val >= 5) return 'var(--cat-finance)';
  return 'var(--cat-club)';
}

function TabIcon({ src, active }: { src: string; active: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      onError={() => setFailed(true)}
      style={{
        width: 14,
        height: 14,
        flexShrink: 0,
        imageRendering: 'pixelated',
        opacity: active ? 1 : 0.6,
      }}
    />
  );
}

export function TopBar({ current, onNavigate }: TopBarProps) {
  const g = MOCK_GAME_STATE;
  const navRowRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [current]);

  return (
    <div className="v3-topbar">
      {/* Row 1: stat strip */}
      <div className="v3-topbar-stat-row">

        {/* Brand mark → return to menu */}
        <div className="v3-topbar-brand">
          <button
            className="v3-topbar-brand-mark"
            onClick={() => onNavigate('menu')}
            title="Volver al menú"
          >
            OF
          </button>
          <span style={{
            fontFamily: 'var(--font-pixel)',
            fontSize: 'var(--fs-xs)',
            color: 'var(--text-dim)',
          }}>·</span>
          <TeamCrest
            colors={g.teamCrestColors}
            logoUrl={g.teamLogoUrl}
            size="sm"
            title={g.teamName}
          />
          <span
            className="is-essential"
            style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 'var(--fs-xs)',
              color: 'var(--text)',
              maxWidth: 180,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {g.teamName}
          </span>
        </div>

        {/* Stats */}
        <div className="v3-topbar-stats">
          <div className="v3-topbar-stat">
            <span className="v3-topbar-stat-label">POS</span>
            <span
              className="v3-topbar-stat-value"
              style={{ color: positionColor(g.position, g.totalTeams) }}
            >
              {g.position}/{g.totalTeams}
            </span>
          </div>

          <div className="v3-topbar-stat">
            <span className="v3-topbar-stat-label">J</span>
            <span className="v3-topbar-stat-value">{g.jornada}/{g.totalJornadas}</span>
          </div>

          <div className="v3-topbar-stat">
            <span className="v3-topbar-stat-label">PTS</span>
            <span
              className="v3-topbar-stat-value"
              style={{ color: 'var(--cat-finance)', fontWeight: 700 }}
            >
              {g.points}
            </span>
          </div>

          <div className="v3-topbar-stat">
            <span className="v3-topbar-stat-label">DIF</span>
            <span
              className="v3-topbar-stat-value"
              style={{ color: goalDiffColor(g.goalDiff) }}
            >
              {formatGoalDiff(g.goalDiff)}
            </span>
          </div>

          {g.windowOpen && (
            <div className="v3-topbar-stat">
              <span className="v3-topbar-window-pill">
                MERCADO
                {g.windowJornadasLeft !== undefined && ` · ${g.windowJornadasLeft}J`}
              </span>
            </div>
          )}
        </div>

        <div className="v3-topbar-spacer" />

        {/* Cash */}
        <div className="v3-topbar-stat is-essential">
          <span className="v3-topbar-stat-label">CASH</span>
          <span
            className="v3-topbar-stat-value"
            style={{ color: cashColor(g.cash) }}
          >
            {formatEuros(g.cash)}
          </span>
        </div>

        {/* Florentinómetro (promanager only) */}
        {g.gameMode === 'promanager' && (
          <div className="v3-topbar-florentino">
            <div className="v3-topbar-florentino-bar">
              <div
                className="v3-topbar-florentino-fill"
                style={{
                  width: `${(g.florentinometro / 10) * 100}%`,
                  background: florentinoColor(g.florentinometro),
                }}
              />
            </div>
            <span style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 'var(--fs-xs)',
              color: florentinoColor(g.florentinometro),
            }}>
              {g.florentinometro.toFixed(1)}
            </span>
            <span style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 'var(--fs-xs)',
              color: 'var(--text-dim)',
            }}>
              · {g.managerName}
            </span>
          </div>
        )}
      </div>

      {/* Row 2: nav tabs */}
      <div
        ref={navRowRef}
        className="v3-topbar-nav-row"
        role="tablist"
        aria-label="Navegación principal"
      >
        {TABS.map(tab => {
          const isActive = current === tab.id;
          return (
            <button
              key={tab.id}
              ref={isActive ? activeTabRef : undefined}
              role="tab"
              aria-selected={isActive}
              className={`v3-topbar-tab${isActive ? ' v3-topbar-tab-active' : ''}`}
              onClick={() => onNavigate(tab.id)}
            >
              <div
                className="v3-topbar-tab-accent"
                style={{ background: tab.accent }}
              />
              <div className="v3-topbar-tab-inner">
                <TabIcon src={tab.icon} active={isActive} />
                {tab.label}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
