import { createRoot } from 'react-dom/client'
import './index.css'
import { Root } from './Root.tsx'
import { PackProvider } from './state/PackContext.tsx'
import { StatsPackProvider } from './state/StatsPackContext.tsx'

// StrictMode removed: double-mount breaks WebGL context lifecycle (Pixi app.init vs destroy race).
// Pack providers wrap Root so both the manager (App) and the engine sandbox get them.
createRoot(document.getElementById('root')!).render(
  <StatsPackProvider>
    <PackProvider>
      <Root />
    </PackProvider>
  </StatsPackProvider>
)
