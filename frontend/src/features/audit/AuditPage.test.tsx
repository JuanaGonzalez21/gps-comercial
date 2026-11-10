import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { AuditLogOut, Page } from '@/api/types'
import { jsonResponse, mockFetch, problemResponse, type FetchCall } from '@/test/http'
import { AuditCardList } from './AuditCardList'
import AuditPage from './AuditPage'

const ENTRIES: AuditLogOut[] = [
  {
    id: 2,
    occurred_at: '2026-11-09T19:33:11Z',
    actor_email: 'ana.perez@example.com',
    action: 'user.created',
    entity_type: 'user',
    entity_id: '00000000-0000-0000-0000-000000000009',
    outcome: 'success',
    ip_address: '198.51.100.20',
    // A hostile value stored in a record must be displayed as text, never run as HTML.
    details: { email: 'nora@example.com', role: 'viewer', note: '<img src=x onerror=alert(1)>' },
  },
  {
    id: 1,
    occurred_at: '2026-11-09T18:00:00Z',
    actor_email: 'intruso@example.com',
    action: 'auth.login_failed',
    entity_type: null,
    entity_id: null,
    outcome: 'failure',
    ip_address: '203.0.113.7',
    details: null,
  },
]

function page(items: AuditLogOut[]): Page<AuditLogOut> {
  return { items, total: items.length, page: 1, page_size: 20, pages: items.length ? 1 : 0 }
}

function auditCalls(calls: FetchCall[]): URL[] {
  return calls
    .filter((call) => call.url.startsWith('/api/v1/audit-logs'))
    .map((call) => new URL(call.url, 'http://test'))
}

function renderAudit() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <AuditPage />
    </QueryClientProvider>,
  )
}

