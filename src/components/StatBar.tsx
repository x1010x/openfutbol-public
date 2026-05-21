interface Props {
  label: string;
  value: number;
  segments?: number;
  size?: 'sm' | 'md';
}

const barColor = (v: number) => {
  if (v >= 80) return 'bg-vga-light-green';
  if (v >= 60) return 'bg-vga-yellow';
  if (v >= 40) return 'bg-vga-brown';
  return 'bg-vga-light-red';
};

export const StatBar = ({ label, value, segments = 10, size = 'md' }: Props) => {
  const filled = Math.max(0, Math.min(segments, Math.round((value / 100) * segments)));
  const color = barColor(value);
  const text = size === 'sm' ? 'text-[7px]' : 'text-[9px]';
  const h = size === 'sm' ? 'h-1.5' : 'h-2';
  const labelW = size === 'sm' ? 'w-6' : 'w-10';
  const numW = size === 'sm' ? 'w-4' : 'w-6';

  return (
    <div className={`flex items-center gap-1 ${text}`}>
      <span className={`text-vga-cyan shrink-0 ${labelW}`}>{label}</span>
      <div className="flex gap-px flex-1 bg-vga-black vga-panel-inset p-px">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className={`${h} flex-1 ${i < filled ? color : 'bg-vga-gray'}`}
          />
        ))}
      </div>
      <span className={`text-vga-bright-white text-right shrink-0 ${numW}`}>{value}</span>
    </div>
  );
};
