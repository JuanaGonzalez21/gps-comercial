import { Outlet } from 'react-router'

// Placeholder from the shared skeleton. Owner: ux-ui (frontend foundation).
// Final version: header, navigation filtered with useAuth().hasPermission, user menu, skip link.
export default function AppShell() {
  return (
    <main id="main">
      <Outlet />
    </main>
  )
}
