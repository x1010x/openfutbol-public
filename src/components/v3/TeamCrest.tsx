interface TeamCrestProps {
  colors: { primary: string; secondary: string };
  size?: 'sm' | 'md';
  title?: string;
}

const SIZES = {
  sm: { width: 16, height: 20 },
  md: { width: 20, height: 24 },
};

export function TeamCrest({ colors, size = 'md', title }: TeamCrestProps) {
  const { width, height } = SIZES[size];
  return (
    <div
      title={title}
      style={{
        width,
        height,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid var(--border-dark)',
        boxShadow: 'inset 1px 1px 0 var(--border-light)',
        overflow: 'hidden',
      }}
    >
      <div style={{ flex: '0 0 60%', background: colors.primary }} />
      <div style={{ flex: '0 0 40%', background: colors.secondary }} />
    </div>
  );
}
