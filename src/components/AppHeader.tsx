interface Props {
  hasNewVersion?: boolean;
  onOpenChangelog: () => void;
  onOpenSettings: () => void;
  onSaveGame?: () => void;
  username?: string;
  mode?: 'CLASICO' | 'PROMANAGER' | 'TORNEO';
}

const MODE_LABEL: Record<NonNullable<Props['mode']>, string> = {
  CLASICO: 'CLÁSICO',
  PROMANAGER: 'PROMANAGER',
  TORNEO: 'TORNEO',
};

export const AppHeader = ({ hasNewVersion, onOpenChangelog, onOpenSettings, onSaveGame, username, mode }: Props) => {
  return (
    <div className="of-home-topbar">
      <button
        type="button"
        className="of-home-corner of-home-corner-left of-home-logo"
        onClick={onOpenChangelog}
        title="Ver cambios recientes"
      >
        <svg className="of-home-shield" viewBox="0 0 64 64" aria-hidden="true">
          <path d="M32 6 L54 14 L54 32 C54 46 44 56 32 60 C20 56 10 46 10 32 L10 14 Z" fill="none" stroke="currentColor" strokeWidth="3"/>
          <path d="M22 28 L42 28 M22 36 L42 36 M28 22 L36 42" stroke="currentColor" strokeWidth="2" fill="none"/>
        </svg>
        <div className="of-home-corner-text">
          <div className="of-home-corner-title">OPENFUTBOL</div>
          <div className="of-home-corner-sub">
            v1.10.0 · {__BUILD_TIMESTAMP__}
            {hasNewVersion && <span className="of-home-version-new">NUEVO</span>}
          </div>
        </div>
      </button>
      <div className="of-home-corner of-home-corner-right">
        {username && (
          <div className="of-home-chip" title="Mánager">
            <svg viewBox="0 0 24 24" className="of-home-chip-ico" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <span>{username}</span>
          </div>
        )}
        {mode && (
          <div className="of-home-chip" title="Modo de juego">
            <svg viewBox="0 0 24 24" className="of-home-chip-ico" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9"/>
              <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>
            </svg>
            <span>{MODE_LABEL[mode]}</span>
          </div>
        )}
        {onSaveGame && (
          <button className="of-home-chip of-home-chip-btn" onClick={onSaveGame} title="Guardar partida">
            <svg viewBox="0 0 24 24" className="of-home-chip-ico" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
          </button>
        )}
        <button className="of-home-chip of-home-chip-btn" onClick={onOpenSettings} title="Ajustes">
          <svg viewBox="0 0 24 24" className="of-home-chip-ico" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
      </div>
    </div>
  );
};
