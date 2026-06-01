import type { ReactNode } from 'react';

interface Props {
  title: string;
  onBack?: () => void;
  backLabel?: string;
  /** Right-aligned extra actions (buttons, status pills, etc.) */
  actions?: ReactNode;
  /** Subtitle / breadcrumb shown under title */
  subtitle?: string;
}

export const ScreenHeader = ({ title, onBack, backLabel = 'VOLVER', actions, subtitle }: Props) => {
  return (
    <div className="of-screenbar">
      <div className="of-screenbar-left">
        <div className="of-screenbar-titles">
          <h2 className="of-screenbar-title">{title}</h2>
          {subtitle && <div className="of-screenbar-sub">{subtitle}</div>}
        </div>
      </div>
      <div className="of-screenbar-right">
        {actions}
        {onBack && (
          <button onClick={onBack} className="of-screenbar-back">{backLabel}</button>
        )}
      </div>
    </div>
  );
};
