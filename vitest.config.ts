import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Chromium rendering is slow by nature; the rest of the suite must not
    // inherit an indulgent timeout that would mask a regression.
    testTimeout: 60_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text-summary'],
    },
  },
});
