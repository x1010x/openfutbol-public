import { useState } from 'react';
import { countryName, flagPath } from '../data/countries';
import { useT } from '../i18n';

interface Props {
  code: string;
  size?: 'sm' | 'lg';
  // When true, only the flag image is shown (text name suppressed).
  // Falls back to the country code/name only if the flag image fails to load.
  flagOnly?: boolean;
}

export const CountryBadge = ({ code, size = 'lg', flagOnly = false }: Props) => {
  const t = useT();
  const [failed, setFailed] = useState(false);

  if (code === 'editor') {
    return <span className="text-vga-magenta font-bold">{size === 'sm' ? '★' : t('setup.myTeams')}</span>;
  }

  const name = countryName(code);
  const src = flagPath(code);

  if (flagOnly) {
    if (failed) {
      return <span className="text-vga-gray font-mono">{size === 'sm' ? code.toUpperCase() : name.toUpperCase()}</span>;
    }
    const imgCls = size === 'sm'
      ? 'h-3 w-4 object-cover border border-vga-gray'
      : 'h-4 w-6 object-cover border border-vga-gray';
    return <img src={src} alt={size === 'sm' ? code : name} onError={() => setFailed(true)} className={imgCls} />;
  }

  // Default: flag + name side by side, with the image hidden on error so only the text remains.
  const handleErr = (e: React.SyntheticEvent<HTMLImageElement>) => {
    (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
  };

  if (size === 'sm') {
    return (
      <span className="inline-flex items-center gap-1">
        <img src={src} alt={code} onError={handleErr} className="h-3 w-4 object-cover border border-vga-gray" />
        <span>{code.toUpperCase()}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <img src={src} alt={name} onError={handleErr} className="h-4 w-6 object-cover border border-vga-gray" />
      <span>{name.toUpperCase()}</span>
    </span>
  );
};
