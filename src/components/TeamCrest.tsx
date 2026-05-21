import { useId } from 'react';

interface Props {
  colors?: string[];
  size?: 'xs' | 'sm' | 'md' | 'lg';
  title?: string;
}

const DEFAULT_COLORS = ['#aaaaaa', '#555555'];

const SIZE: Record<NonNullable<Props['size']>, string> = {
  xs: 'w-4 h-4',
  sm: 'w-6 h-6',
  md: 'w-9 h-9',
  lg: 'w-16 h-16',
};

// Jersey silhouette: shirt with sleeves on top, shorts at the bottom.
// Path coordinates in a 24x24 viewBox.
const JERSEY_PATH =
  'M4 4 L20 4 L20 5 L23 5 L23 11 L20 11 L20 14 L18 14 L18 21 L6 21 L6 14 L4 14 L4 11 L1 11 L1 5 L4 5 Z';

export const TeamCrest = ({ colors, size = 'sm', title }: Props) => {
  const id = useId().replace(/:/g, '');
  const c = colors && colors.length > 0 ? colors : DEFAULT_COLORS;
  const shirtL = c[0] ?? '#888';
  const shirtR = c[1] ?? c[0] ?? '#888';
  const shorts = c[2] ?? c[1] ?? c[0] ?? '#888';
  const clipId = `crest-${id}`;

  return (
    <svg
      viewBox="0 0 24 24"
      className={`${SIZE[size]} shrink-0`}
      shapeRendering="crispEdges"
      aria-label={title}
    >
      {title && <title>{title}</title>}
      <defs>
        <clipPath id={clipId}>
          <path d={JERSEY_PATH} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect x="0" y="0" width="12" height="14" fill={shirtL} />
        <rect x="12" y="0" width="12" height="14" fill={shirtR} />
        <rect x="0" y="14" width="24" height="10" fill={shorts} />
      </g>
      <path d={JERSEY_PATH} fill="none" stroke="black" strokeWidth="1" />
    </svg>
  );
};
