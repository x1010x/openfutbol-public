import type { ReactNode } from 'react';

type Tone = 'info' | 'success' | 'danger' | 'warning';

interface Props {
  title: string;
  subtitle?: string;
  tone?: Tone;
  buttonLabel?: string;
  onClose: () => void;
  children: ReactNode;
}

const TONE_STYLES: Record<Tone, { frame: string; titleColor: string; bodyColor: string }> = {
  info:    { frame: 'bg-vga-blue border-vga-bright-white',  titleColor: 'text-vga-yellow',      bodyColor: 'text-vga-bright-white' },
  success: { frame: 'bg-vga-green border-vga-bright-white', titleColor: 'text-vga-yellow',      bodyColor: 'text-vga-bright-white' },
  danger:  { frame: 'bg-vga-red border-vga-bright-white',   titleColor: 'text-vga-yellow',      bodyColor: 'text-vga-bright-white' },
  warning: { frame: 'bg-vga-yellow border-vga-black',       titleColor: 'text-vga-black',       bodyColor: 'text-vga-black' },
};

export const MessageModal = ({
  title,
  subtitle,
  tone = 'info',
  buttonLabel = 'CONTINUAR',
  onClose,
  children,
}: Props) => {
  const { frame, titleColor, bodyColor } = TONE_STYLES[tone];
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`max-w-md w-full border-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] ${frame}`}
      >
        <div className="bg-vga-black px-3 py-2 text-center border-b-2 border-vga-bright-white">
          <span className={`text-[10px] uppercase font-bold ${titleColor}`}>{title}</span>
          {subtitle && (
            <div className="text-vga-bright-white text-[12px] mt-1 uppercase tracking-wider">
              {subtitle}
            </div>
          )}
        </div>
        <div className={`p-4 text-[10px] leading-relaxed ${bodyColor}`}>
          {children}
        </div>
        <div className="bg-vga-black p-2 border-t-2 border-vga-bright-white">
          <button
            onClick={onClose}
            className="w-full bg-vga-blue hover:bg-vga-light-blue text-vga-bright-white py-2 text-[10px] border-2 border-vga-bright-white"
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
