import { describe, expect, it, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { Playhead } from './Playhead'

describe('Playhead', () => {
  it('renders at the specified position', () => {
    const { container } = render(<Playhead position={50} />)
    const playhead = container.querySelector('[data-playhead]')
    expect(playhead).toHaveStyle({ left: '50%' })
  })

  it('applies Premiere Pro playhead color', () => {
    const { container } = render(<Playhead position={25} />)
    const playhead = container.querySelector('[data-playhead]')
    // Should have the cyan playhead color
    expect(playhead).toHaveStyle({ backgroundColor: '#00aaff' })
  })

  it('has glow effect', () => {
    const { container } = render(<Playhead position={50} />)
    const playhead = container.querySelector('[data-playhead]')
    expect(playhead).toHaveStyle({ boxShadow: expect.stringContaining('0 0') })
  })

  it('shows triangle handle at top', () => {
    const { container } = render(<Playhead position={50} />)
    const handle = container.querySelector('[data-playhead-handle]')
    expect(handle).toBeInTheDocument()
  })

  it('is hidden when visible=false', () => {
    const { container } = render(<Playhead position={50} visible={false} />)
    const playhead = container.querySelector('[data-playhead]')
    expect(playhead).toHaveClass('opacity-0')
  })

  it('calls onDragStart when dragging begins', () => {
    const onDragStart = vi.fn()
    const { container } = render(
      <Playhead position={50} onDragStart={onDragStart} />
    )
    const handle = container.querySelector('[data-playhead-handle]')!
    fireEvent.mouseDown(handle)
    expect(onDragStart).toHaveBeenCalled()
  })

  it('has cursor-grab style for dragging', () => {
    const { container } = render(<Playhead position={50} />)
    const handle = container.querySelector('[data-playhead-handle]')
    expect(handle).toHaveClass('cursor-grab')
  })

  it('clamps position between 0 and 100', () => {
    const { container: underflow } = render(<Playhead position={-10} />)
    const { container: overflow } = render(<Playhead position={110} />)

    const playheadUnder = underflow.querySelector('[data-playhead]')
    const playheadOver = overflow.querySelector('[data-playhead]')

    expect(playheadUnder).toHaveStyle({ left: '0%' })
    expect(playheadOver).toHaveStyle({ left: '100%' })
  })
})
