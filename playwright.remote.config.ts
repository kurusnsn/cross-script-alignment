import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for remote E2E testing
 * Tests against deployed dev/staging/prod servers - no local webServer needed
 */
export default defineConfig({
  testDir: './tests/e2e',
  
  // Only run specific test files for remote testing
  testMatch: ['user-flow.spec.ts', 'full-pipeline.spec.ts', 'aligneration_persistence.spec.ts'],
  
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 4,
  reporter: [['list'], ['html', { open: 'never' }]],
  
  // Increased timeout for remote API calls
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  
  use: {
    // Base URL for API tests - override with API_BASE_URL for remote envs
    baseURL: process.env.API_BASE_URL || process.env.BACKEND_URL || 'http://localhost:8000',
    
    trace: 'on-first-retry',
    
    // Extra HTTP headers
    extraHTTPHeaders: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  },

  projects: [
    {
      name: 'api-tests',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // NO webServer - we're testing against remote servers
});
