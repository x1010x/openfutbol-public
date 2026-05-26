import { createRoot } from 'react-dom/client'
import './index.css'
import { Root } from './Root.tsx'

// StrictMode removed: double-mount breaks WebGL context lifecycle (Pixi app.init vs destroy race).
createRoot(document.getElementById('root')!).render(<Root />)
