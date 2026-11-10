import type { ComponentType } from 'react'
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import type { Permission } from '@/api/types'
import AppShell from '@/layouts/AppShell'
import PublicLayout from '@/layouts/PublicLayout'
import { PageLoader } from '@/ui'
import { RequireAuth, RequirePasswordChanged, RequirePermission } from './guards'
import { NotFound } from './NotFound'
import { RootLayout } from './RootLayout'
import { RouteError } from './RouteError'

// Routes from docs/api-contract.md §9. Pages are code-split; guards wrap them.
// Shared file (contract §10): change it only as the owning task.

type PageModule = { default: ComponentType }

function lazyPage(load: () => Promise<PageModule>, permission?: Permission) {
  return {
    lazy: async () => {
      const { default: Page } = await load()
      return {
        element: permission ? (
          <RequirePermission permission={permission}>
            <Page />
          </RequirePermission>
        ) : (
          <Page />
        ),
      }
    },
  }
}

export const appRoutes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    // First load of a lazy route: never a blank screen.
    hydrateFallbackElement: <PageLoader />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { index: true, ...lazyPage(() => import('@/features/landing/LandingPage')) },
          { path: '*', element: <NotFound /> },
        ],
      },
      { path: 'login', ...lazyPage(() => import('@/features/auth/LoginPage')) },
      {
        path: 'change-password',
        element: <RequireAuth />,
        children: [
          { index: true, ...lazyPage(() => import('@/features/auth/ChangePasswordPage')) },
        ],
      },
      {
        path: 'app',
        element: (
          <RequireAuth>
            <RequirePasswordChanged>
              <AppShell />
            </RequirePasswordChanged>
          </RequireAuth>
        ),
        children: [
          {
            // Errors inside a page keep the navigation visible.
            errorElement: <RouteError embedded />,
            children: [
              { index: true, element: <Navigate to="dashboard" replace /> },
              {
                path: 'dashboard',
                ...lazyPage(() => import('@/features/dashboard/DashboardPage'), 'dashboard:read'),
              },
              {
                path: 'vehicles',
                ...lazyPage(() => import('@/features/vehicles/VehiclesPage'), 'vehicles:read'),
              },
              {
                path: 'vehicles/:id',
                ...lazyPage(() => import('@/features/vehicles/VehicleDetailPage'), 'vehicles:read'),
              },
              {
                path: 'drivers',
                ...lazyPage(() => import('@/features/drivers/DriversPage'), 'drivers:read'),
              },
              {
                path: 'passengers',
                ...lazyPage(() => import('@/features/passengers/PassengersPage'), 'passengers:read'),
              },
              {
                path: 'history',
                ...lazyPage(() => import('@/features/history/HistoryPage'), 'history:read'),
              },
              {
                path: 'users',
                ...lazyPage(() => import('@/features/users/UsersPage'), 'users:manage'),
              },
              {
                path: 'audit',
                ...lazyPage(() => import('@/features/audit/AuditPage'), 'audit:read'),
              },
              { path: '*', element: <NotFound /> },
            ],
          },
        ],
      },
    ],
  },
]

export function createAppRouter() {
  return createBrowserRouter(appRoutes)
}
