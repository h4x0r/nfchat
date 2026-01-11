import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const TEST_PARQUET = path.join(__dirname, 'fixtures/test-flows.parquet')

test.describe('nfchat App', () => {
  test.describe('Landing Page', () => {
    test('displays landing page with title', async ({ page }) => {
      await page.goto('/')

      await expect(page.getByText('nfchat - NetFlow Analysis')).toBeVisible()
    })

    test('has upload and demo tabs', async ({ page }) => {
      await page.goto('/')

      await expect(page.getByRole('tab', { name: /upload/i })).toBeVisible()
      await expect(page.getByRole('tab', { name: /demo/i })).toBeVisible()
    })

    test('shows demo data option by default', async ({ page }) => {
      await page.goto('/')

      // Demo tab is now default
      await expect(page.getByRole('button', { name: /load demo/i })).toBeVisible()
    })

    test('shows upload coming soon when tab clicked', async ({ page }) => {
      await page.goto('/')

      await page.getByRole('tab', { name: /upload/i }).click()
      await expect(page.getByText(/coming soon/i)).toBeVisible()
    })

    test('has settings button', async ({ page }) => {
      await page.goto('/')

      await expect(page.getByRole('button', { name: /configure api key/i })).toBeVisible()
    })
  })

  test.describe('Demo Data Loading', () => {
    // Mock API responses for consistent E2E testing
    const mockLoadResponse = { success: true, rowCount: 2390275 }
    const mockDashboardResponse = {
      success: true,
      data: {
        timeline: [
          { bucket: '2015-01-22T00:00:00Z', Normal: 1000, attack: 500 },
          { bucket: '2015-01-22T01:00:00Z', Normal: 1200, attack: 300 },
        ],
        attacks: [
          { attack: 'Normal', count: 2000000 },
          { attack: 'Exploits', count: 100000 },
          { attack: 'Fuzzers', count: 50000 },
        ],
        topSrcIPs: [
          { ip: '192.168.1.1', value: 50000 },
          { ip: '10.0.0.1', value: 30000 },
        ],
        topDstIPs: [
          { ip: '192.168.1.100', value: 40000 },
          { ip: '10.0.0.100', value: 25000 },
        ],
        flows: [
          { SrcAddr: '192.168.1.1', DstAddr: '192.168.1.100', Sport: 443, Dport: 12345, Proto: 6, Attack: 'Normal' },
        ],
        totalCount: 2390275,
      },
    }

    test('loads demo dataset and shows dashboard', async ({ page }) => {
      // Mock the API endpoints
      await page.route('**/api/motherduck/load', async (route) => {
        await route.fulfill({ json: mockLoadResponse })
      })
      await page.route('**/api/motherduck/dashboard', async (route) => {
        await route.fulfill({ json: mockDashboardResponse })
      })

      await page.goto('/')

      // Click "Load Demo Dataset" button
      await page.getByRole('button', { name: /load demo/i }).click()

      // Wait for dashboard to appear
      await expect(page.getByTestId('dashboard')).toBeVisible({ timeout: 30000 })

      // Verify dashboard components are visible
      await expect(page.getByTestId('attack-breakdown')).toBeVisible()
      await expect(page.getByTestId('timeline-chart')).toBeVisible()
      await expect(page.getByTestId('flow-table')).toBeVisible()
    })

    test('shows progress during demo data loading', async ({ page }) => {
      // Delay the API response to see progress
      await page.route('**/api/motherduck/load', async (route) => {
        await new Promise((r) => setTimeout(r, 500))
        await route.fulfill({ json: mockLoadResponse })
      })
      await page.route('**/api/motherduck/dashboard', async (route) => {
        await route.fulfill({ json: mockDashboardResponse })
      })

      await page.goto('/')

      await page.getByRole('button', { name: /load demo/i }).click()

      // Should show progress indicator
      await expect(page.getByRole('progressbar')).toBeVisible()
    })

    test('shows error state when API fails', async ({ page }) => {
      // Mock API failure
      await page.route('**/api/motherduck/load', async (route) => {
        await route.fulfill({
          status: 500,
          json: { success: false, error: 'Connection failed' },
        })
      })

      await page.goto('/')
      await page.getByRole('button', { name: /load demo/i }).click()

      // Should show error message
      await expect(page.getByText(/connection failed/i)).toBeVisible({ timeout: 10000 })
      await expect(page.getByRole('button', { name: /try again/i })).toBeVisible()
    })
  })

  // File Upload is currently disabled (shows "Coming Soon")
  // These tests will be re-enabled when file upload is implemented
  test.describe.skip('File Upload', () => {
    test('accepts parquet file via file input', async ({ page }) => {
      await page.goto('/')

      // Upload the test parquet file
      const fileInput = page.getByTestId('file-input')
      await fileInput.setInputFiles(TEST_PARQUET)

      // Should show the file name
      await expect(page.getByText('test-flows.parquet')).toBeVisible()
    })

    test('shows error for unsupported file types', async ({ page }) => {
      await page.goto('/')

      // Create an unsupported file type (.txt)
      const fileInput = page.getByTestId('file-input')
      await fileInput.setInputFiles({
        name: 'test.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('some text content'),
      })

      // Should show error for unsupported file type
      await expect(page.getByText(/unsupported file type/i)).toBeVisible()
    })

    test('enables load button after file selection', async ({ page }) => {
      await page.goto('/')

      const loadButton = page.getByRole('button', { name: /load file/i })

      // Button should be disabled initially
      await expect(loadButton).toBeDisabled()

      // Upload file
      await page.getByTestId('file-input').setInputFiles(TEST_PARQUET)

      // Button should be enabled now
      await expect(loadButton).toBeEnabled()
    })

    test('loads parquet file and shows dashboard', async ({ page }) => {
      await page.goto('/')

      // Upload file
      await page.getByTestId('file-input').setInputFiles(TEST_PARQUET)

      // Click load
      await page.getByRole('button', { name: /load file/i }).click()

      // Should show loading state
      await expect(page.getByText(/loading/i)).toBeVisible()

      // Wait for dashboard to appear (with extended timeout for DuckDB init)
      await expect(page.getByTestId('dashboard')).toBeVisible({ timeout: 60000 })
    })
  })

  test.describe('Dashboard', () => {
    // Reuse mock data for dashboard tests
    const mockLoadResponse = { success: true, rowCount: 2390275 }
    const mockDashboardResponse = {
      success: true,
      data: {
        timeline: [{ bucket: '2015-01-22T00:00:00Z', Normal: 1000, attack: 500 }],
        attacks: [{ attack: 'Normal', count: 2000000 }, { attack: 'Exploits', count: 100000 }],
        topSrcIPs: [{ ip: '192.168.1.1', value: 50000 }],
        topDstIPs: [{ ip: '192.168.1.100', value: 40000 }],
        flows: [{ SrcAddr: '192.168.1.1', DstAddr: '192.168.1.100', Sport: 443, Dport: 12345, Proto: 6, Attack: 'Normal' }],
        totalCount: 2390275,
      },
    }

    test.beforeEach(async ({ page }) => {
      // Mock API responses
      await page.route('**/api/motherduck/load', (route) => route.fulfill({ json: mockLoadResponse }))
      await page.route('**/api/motherduck/dashboard', (route) => route.fulfill({ json: mockDashboardResponse }))

      await page.goto('/')
      // Load demo data
      await page.getByRole('button', { name: /load demo/i }).click()
      await expect(page.getByTestId('dashboard')).toBeVisible({ timeout: 30000 })
    })

    test('displays attack breakdown chart', async ({ page }) => {
      await expect(page.getByTestId('attack-breakdown')).toBeVisible()
    })

    test('displays top talkers', async ({ page }) => {
      // There are two TopTalkers panels (source and destination IPs)
      await expect(page.getByTestId('top-talkers').first()).toBeVisible()
    })

    test('displays timeline', async ({ page }) => {
      await expect(page.getByTestId('timeline-chart')).toBeVisible()
    })

    test('displays flow table', async ({ page }) => {
      await expect(page.getByTestId('flow-table')).toBeVisible()
    })

    test('has chat toggle button', async ({ page }) => {
      await expect(page.getByRole('button', { name: /chat/i })).toBeVisible()
    })
  })

  test.describe('Settings Modal', () => {
    test('opens settings modal', async ({ page }) => {
      await page.goto('/')

      await page.getByRole('button', { name: /configure api key/i }).click()

      await expect(page.getByTestId('settings-panel')).toBeVisible()
    })

    test('has API key input', async ({ page }) => {
      await page.goto('/')
      await page.getByRole('button', { name: /configure api key/i }).click()

      await expect(page.getByLabel(/api key/i)).toBeVisible()
    })

    test('closes settings with close button', async ({ page }) => {
      await page.goto('/')
      await page.getByRole('button', { name: /configure api key/i }).click()

      await expect(page.getByTestId('settings-panel')).toBeVisible()

      await page.getByRole('button', { name: /close/i }).click()

      await expect(page.getByTestId('settings-panel')).not.toBeVisible()
    })
  })

  test.describe('Chat Panel', () => {
    // Reuse mock data for chat panel tests
    const mockLoadResponse = { success: true, rowCount: 2390275 }
    const mockDashboardResponse = {
      success: true,
      data: {
        timeline: [{ bucket: '2015-01-22T00:00:00Z', Normal: 1000, attack: 500 }],
        attacks: [{ attack: 'Normal', count: 2000000 }],
        topSrcIPs: [{ ip: '192.168.1.1', value: 50000 }],
        topDstIPs: [{ ip: '192.168.1.100', value: 40000 }],
        flows: [{ SrcAddr: '192.168.1.1', DstAddr: '192.168.1.100', Sport: 443, Dport: 12345, Proto: 6, Attack: 'Normal' }],
        totalCount: 2390275,
      },
    }

    test.beforeEach(async ({ page }) => {
      // Mock API responses
      await page.route('**/api/motherduck/load', (route) => route.fulfill({ json: mockLoadResponse }))
      await page.route('**/api/motherduck/dashboard', (route) => route.fulfill({ json: mockDashboardResponse }))

      await page.goto('/')
      // Load demo data
      await page.getByRole('button', { name: /load demo/i }).click()
      await expect(page.getByTestId('dashboard')).toBeVisible({ timeout: 30000 })
    })

    test('opens chat panel', async ({ page }) => {
      await page.getByRole('button', { name: /chat/i }).click()

      await expect(page.getByTestId('chat-panel')).toBeVisible()
    })

    test('has message input', async ({ page }) => {
      await page.getByRole('button', { name: /chat/i }).click()

      await expect(page.getByPlaceholder(/ask about/i)).toBeVisible()
    })

    test('closes chat panel', async ({ page }) => {
      await page.getByRole('button', { name: /chat/i }).click()
      await expect(page.getByTestId('chat-panel')).toBeVisible()

      await page.getByRole('button', { name: /close/i }).click()
      await expect(page.getByTestId('chat-panel')).not.toBeVisible()
    })
  })
})
