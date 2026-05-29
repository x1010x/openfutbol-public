import { countryName, flagPath } from '../data/countries';
import { useT } from '../i18n';

interface Props {
  code: string;
  size?: 'sm' | 'lg';
}

export const CountryBadge = ({ code, size = 'lg' }: Props) => {
  const t = useT();
  if (code === 'editor') {
    return <span className="text-vga-magenta font-bold">{size === 'sm' ? '★' : t('setup.myTeams')}</span>;
  }

  const name = countryName(code);
  const src = flagPath(code);

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
