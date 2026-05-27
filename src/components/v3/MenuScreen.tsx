import '../../styles/v3/menu.css';
import { Button } from './Button';

const MENU_ITEMS = [
  { label: 'Jugar',          action: () => console.log('start standard'), accent: 'var(--cat-league)'  },
  { label: 'Pro-Manager',    action: () => console.log('start career'),   accent: 'var(--cat-squad)'   },
  { label: 'Play Fantasy',   action: () => console.log('start fantasy'),  accent: 'var(--cat-finance)' },
  { label: 'Cargar Partida', action: () => console.log('load game'),      accent: 'var(--border-light)'},
  { label: 'Seguimiento',    action: () => console.log('database'),       accent: 'var(--cat-league)'  },
  { label: 'Opciones',       action: () => console.log('settings'),       accent: 'var(--text-dim)'    },
];

export function MenuScreen() {
  return (
    <div className="v3-menu-shell">
      {/* Outer raised-bevel panel */}
      <div className="v3-menu-panel">

        {/* Left: branding — sunken panel */}
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

        {/* Right: menu items */}
        <div className="v3-menu-items">
          {MENU_ITEMS.map(item => (
            <Button
              key={item.label}
              label={item.label}
              onClick={item.action}
              accentColor={item.accent}
            />
          ))}
        </div>

      </div>
    </div>
  );
}
