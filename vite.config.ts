import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: loadEnv(mode, process.cwd(), '').VITE_BASE_PATH || '/obras/',
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
}));
