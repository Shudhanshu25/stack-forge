import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  // e2e/ holds the Playwright accessibility check, not unit tests.
  // Component tests opt into jsdom per file; it runs animation frames like a visible page.
  test: {
    environment: 'node',
    environmentOptions: { jsdom: { pretendToBeVisual: true } },
    exclude: ['e2e/**', 'node_modules/**'],
  },
});
