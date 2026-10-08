import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    // One in-memory MongoDB per test file; files run in separate workers.
    hookTimeout: 120_000,
    testTimeout: 20_000,
  },
});
