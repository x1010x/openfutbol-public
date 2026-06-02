import { useEffect, useState } from 'react'
import App from './App.tsx'
import { Sandbox } from './sandbox/Sandbox'

// Top-level route switch: the engine sandbox lives at #sandbox, everything else
// is the manager app. Kept in its own file so main.tsx stays a pure entry point.
export function Root() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash === '#sandbox' ? <Sandbox /> : <App />;
}
