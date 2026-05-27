import { useState } from 'react';

interface ButtonProps {
  label: string;
  onClick: () => void;
  accentColor?: string;
  disabled?: boolean;
}

export function Button({ label, onClick, accentColor, disabled = false }: ButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => !disabled && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        width: '100%',
        padding: 0,
        background: 'none',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        outline: focused ? `var(--border-width) solid var(--focus-ring)` : 'none',
        outlineOffset: '2px',
      }}
    >
      {/* Left category accent bar */}
      <div style={{
        width: 'var(--space-1)',
        background: accentColor ?? 'var(--border-light)',
        flexShrink: 0,
      }} />

      {/* Row content with beveled border */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: `var(--space-2) var(--space-3)`,
        background: pressed
          ? 'var(--button-active)'
          : hovered
          ? 'var(--button-hover)'
          : 'var(--button-bg)',
        borderStyle: 'solid',
        borderWidth: '1px',
        borderColor: pressed
          ? 'var(--border-dark) var(--border-light) var(--border-light) var(--border-dark)'
          : 'var(--border-light) var(--border-dark) var(--border-dark) var(--border-light)',
      }}>
        {/* > arrow — space always reserved to prevent layout shift */}
        <span style={{
          width: 'var(--space-3)',
          flexShrink: 0,
          fontFamily: 'var(--font-pixel)',
          fontSize: 'var(--fs-xs)',
          color: 'var(--text-muted)',
          textAlign: 'center',
          visibility: hovered && !pressed ? 'visible' : 'hidden',
        }}>
          &gt;
        </span>

        <span style={{
          flex: 1,
          fontFamily: 'var(--font-pixel)',
          fontSize: 'var(--fs-sm)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: hovered ? 'var(--text)' : 'var(--text-muted)',
          textAlign: 'left',
        }}>
          {label}
        </span>
      </div>
    </button>
  );
}
