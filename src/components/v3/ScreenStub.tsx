interface ScreenStubProps {
  title: string;
}

export function ScreenStub({ title }: ScreenStubProps) {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
    }}>
      <div style={{
        padding: 'var(--space-8)',
        background: 'var(--panel)',
        borderStyle: 'solid',
        borderWidth: '1px',
        borderColor: 'var(--border-light) var(--border-dark) var(--border-dark) var(--border-light)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-2)',
      }}>
        <span style={{
          fontFamily: 'var(--font-pixel)',
          fontSize: 'var(--fs-xl)',
          color: 'var(--text)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>
          {title}
        </span>
        <span style={{
          fontFamily: 'var(--font-pixel)',
          fontSize: 'var(--fs-xs)',
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}>
          En construcción
        </span>
      </div>
    </div>
  );
}
