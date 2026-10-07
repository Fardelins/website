import { defineConfig } from 'vitest/config';

// jsdom specs are CPU-heavy: one worker per core starves them past their timeouts on a busy run.
export default defineConfig({
  test: {
    maxWorkers: 6,
  },
});
