import { useState } from 'react';

interface TeamCrestProps {
  colors: { primary: string; secondary: string };
  logoUrl?: string;
  size?: 'sm' | 'md';
  title?: string;
}

const SIZES = {
  sm: { width: 16, height: 20 },
  md: { width: 20, height: 24 },
};

export function TeamCrest({ colors, logoUrl, size = 'md', title }: TeamCrestProps) {
  const { width, height } = SIZES[size];
  const [logoFailed, setLogoFailed] = useState(false);

  const containerStyle: React.CSSProperties = {
    width,
    height,
    flexShrink: 0,
    border: '1px solid var(--border-dark)',
    boxShadow: 'inset 1px 1px 0 var(--border-light)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  };

  if (logoUrl && !logoFailed) {
    return (
      <div style={{ ...containerStyle, flexDirection: 'row' }} title={title}>
        <img
          src={logoUrl}
          alt={title ?? ''}
          onError={() => setLogoFailed(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            imageRendering: 'pixelated',
            display: 'block',
          }}
        />
      </div>
    );
  }

  return (
    <div style={containerStyle} title={title}>
      <div style={{ flex: '0 0 60%', background: colors.primary }} />
      <div style={{ flex: '0 0 40%', background: colors.secondary }} />
    </div>
  );
}
