import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the build also works from the Capacitor webview.
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts'],
      reporter: ['text'],
      thresholds: { lines: 85 },
    },
  },
});
