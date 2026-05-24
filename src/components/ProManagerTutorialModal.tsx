import { useT } from '../i18n';

interface Props {
  managerName: string;
  onClose: () => void;
}

const Section = ({ title, items, color }: { title: string; items: string[]; color: string }) => (
  <div className="mb-3">
    <div className={`text-[8px] font-bold uppercase mb-1 ${color}`}>{title}</div>
    <ul className="flex flex-col gap-0.5">
      {items.map((item, i) => (
        <li key={i} className="text-vga-bright-white text-[7px] flex gap-2">
          <span className={`shrink-0 ${color}`}>▸</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  </div>
);

export const ProManagerTutorialModal = ({ managerName, onClose }: Props) => {
  const t = useT();

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div className="bg-vga-black border-4 border-vga-magenta w-full max-w-lg max-h-[92vh] flex flex-col"
        style={{ boxShadow: 'inset 2px 2px 0 #ff55ff, inset -2px -2px 0 #550055, 6px 6px 0 #000000' }}>

        {/* Header */}
        <div className="bg-gradient-to-b from-vga-magenta to-[#880088] px-4 py-3 flex justify-between items-center shrink-0"
          style={{ borderBottom: '4px solid #aaaaaa' }}>
          <div>
            <div className="text-vga-bright-white text-[10px] font-bold uppercase tracking-widest">
              {t('tutorial.title')}
            </div>
            <div className="text-vga-bright-white text-[7px] opacity-80 mt-0.5">
              {t('tutorial.welcome', { name: managerName })}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-vga-bright-white text-[8px] border border-vga-bright-white px-2 py-1 hover:bg-vga-bright-white hover:text-vga-black font-bold"
          >
            {t('tutorial.start')}
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-4 text-[7px]">
          <Section
            title={t('tutorial.objective')}
            color="text-vga-yellow"
            items={[
              t('tutorial.obj1'),
              t('tutorial.obj2'),
              t('tutorial.obj3'),
            ]}
          />
          <Section
            title={t('tutorial.florentino')}
            color="text-vga-cyan"
            items={[
              t('tutorial.flo1'),
              t('tutorial.flo2'),
              t('tutorial.flo3'),
              t('tutorial.flo4'),
            ]}
          />
          <Section
            title={t('tutorial.reputation')}
            color="text-vga-light-green"
            items={[
              t('tutorial.rep1'),
              t('tutorial.rep2'),
              t('tutorial.rep3'),
            ]}
          />
          <Section
            title={t('tutorial.transfers')}
            color="text-vga-light-magenta"
            items={[
              t('tutorial.tra1'),
              t('tutorial.tra2'),
              t('tutorial.tra3'),
            ]}
          />
          <Section
            title={t('tutorial.finances')}
            color="text-vga-light-red"
            items={[
              t('tutorial.fin1'),
              t('tutorial.fin2'),
            ]}
          />
          <div className="mt-3 border-t border-vga-gray pt-3 text-vga-gray text-[6px] text-center">
            {t('tutorial.tip')}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-4 py-3 border-t border-vga-gray flex justify-end">
          <button
            onClick={onClose}
            className="bg-vga-magenta hover:bg-vga-light-red text-vga-bright-white text-[8px] px-6 py-2 border border-vga-bright-white font-bold uppercase tracking-widest"
          >
            {t('tutorial.start')}
          </button>
        </div>
      </div>
    </div>
  );
};
