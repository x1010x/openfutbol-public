import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { PackProvider } from './state/PackContext.tsx'
import { StatsPackProvider } from './state/StatsPackContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StatsPackProvider>
      <PackProvider>
        <App />
      </PackProvider>
    </StatsPackProvider>
  </StrictMode>,
)
