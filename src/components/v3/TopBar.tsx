// TODO: implemented in commit 2
import type { V3Screen } from '../../AppV3';

interface TopBarProps {
  current: V3Screen;
  onNavigate: (screen: V3Screen) => void;
}

export function TopBar({ current: _current, onNavigate: _onNavigate }: TopBarProps) {
  return <div>TopBar pending</div>;
}
