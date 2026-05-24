import type { LeagueState } from '../store/leagueStore';
import { encodeBackup, decodeBackup } from '../utils/backupUtils';
import { useT } from '../i18n';

interface Props {
  league: LeagueState;
  onRestore: (newState: LeagueState) => void;
  onReset: () => void;
  onBack: () => void;
}

export const BackupView = ({ league, onRestore, onReset, onBack }: Props) => {
  const t = useT();

  const handleReset = () => {
    if (confirm(t('misc.confirmReset'))) {
      onReset();
    }
  };

  const handleExport = () => {
    try {
      const data = JSON.stringify(league);
      const encoded = encodeBackup(data);
      const blob = new Blob([encoded], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `openfutbol_${league.year}_j${league.currentJornada}.ofb`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(t('misc.backupError'));
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const decoded = decodeBackup(content);
        const parsed = JSON.parse(decoded);

        if (parsed.teams && parsed.stats && parsed.year !== undefined && Array.isArray(parsed.teams)) {
          if (confirm(t('misc.confirmImport'))) {
            onRestore(parsed);
            alert(t('misc.backupRestored'));
          }
        } else {
          alert(t('misc.backupInvalid'));
        }
      } catch (err) {
        alert(t('misc.backupReadError'));
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="w-full max-w-2xl flex flex-col gap-4 animate-in fade-in duration-300">
      <div className="bg-vga-blue p-2 border-2 border-vga-white flex justify-between items-center vga-panel">
        <h2 className="text-vga-yellow text-xs uppercase font-bold">{t('section.backup')}</h2>
        <button onClick={onBack} className="bg-vga-red text-vga-bright-white px-3 py-1 text-[8px] border border-vga-black hover:bg-vga-light-red">
          {t('btn.back')}
        </button>
      </div>

      <div className="bg-vga-gray border-4 border-vga-blue p-6 flex flex-col gap-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex flex-col gap-2">
          <h3 className="text-vga-blue text-[10px] font-bold border-b border-vga-blue pb-1 uppercase">{t('section.exportGame')}</h3>
          <p className="text-vga-black text-[8px] leading-relaxed">{t('backup.exportDesc')}</p>
          <button
            onClick={handleExport}
            className="bg-vga-green hover:bg-vga-light-green text-vga-bright-white py-2 px-4 border-b-4 border-r-4 border-vga-black active:border-0 text-[10px] font-bold mt-2 uppercase tracking-wider"
          >
            {t('btn.downloadBackup')}
          </button>
        </div>

        <div className="flex flex-col gap-2 border-t-2 border-vga-blue pt-4">
          <h3 className="text-vga-blue text-[10px] font-bold border-b border-vga-blue pb-1 uppercase">{t('section.importGame')}</h3>
          <p className="text-vga-black text-[8px] leading-relaxed">
            {t('backup.importDesc')}<br/>
            <span className="text-vga-red font-bold uppercase underline">{t('backup.importWarn')}</span>
          </p>
          <label className="cursor-pointer bg-vga-blue hover:bg-vga-light-blue text-vga-bright-white py-2 px-4 border-b-4 border-r-4 border-vga-black active:border-0 text-[10px] font-bold text-center mt-2 uppercase tracking-wider block">
            {t('btn.uploadBackup')}
            <input type="file" accept=".ofb" onChange={handleImport} className="hidden" />
          </label>
        </div>

        <div className="flex flex-col gap-2 border-t-2 border-vga-red pt-4">
          <h3 className="text-vga-red text-[10px] font-bold border-b border-vga-red pb-1 uppercase">{t('section.resetGame')}</h3>
          <p className="text-vga-black text-[8px] leading-relaxed">
            {t('backup.resetDesc')}<br/>
            <span className="text-vga-red font-bold uppercase underline">{t('backup.resetWarn')}</span>
          </p>
          <button
            onClick={handleReset}
            className="bg-vga-red hover:bg-vga-light-red text-vga-bright-white py-2 px-4 border-b-4 border-r-4 border-vga-black active:border-0 text-[10px] font-bold mt-2 uppercase tracking-wider"
          >
            {t('btn.resetLeague')}
          </button>
        </div>
      </div>
    </div>
  );
};
