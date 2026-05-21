import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { writeFileSync } from 'fs'
import { resolve } from 'path'

const buildTimestamp = (() => {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
})();

// Write version file so the running app can poll for updates
writeFileSync(resolve('./public/version.json'), JSON.stringify({ ts: buildTimestamp }));

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(buildTimestamp),
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
})
