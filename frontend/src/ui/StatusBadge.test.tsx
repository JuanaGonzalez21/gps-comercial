import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { VehicleStatus } from '@/api/types'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  it.each<[VehicleStatus, string]>([
    ['moving', 'En movimiento'],
    ['stopped', 'Detenido'],
    ['no_signal', 'Sin señal'],
  ])('shows %s as icon + text + colour class', (status, label) => {
    const { container } = render(<StatusBadge status={status} />)
    const badge = screen.getByText(label).parentElement
    expect(badge).toHaveClass('status-badge', `status-badge--${status}`)
    // The icon is decorative: the text carries the meaning.
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })
})
