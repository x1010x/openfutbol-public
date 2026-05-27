import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import AppV3 from './AppV3.tsx'

const params = new URLSearchParams(window.location.search);
const useV3 = params.get('v3') === '1';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {useV3 ? <AppV3 /> : <App />}
  </StrictMode>,
)
