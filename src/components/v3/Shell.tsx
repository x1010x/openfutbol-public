import type { V3Screen } from '../../AppV3';
import { TopBar } from './TopBar';

interface ShellProps {
  screen: V3Screen;
  onNavigate: (screen: V3Screen) => void;
  children: React.ReactNode;
}

export function Shell({ screen, onNavigate, children }: ShellProps) {
  if (screen === 'menu') {
    return <>{children}</>;
  }

  return (
    <div className="v3-shell">
      <TopBar current={screen} onNavigate={onNavigate} />
      <main className="v3-shell-main">
        {children}
      </main>
    </div>
  );
}
