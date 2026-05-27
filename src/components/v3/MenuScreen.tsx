import { Button } from './Button';

const MENU_ITEMS = [
  { label: 'Jugar',         action: () => console.log('start standard') },
  { label: 'Pro-Manager',   action: () => console.log('start career') },
  { label: 'Play Fantasy',  action: () => console.log('start fantasy') },
  { label: 'Cargar Partida',action: () => console.log('load game') },
  { label: 'Seguimiento',   action: () => console.log('database') },
  { label: 'Opciones',      action: () => console.log('settings') },
];

export function MenuScreen() {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '360px',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <div
            style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 'var(--fs-2xl)',
              fontWeight: 700,
              color: 'var(--text)',
            }}
          >
            OPENFÚTBOL
          </div>
          <div
            style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 'var(--fs-xs)',
              color: 'var(--text-muted)',
              marginTop: 'var(--space-1)',
            }}
          >
            v1.5.0 — UI Refresh
          </div>
        </div>

        {MENU_ITEMS.map(item => (
          <Button key={item.label} label={item.label} onClick={item.action} />
        ))}
      </div>
    </div>
  );
}
