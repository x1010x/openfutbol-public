import './styles/v3/index.css';
import { useState } from 'react';
import { Shell } from './components/v3/Shell';
import { MenuScreen } from './components/v3/MenuScreen';
import { ScreenStub } from './components/v3/ScreenStub';

export type V3Screen =
  | 'menu' | 'liga' | 'plantilla' | 'alineacion'
  | 'resultados' | 'finanzas' | 'mercado' | 'club' | 'opciones';

const STUB_TITLES: Record<Exclude<V3Screen, 'menu'>, string> = {
  liga: 'Liga',
  plantilla: 'Plantilla',
  alineacion: 'Alineación',
  resultados: 'Resultados',
  finanzas: 'Finanzas',
  mercado: 'Mercado',
  club: 'Club',
  opciones: 'Opciones',
};

export default function AppV3() {
  const [screen, setScreen] = useState<V3Screen>('menu');

  return (
    <Shell screen={screen} onNavigate={setScreen}>
      {screen === 'menu'
        ? <MenuScreen onNavigate={setScreen} />
        : <ScreenStub title={STUB_TITLES[screen]} />}
    </Shell>
  );
}
