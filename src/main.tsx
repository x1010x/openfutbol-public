import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { PackProvider } from './state/PackContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PackProvider>
      <App />
    </PackProvider>
  </StrictMode>,
)
