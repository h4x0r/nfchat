import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Settings } from './Settings'

describe('Settings', () => {
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders without crashing', () => {
    render(<Settings onClose={mockOnClose} />)
    expect(screen.getByTestId('settings-panel')).toBeInTheDocument()
  })

  it('has API key input field', () => {
    render(<Settings onClose={mockOnClose} />)
    expect(screen.getByLabelText(/api key/i)).toBeInTheDocument()
  })

  it('has model selector', () => {
    render(<Settings onClose={mockOnClose} />)
    expect(screen.getByLabelText(/model/i)).toBeInTheDocument()
  })

  it('masks API key by default', () => {
    render(<Settings onClose={mockOnClose} />)
    const input = screen.getByLabelText(/api key/i)
    expect(input).toHaveAttribute('type', 'password')
  })

  it('shows/hides API key when toggle is clicked', async () => {
    const user = userEvent.setup()
    render(<Settings onClose={mockOnClose} />)

    const input = screen.getByLabelText(/anthropic api key/i)
    expect(input).toHaveAttribute('type', 'password')

    // Get the first "show" button (for API key, not MotherDuck token)
    const showButtons = screen.getAllByRole('button', { name: /show/i })
    await user.click(showButtons[0])
    expect(input).toHaveAttribute('type', 'text')
  })

  it('saves API key to localStorage', async () => {
    const user = userEvent.setup()
    render(<Settings onClose={mockOnClose} />)

    const input = screen.getByLabelText(/api key/i)
    await user.type(input, 'sk-test-key-12345')
    await user.click(screen.getByRole('button', { name: /save/i }))

    expect(localStorage.getItem('anthropic_api_key')).toBe('sk-test-key-12345')
  })

  it('loads existing API key from localStorage', () => {
    localStorage.setItem('anthropic_api_key', 'sk-existing-key')
    render(<Settings onClose={mockOnClose} />)

    const input = screen.getByLabelText(/api key/i) as HTMLInputElement
    expect(input.value).toBe('sk-existing-key')
  })

  it('shows success message after saving', async () => {
    const user = userEvent.setup()
    render(<Settings onClose={mockOnClose} />)

    const input = screen.getByLabelText(/api key/i)
    await user.type(input, 'sk-test-key')
    await user.click(screen.getByRole('button', { name: /save/i }))

    expect(screen.getByText(/saved/i)).toBeInTheDocument()
  })

  it('validates API key format', async () => {
    const user = userEvent.setup()
    render(<Settings onClose={mockOnClose} />)

    const input = screen.getByLabelText(/api key/i)
    await user.type(input, 'invalid-key')
    await user.click(screen.getByRole('button', { name: /save/i }))

    expect(screen.getByText(/invalid/i)).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup()
    render(<Settings onClose={mockOnClose} />)

    await user.click(screen.getByRole('button', { name: /close/i }))
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('shows warning about API key storage', () => {
    render(<Settings onClose={mockOnClose} />)
    expect(screen.getByText(/stored locally/i)).toBeInTheDocument()
  })

  it('has option to clear API key', async () => {
    localStorage.setItem('anthropic_api_key', 'sk-existing-key')
    const user = userEvent.setup()
    render(<Settings onClose={mockOnClose} />)

    await user.click(screen.getByRole('button', { name: /clear/i }))
    expect(localStorage.getItem('anthropic_api_key')).toBeNull()
  })
})