describe('AuditPage', () => {
  it('shows who did what and when, with Spanish labels, outcome badges and safe details', async () => {
    mockFetch(() => jsonResponse(page(ENTRIES)))
    renderAudit()
    const user = userEvent.setup()

    const table = await screen.findByRole('table')
    expect(screen.getByText('2 eventos')).toBeInTheDocument()

    const created = within(table).getByRole('rowheader', { name: /9 de nov de 2026, 14:33/ }).closest('tr')!
    expect(within(created).getByText('Usuario creado')).toBeInTheDocument()
    expect(within(created).getByText('user.created')).toBeInTheDocument()
    expect(within(created).getByText('ana.perez@example.com')).toBeInTheDocument()
    expect(within(created).getByText('Usuario')).toBeInTheDocument()
    expect(within(created).getByText('Éxito')).toBeInTheDocument()
    expect(within(created).getByText('IP 198.51.100.20')).toBeInTheDocument()
    // Long ids are shortened on screen; the full value stays in the tooltip and for screen readers.
    const shortened = within(created).getByText('00000000…00009')
    expect(shortened.parentElement).toHaveAttribute('title', '00000000-0000-0000-0000-000000000009')
    expect(within(created).getByText('00000000-0000-0000-0000-000000000009')).toHaveClass('visually-hidden')

    const failed = within(table).getByRole('rowheader', { name: /9 de nov de 2026, 13:00/ }).closest('tr')!
    expect(within(failed).getByText('Inicio de sesión fallido')).toBeInTheDocument()
    expect(within(failed).getByText('Fallo')).toBeInTheDocument()
    expect(within(failed).getByText('Sin detalles')).toBeInTheDocument()
    expect(within(failed).queryByRole('button')).not.toBeInTheDocument()

    const toggle = within(created).getByRole('button', {
      name: 'Ver detalles de Usuario creado, 9 de nov de 2026, 14:33',
    })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    const details = document.getElementById(toggle.getAttribute('aria-controls')!)!
    expect(details).not.toBeVisible()
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(details).toBeVisible()
    // The panel spans the whole row and lists each detail as text: a hostile value is not HTML.
    expect(details.querySelector('td')).toHaveAttribute('colspan', '6')
    expect(within(details).getByText('note')).toBeInTheDocument()
    expect(within(details).getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument()
    expect(document.querySelector('img')).toBeNull()

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(details).not.toBeVisible()
  })

  it('builds the query from the filters, sending Bogota days as UTC instants', async () => {
    const { calls } = mockFetch(() => jsonResponse(page(ENTRIES)))
    renderAudit()
    const user = userEvent.setup()
    await screen.findByRole('table')

    const filters = screen.getByRole('search', { name: 'Filtrar el registro de auditoría' })
    await user.selectOptions(within(filters).getByRole('combobox', { name: 'Acción' }), 'user.')
    await user.type(within(filters).getByRole('searchbox', { name: 'Usuario (correo)' }), 'ana')
    await user.selectOptions(within(filters).getByRole('combobox', { name: 'Resultado' }), 'failure')
    fireEvent.change(within(filters).getByLabelText('Desde'), { target: { value: '2026-11-01' } })
    fireEvent.change(within(filters).getByLabelText('Hasta'), { target: { value: '2026-11-09' } })

    await waitFor(() => {
      const last = auditCalls(calls).at(-1)!
      expect(last.searchParams.get('action')).toBe('user.')
      expect(last.searchParams.get('actor')).toBe('ana')
      expect(last.searchParams.get('outcome')).toBe('failure')
      expect(last.searchParams.get('date_from')).toBe('2026-11-01T05:00:00.000Z')
      expect(last.searchParams.get('date_to')).toBe('2026-11-10T04:59:59.999Z')
      expect(last.searchParams.get('page')).toBe('1')
      expect(last.searchParams.get('page_size')).toBe('10')
    })
  })

  it('reports an inverted date range on its field instead of sending it', async () => {
    const { calls } = mockFetch(() => jsonResponse(page(ENTRIES)))
    renderAudit()
    await screen.findByRole('table')

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-11-09' } })
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-11-01' } })

    const to = screen.getByLabelText('Hasta')
    expect(to).toHaveAttribute('aria-invalid', 'true')
    expect(to).toHaveAccessibleDescription(/La fecha final debe ser igual o posterior a la inicial/)
    expect(screen.getByRole('heading', { name: 'Revisa el rango de fechas' })).toBeInTheDocument()
    // "Desde" alone is a valid filter; the inverted pair is never sent.
    expect(auditCalls(calls).some((url) => url.searchParams.has('date_to'))).toBe(false)
  })

  it('shows the same data in phone cards, with the date as heading and folding details', async () => {
    render(<AuditCardList items={ENTRIES} />)
    const user = userEvent.setup()

    const card = screen.getByRole('article', { name: /9 de nov de 2026, 14:33/ })
    expect(within(card).getByRole('heading', { level: 3 })).toHaveTextContent('9 de nov de 2026, 14:33')
    expect(within(card).getByText('Usuario creado')).toBeInTheDocument()
    expect(within(card).getByText('IP 198.51.100.20')).toBeInTheDocument()
    expect(within(card).getByText('00000000…00009')).toBeInTheDocument()

    const toggle = within(card).getByRole('button', { name: /^Ver detalles de Usuario creado/ })
    const details = document.getElementById(toggle.getAttribute('aria-controls')!)!
    expect(details).not.toBeVisible()
    await user.click(toggle)
    expect(details).toBeVisible()
    expect(within(details).getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument()

    const failed = screen.getByRole('article', { name: /9 de nov de 2026, 13:00/ })
    expect(within(failed).getByText('Fallo')).toBeInTheDocument()
    expect(within(failed).queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows an error with retry, then a guided empty state', async () => {
    let failing = true
    mockFetch(() =>
      failing
        ? problemResponse(500, 'internal_error', { detail: 'Ocurrió un error inesperado.' })
        : jsonResponse(page([])),
    )
    renderAudit()
    const user = userEvent.setup()

    expect(
      await screen.findByRole('heading', { name: 'No pudimos cargar el registro de auditoría' }),
    ).toBeInTheDocument()
    failing = false
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('heading', { name: 'Aún no hay eventos registrados' })).toBeInTheDocument()
  })
})
