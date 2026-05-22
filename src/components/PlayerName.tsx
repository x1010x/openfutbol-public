import type { Player } from '../types/game.d.ts';
import { usePlayerTooltip } from '../contexts/PlayerTooltipContext';

interface Props {
  player: { name: string; fullName: string } | Player;
  className?: string;
  useShirt?: boolean;
}

function isFullPlayer(p: Props['player']): p is Player {
  return 'stats' in p && 'id' in p;
}

export const PlayerName = ({ player, className = '', useShirt = false }: Props) => {
  const { show, hide } = usePlayerTooltip();
  const full = isFullPlayer(player);
  return (
    <span
      className={className}
      onMouseMove={full ? e => show(player, e.clientX, e.clientY) : undefined}
      onMouseLeave={full ? hide : undefined}
      onClick={full ? hide : undefined}
    >
      {useShirt ? player.name : player.fullName}
    </span>
  );
};
