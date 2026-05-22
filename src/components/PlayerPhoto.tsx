import { useState, useEffect } from 'react';
import { extractDbId } from '../data/mockTeams';

interface Props {
  playerId: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE: Record<NonNullable<Props['size']>, string> = {
  xs: 'w-4 h-4',
  sm: 'w-6 h-6',
  md: 'w-9 h-9',
  lg: 'w-16 h-16',
};

type Attempt = 'png' | 'jpeg' | 'unknown';

export const PlayerPhoto = ({ playerId, size = 'sm', className = '' }: Props) => {
  const dbId = extractDbId(playerId);
  const [attempt, setAttempt] = useState<Attempt>('png');

  useEffect(() => { setAttempt('png'); }, [dbId]);

  const src =
    attempt === 'png' ? `/assets/players/${dbId}.png`
    : attempt === 'jpeg' ? `/assets/players/${dbId}.jpeg`
    : '/assets/players/unknown.jpeg';

  const handleError = () => {
    if (attempt === 'png') setAttempt('jpeg');
    else setAttempt('unknown');
  };

  return (
    <img
      src={src}
      onError={handleError}
      alt=""
      className={`${SIZE[size]} shrink-0 object-cover ${className}`}
    />
  );
};
