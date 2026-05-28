import { useState, useEffect } from 'react';

interface Props {
  sourceId?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE: Record<NonNullable<Props['size']>, string> = {
  xs: 'w-4 h-4',
  sm: 'w-6 h-6',
  md: 'w-9 h-9',
  lg: 'w-16 h-16',
};

// TODO swap to self-hosted CDN once available.
const PHOTO_BASE = 'https://open-football.org/player';

export const PlayerPhoto = ({ sourceId, size = 'sm', className = '' }: Props) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => { setFailed(false); }, [sourceId]);

  const base = import.meta.env.BASE_URL;
  const fallback = `${base}assets/players/unknown.jpeg`;
  const src = !sourceId || failed ? fallback : `${PHOTO_BASE}/${sourceId}.png`;

  return (
    <img
      src={src}
      onError={() => setFailed(true)}
      alt=""
      className={`${SIZE[size]} shrink-0 object-cover ${className}`}
    />
  );
};
