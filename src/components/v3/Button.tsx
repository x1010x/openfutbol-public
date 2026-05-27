interface ButtonProps {
  label: string;
  onClick: () => void;
  accentColor?: string;
  disabled?: boolean;
}

export function Button({ label, onClick, accentColor, disabled = false }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        padding: 'var(--space-3) var(--space-4)',
        background: accentColor ?? 'var(--button-bg)',
        color: 'var(--text)',
        font: 'inherit',
        fontSize: 'var(--fs-base)',
        border: 'var(--border-width) solid',
        borderColor: 'var(--border-light) var(--border-dark) var(--border-dark) var(--border-light)',
        borderRadius: 'var(--radius)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        textAlign: 'left',
        letterSpacing: '0.02em',
        outline: 'none',
      }}
      onMouseEnter={e => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = accentColor ?? 'var(--button-hover)';
      }}
      onMouseLeave={e => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = accentColor ?? 'var(--button-bg)';
      }}
      onMouseDown={e => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = 'var(--button-active)';
      }}
      onMouseUp={e => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = accentColor ?? 'var(--button-hover)';
      }}
      onFocus={e => {
        e.currentTarget.style.outline = 'var(--border-width) solid var(--focus-ring)';
        e.currentTarget.style.outlineOffset = '2px';
      }}
      onBlur={e => {
        e.currentTarget.style.outline = 'none';
      }}
    >
      {label}
    </button>
  );
}
