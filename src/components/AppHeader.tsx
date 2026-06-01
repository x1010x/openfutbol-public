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
          <svg viewBox="0 0 64 64" className="of-home-chip-ico" aria-hidden="true"><circle cx="32" cy="32" r="8" fill="none" stroke="currentColor" strokeWidth="4"/><circle cx="32" cy="32" r="20" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3"/></svg>
        </button>
      </div>
    </div>
  );
};
