import { DISCLAIMER_TEXT, DISCLAIMER_RIGHTS_NOTICE, DISCLAIMER_ACCEPT_BUTTON } from '../data/disclaimer';

interface Props {
  onDismiss: () => void;
}

export const DisclaimerView = ({ onDismiss }: Props) => {
  return (
    <div
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
    >
      <div className="w-full max-w-lg border-4 border-vga-white vga-panel bg-vga-black flex flex-col">
        <div className="bg-vga-blue border-b-2 border-vga-white px-3 py-2 flex justify-between items-center shrink-0">
          <span className="text-vga-yellow text-[10px] font-bold tracking-widest">OPENFUTBOL</span>
          <span className="text-vga-white text-[7px]">DISCLAIMER</span>
        </div>

        <div className="p-6 flex flex-col gap-6">
          <div className="border border-vga-gray/40 p-4 text-[9px] text-vga-gray leading-relaxed text-center">
            {DISCLAIMER_TEXT}
            <div className="mt-4 text-vga-light-red font-bold">
              {DISCLAIMER_RIGHTS_NOTICE}
            </div>
          </div>
          
          <button
            onClick={onDismiss}
            className="w-full bg-vga-green hover:bg-vga-light-green text-vga-bright-white py-3 text-[10px] font-bold uppercase border-b-4 border-r-4 border-vga-black active:border-0"
          >
            {DISCLAIMER_ACCEPT_BUTTON}
          </button>
        </div>
      </div>
    </div>
  );
};
