import type { Player } from '../types/game.d.ts';
import { usePlayerTooltip } from '../contexts/PlayerTooltipContext';

interface Props {
  player: Player;
  className?: string;
  useShirt?: boolean;
}

export const PlayerName = ({ player, className = '', useShirt = false }: Props) => {
  const { show, hide } = usePlayerTooltip();
  return (
    <span
      className={className}
      onMouseMove={e => show(player, e.clientX, e.clientY)}
      onMouseLeave={hide}
    >
      {useShirt ? player.name : player.fullName}
    </span>
  );
};
