import { useT } from '../i18n';

interface Props {
  title: string;
  body: string;
  tone: 'warning' | 'danger' | 'success';
  onClose: () => void;
}

const COLORS = {
  danger:  { border: '#ff5555', bg: '#550000', glow: 'rgba(255,85,85,0.4)',  text: '#ff5555', btnBg: '#550000' },
  warning: { border: '#ffff55', bg: '#111144', glow: 'rgba(255,255,85,0.3)', text: '#ffff55', btnBg: '#001155' },
  success: { border: '#55ff55', bg: '#003300', glow: 'rgba(85,255,85,0.4)',  text: '#55ff55', btnBg: '#004400' },
};

export const BoardAlertModal = ({ title, body, tone, onClose }: Props) => {
  const t = useT();
  const c = COLORS[tone];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.92)' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm flex flex-col"
        style={{
          border: `4px solid ${c.border}`,
          boxShadow: `8px 8px 0 #000, 0 0 32px ${c.glow}`,
          background: '#000020',
        }}
      >
        {/* Title bar */}
        <div
          className="flex items-center justify-center gap-2 px-3 py-2 border-b-2"
          style={{ borderColor: c.border, background: c.bg }}
        >
          <span className="text-[8px] font-bold uppercase tracking-widest" style={{ color: c.border }}>
            📞 {t('florentino.boardMsg')}
          </span>
        </div>

        {/* Body: image + message */}
        <div className="flex gap-0">
          {/* Florentino image */}
          <div
            className="shrink-0 flex items-end justify-center"
            style={{ background: '#000010', borderRight: `2px solid ${c.border}44` }}
          >
            <img
              src="/assets/misc/florenmsg.png"
              alt="Florentino"
              style={{ width: 100, imageRendering: 'pixelated', display: 'block' }}
            />
          </div>

          {/* Message */}
          <div className="flex flex-col gap-3 p-4 flex-1">
            <div
              className="text-[9px] font-bold uppercase tracking-wide"
              style={{ color: c.text }}
            >
              {title}
            </div>
            <div
              className="text-[10px] leading-relaxed"
              style={{
                color: '#ffffff',
                fontFamily: 'monospace',
                borderLeft: `2px solid ${c.border}`,
                paddingLeft: 8,
              }}
            >
              {body}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="p-2 border-t-2"
          style={{ borderColor: c.border, background: '#000010' }}
        >
          <button
            onClick={onClose}
            className="w-full py-2 text-[10px] font-bold uppercase tracking-widest border-2 transition-colors"
            style={{ background: c.btnBg, color: c.text, borderColor: c.border }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = c.border;
              (e.currentTarget as HTMLButtonElement).style.color = '#000000';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = c.btnBg;
              (e.currentTarget as HTMLButtonElement).style.color = c.text;
            }}
          >
            {t('florentino.understood')}
          </button>
        </div>
      </div>
    </div>
  );
};
