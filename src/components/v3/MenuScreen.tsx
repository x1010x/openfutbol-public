import '../../styles/v3/menu.css';
import type { V3Screen } from '../../AppV3';
import { Button } from './Button';

interface MenuScreenProps {
  onNavigate: (screen: V3Screen) => void;
}

export function MenuScreen({ onNavigate }: MenuScreenProps) {
  const MENU_ITEMS = [
    { label: 'Jugar',          action: () => onNavigate('liga'),     accent: 'var(--cat-league)',   icon: '/assets/icons/v3/jugar.svg'      },
    { label: 'Pro-Manager',    action: () => onNavigate('liga'),     accent: 'var(--cat-squad)',    icon: '/assets/icons/v3/promanager.svg' },
    { label: 'Play Fantasy',   action: () => onNavigate('liga'),     accent: 'var(--cat-finance)',  icon: '/assets/icons/v3/fantasy.svg'    },
    { label: 'Cargar Partida', action: () => onNavigate('liga'),     accent: 'var(--border-light)', icon: '/assets/icons/v3/cargar.svg'     },
    { label: 'Seguimiento',    action: () => onNavigate('liga'),     accent: 'var(--cat-league)',   icon: '/assets/icons/v3/seguimiento.svg'},
    { label: 'Opciones',       action: () => onNavigate('opciones'), accent: 'var(--text-dim)',     icon: '/assets/icons/v3/opciones.svg'   },
  ];

  return (
    <div className="v3-menu-shell">
      <div className="v3-menu-panel">

        <div className="v3-menu-brand">
          <div
            className="v3-menu-brand-title"
            style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}
          >
            <span style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 'var(--fs-xl)',
              fontWeight: 700,
              color: 'var(--text-dim)',
              letterSpacing: '0.02em',
            }}>
              OPEN
            </span>
            <span style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 'var(--fs-xl)',
              fontWeight: 700,
              color: 'var(--text)',
              letterSpacing: '0.02em',
            }}>
              FÚTBOL
            </span>
          </div>

          <div
            className="v3-menu-brand-meta"
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}
          >
            <span style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 'var(--fs-xs)',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              Fútbol de gestión
            </span>
            <span style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 'var(--fs-xs)',
              color: 'var(--text-dim)',
            }}>
              v1.5.0 — UI Refresh
            </span>
          </div>
        </div>

        <div className="v3-menu-items">
          {MENU_ITEMS.map(item => (
            <Button
              key={item.label}
              label={item.label}
              onClick={item.action}
              accentColor={item.accent}
              icon={item.icon}
            />
          ))}
        </div>

      </div>
    </div>
  );
}
