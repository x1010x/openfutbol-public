import type { Player } from '../types/game.d.ts';

interface Props {
  stats: Player['stats'];
  size?: number;
}

const LABELS: { key: keyof Player['stats']; label: string }[] = [
  { key: 'speed', label: 'VEL' },
  { key: 'dribbling', label: 'REG' },
  { key: 'passing', label: 'PAS' },
  { key: 'shooting', label: 'TIR' },
  { key: 'defending', label: 'DEF' },
  { key: 'physical', label: 'FIS' },
  { key: 'goalkeeping', label: 'POR' },
];

export const StatRadar = ({ stats, size = 140 }: Props) => {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 18;
  const n = LABELS.length;

  // angles start at top, go clockwise
  const angleFor = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;

  const pointAt = (i: number, value: number) => {
    const r = (value / 100) * radius;
    const a = angleFor(i);
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };

  const labelAt = (i: number) => {
    const r = radius + 10;
    const a = angleFor(i);
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };

  const ring = (frac: number) =>
    LABELS.map((_, i) => {
      const a = angleFor(i);
      const r = radius * frac;
      return `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`;
    }).join(' ');

  const dataPoints = LABELS.map((l, i) => pointAt(i, stats[l.key]).join(',')).join(' ');

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      style={{ imageRendering: 'pixelated' }}
    >
      {[0.25, 0.5, 0.75, 1].map(f => (
        <polygon
          key={f}
          points={ring(f)}
          fill="none"
          stroke="var(--color-vga-gray)"
          strokeWidth={1}
        />
      ))}
      {LABELS.map((_, i) => {
        const [x, y] = pointAt(i, 100);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="var(--color-vga-gray)"
            strokeWidth={1}
          />
        );
      })}
      <polygon
        points={dataPoints}
        fill="var(--color-vga-yellow)"
        fillOpacity={0.35}
        stroke="var(--color-vga-yellow)"
        strokeWidth={2}
      />
      {LABELS.map((l, i) => {
        const [x, y] = labelAt(i);
        return (
          <text
            key={l.key}
            x={x}
            y={y}
            fill="var(--color-vga-cyan)"
            fontSize={7}
            fontFamily="Press Start 2P, system-ui"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {l.label}
          </text>
        );
      })}
    </svg>
  );
};
