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

    test('shows file uploader by default', async ({ page }) => {
      await page.goto('/')

      await expect(page.getByTestId('uploader')).toBeVisible()
      await expect(page.getByText(/drag.*drop/i)).toBeVisible()
    })

    test('shows demo data option when tab clicked', async ({ page }) => {
      await page.goto('/')

      await page.getByRole('tab', { name: /demo/i }).click()
      await expect(page.getByRole('button', { name: /load demo/i })).toBeVisible()
    })

    test('has settings button', async ({ page }) => {
      await page.goto('/')

      await expect(page.getByRole('button', { name: /configure api key/i })).toBeVisible()
    })
  })

  test.describe('File Upload', () => {
    test('accepts parquet file via file input', async ({ page }) => {
      await page.goto('/')

      // Upload the test parquet file
      const fileInput = page.getByTestId('file-input')
      await fileInput.setInputFiles(TEST_PARQUET)

      // Should show the file name
      await expect(page.getByText('test-flows.parquet')).toBeVisible()
    })

    test('shows error for non-parquet files', async ({ page }) => {
      await page.goto('/')

      // Create a fake CSV file
      const fileInput = page.getByTestId('file-input')
      await fileInput.setInputFiles({
        name: 'test.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from('a,b,c\n1,2,3'),
      })

      // Should show error
      await expect(page.getByText(/parquet files only/i)).toBeVisible()
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
    test.beforeEach(async ({ page }) => {
      await page.goto('/')
      await page.getByTestId('file-input').setInputFiles(TEST_PARQUET)
      await page.getByRole('button', { name: /load file/i }).click()
      await expect(page.getByTestId('dashboard')).toBeVisible({ timeout: 60000 })
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
    test.beforeEach(async ({ page }) => {
      await page.goto('/')
      await page.getByTestId('file-input').setInputFiles(TEST_PARQUET)
      await page.getByRole('button', { name: /load file/i }).click()
      await expect(page.getByTestId('dashboard')).toBeVisible({ timeout: 60000 })
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
