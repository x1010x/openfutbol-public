interface Props {
  hasNewVersion?: boolean;
  onOpenChangelog: () => void;
  onOpenSettings: () => void;
}

export const AppHeader = ({ hasNewVersion, onOpenChangelog, onOpenSettings }: Props) => {
  const now = new Date();
  const date = now.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  const time = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

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
            v1.9.0 · {__BUILD_TIMESTAMP__}
            {hasNewVersion && <span className="of-home-version-new">NUEVO</span>}
          </div>
        </div>
      </button>
      <div className="of-home-corner of-home-corner-right">
        <div className="of-home-chip" title="Hoy">
          <svg viewBox="0 0 64 64" className="of-home-chip-ico" aria-hidden="true"><rect x="10" y="14" width="44" height="40" fill="none" stroke="currentColor" strokeWidth="3"/><path d="M10 22 H54" stroke="currentColor" strokeWidth="3"/><path d="M20 10 V20 M44 10 V20" stroke="currentColor" strokeWidth="3"/></svg>
          <span>{date}</span>
        </div>
        <div className="of-home-chip" title="Hora">
          <svg viewBox="0 0 64 64" className="of-home-chip-ico" aria-hidden="true"><circle cx="32" cy="32" r="24" fill="none" stroke="currentColor" strokeWidth="3"/><path d="M32 18 V32 L42 38" stroke="currentColor" strokeWidth="3" fill="none"/></svg>
          <span>{time}</span>
        </div>
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
