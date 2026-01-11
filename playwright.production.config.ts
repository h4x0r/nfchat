import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config for testing against production (no local webServer).
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'production.spec.ts',
  fullyParallel: true,
  retries: 0,
  workers: 1,
  reporter: 'line',
  timeout: 180 * 1000, // 3 minutes for real API calls
  use: {
    baseURL: 'https://nfchat.vercel.app',
    trace: 'on-first-retry',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // No webServer - testing against production
})
