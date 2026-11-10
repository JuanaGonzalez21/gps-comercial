import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { createElement, type ReactElement } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import type { Page, Permission, VehicleSummary } from '@/api/types'
import { AuthContext, type AuthContextValue } from '@/auth/useAuth'
import { makeUser, VIEWER_PERMISSIONS } from '@/test/http'
import { ToastProvider } from '@/ui'

// Test-only helpers for the drivers and passengers screens (not imported by application code).
// Plain .ts (createElement instead of JSX) so this module exports no components.

export { VIEWER_PERMISSIONS }

export const OPERATOR_PERMISSIONS: Permission[] = [
  ...VIEWER_PERMISSIONS,
  'drivers:write',
  'passengers:write',
  'assignments:write',
  'vehicles:custom_fields:write',
  'exports:csv',
]

/** jsdom knows <dialog> but not showModal()/close(): enough of them to open and close it. */
export function installDialogPolyfill(): void {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false
  }
}

/** Renders a page with the providers of the app: router, server-state cache, session, toasts. */
export function renderWithApp(
  page: ReactElement,
  path: string,
  permissions: Permission[],
  initialEntry: string = path,
) {
  const auth: AuthContextValue = {
    status: 'authenticated',
    user: makeUser({ permissions }),
    login: vi.fn(),
    logout: vi.fn(),
    changePassword: vi.fn(),
    refreshUser: vi.fn(),
    hasPermission: (permission) => permissions.includes(permission),
  }
  const router = createMemoryRouter(
    [
      { path, element: page },
      { path: '/app/vehicles/:id', element: createElement('p', null, 'Detalle del vehículo') },
    ],
    { initialEntries: [initialEntry] },
  )
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
        AuthContext,
        { value: auth },
        createElement(ToastProvider, null, createElement(RouterProvider, { router })),
      ),
    ),
  )
}

export function vehicleSummary(id: number, name: string, driverName: string | null = null): VehicleSummary {
  return {
    id,
    name,
    status: 'stopped',
    last_message_at: '2026-11-09T19:00:00Z',
    position: null,
    driver: driverName ? { resource_id: 10, id: 900 + id, name: driverName, phone: null } : null,
    passenger_count: 0,
  }
}

export function pageOf<T>(items: T[], total = items.length, page = 1, pageSize = 20): Page<T> {
  return { items, total, page, page_size: pageSize, pages: Math.ceil(total / pageSize) }
}
