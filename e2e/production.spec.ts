import { test, expect } from '@playwright/test'

/**
 * Production smoke test - tests against the actual Vercel deployment
 * with real API calls (no mocking).
 */
test.describe('Production Smoke Test', () => {
  test('loads demo data from real API', async ({ page }) => {
    // Capture console errors
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    // Capture network failures
    page.on('response', (response) => {
      if (!response.ok()) {
        console.log(`API Error: ${response.url()} - ${response.status()}`)
      }
    })

    // Go to production
    await page.goto('/')

    // Verify landing page
    await expect(page.getByText('nfchat')).toBeVisible({ timeout: 10000 })

    // Click Load Demo Dataset (real API call)
    await page.getByRole('button', { name: /load demo/i }).click()

    // Should show progress
    await expect(page.getByRole('progressbar')).toBeVisible({ timeout: 5000 })

    // Wait a bit then check for errors
    await page.waitForTimeout(10000)

    // Check if there's an error on the page
    const errorText = await page.locator('text=/error|failed/i').first().textContent().catch(() => null)
    if (errorText) {
      console.log('Page error:', errorText)
    }

    // Log console errors
    if (errors.length > 0) {
      console.log('Console errors:', errors)
    }

    // Take screenshot
    await page.screenshot({ path: 'test-results/production-state.png', fullPage: true })

    // Wait for dashboard (real MotherDuck query - may take up to 2 minutes)
    await expect(page.getByTestId('dashboard')).toBeVisible({ timeout: 120000 })
  })
})
