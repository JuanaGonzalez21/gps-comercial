import { Outlet, ScrollRestoration } from 'react-router'

/** Top route: restores scroll per history entry; layouts and guards hang below it. */
export function RootLayout() {
  return (
    <>
      <ScrollRestoration />
      <Outlet />
    </>
  )
}
