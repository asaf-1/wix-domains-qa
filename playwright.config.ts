// Playwright's config tools, and dotenv, which reads the .env file.
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// WIX_API_KEY and WIX_ACCOUNT_ID come from .env (never committed).
dotenv.config({ quiet: true });

// The settings for every test run.
export default defineConfig({
  // All the tests live in the tests folder.
  testDir: './tests',
  // Run tests at the same time, to finish faster.
  fullyParallel: true,
  // Print results in the terminal, and save an HTML report (open it with npm run report).
  reporter: [['list'], ['html', { open: 'never' }]],
  // Two groups of tests: api (no browser) and ui (Chrome).
  projects: [
    {
      // The API tests: everything under tests/api.
      name: 'api',
      testMatch: 'api/**/*.spec.ts',
      // The assignment allows only a few hundred API calls; a retry would spend calls and hide flakiness.
      retries: 0,
      // A trace would store request headers, which include the API key.
      use: { trace: 'off' },
    },
    {
      // The browser tests: the web doors, plus the cross-door tests.
      name: 'ui',
      testMatch: ['ui/**/*.spec.ts', 'cross-door/**/*.spec.ts'],
      // Live production marketing pages: one retry absorbs a slow load; the report still marks it flaky.
      retries: 1,
      // These pages load many third-party scripts; 30s (the default) is too tight for load + search.
      timeout: 60_000,
      // Desktop Chrome, English page text, and a trace kept only when a test fails.
      use: { ...devices['Desktop Chrome'], locale: 'en-US', trace: 'retain-on-failure' },
    },
  ],
});
