import { useEffect, useMemo, useRef, useState } from 'react';

export interface GameSelectOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  options: GameSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  /**
   * Display label override when no option matches `value` (e.g. "— libre —").
   * If omitted, falls back to placeholder or "—".
   */
  emptyLabel?: string;
  /** Show a search box when there are this many or more options (default 10). */
  searchThreshold?: number;
  className?: string;
}

// Drop-in replacement for native <select> with a retro-styled clickable
// panel: search box, scrollable list, click-to-select. Designed to feel like
// the rest of the game so it doesn't yank the user out into the browser's
// system picker.
export const GameSelect = ({
  value, options, onChange, placeholder, emptyLabel,
  searchThreshold = 10, className = '',
}: Props) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click or Esc.
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  // Reset search when reopening so previous filter doesn't linger.
  useEffect(() => { if (!open) setQ(''); }, [open]);

  const selected = options.find(o => o.value === value);
  const display = selected?.label ?? emptyLabel ?? placeholder ?? '—';

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return options;
    return options.filter(o => o.label.toLowerCase().includes(term));
  }, [options, q]);

  const showSearch = options.length >= searchThreshold;

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full bg-vga-black border border-vga-blue text-vga-bright-white text-[10px] px-2 py-1 outline-none focus:border-vga-yellow font-mono flex items-center justify-between gap-2 hover:border-vga-yellow"
      >
        <span className={`truncate text-left ${selected ? '' : 'text-vga-gray'}`}>{display}</span>
        <span className="text-vga-cyan text-[10px] shrink-0">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="absolute z-40 mt-1 left-0 right-0 border-2 border-vga-yellow bg-vga-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.8)] flex flex-col max-h-[60vh]">
          {showSearch && (
            <input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Buscar..."
              className="w-full bg-vga-black border-b border-vga-blue text-vga-bright-white text-[9px] px-2 py-1 outline-none font-mono"
            />
          )}
          <div className="overflow-y-auto flex-1 min-h-0">
            {filtered.length === 0 ? (
              <div className="text-vga-gray text-[9px] uppercase px-2 py-2 italic">Sin resultados</div>
            ) : (
              filtered.map(o => {
                const isSel = o.value === value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => { onChange(o.value); setOpen(false); }}
                    className={`w-full text-left px-2 py-1 text-[10px] font-mono border-b border-vga-blue/40 hover:bg-vga-blue/30 truncate ${isSel ? 'bg-vga-yellow text-vga-black font-bold' : 'text-vga-bright-white'}`}
                  >
                    {isSel ? '▶ ' : '  '}{o.label}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
