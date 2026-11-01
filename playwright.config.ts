import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// WIX_API_KEY and WIX_ACCOUNT_ID come from .env (never committed).
dotenv.config({ quiet: true });

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  projects: [
    {
      name: 'api',
      testMatch: 'api/**/*.spec.ts',
      // The assignment allows only a few hundred API calls; a retry would spend calls and hide flakiness.
      retries: 0,
      // A trace would store request headers, which include the API key.
      use: { trace: 'off' },
    },
    {
      name: 'ui',
      testMatch: ['ui/**/*.spec.ts', 'cross-door/**/*.spec.ts'],
      // Live production marketing pages: one retry absorbs a slow load; the report still marks it flaky.
      retries: 1,
      // These pages load many third-party scripts; 30s (the default) is too tight for load + search.
      timeout: 60_000,
      use: { ...devices['Desktop Chrome'], locale: 'en-US', trace: 'retain-on-failure' },
    },
  ],
});
