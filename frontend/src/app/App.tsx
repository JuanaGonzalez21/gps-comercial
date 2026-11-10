import { RouterProvider } from 'react-router/dom'
import { AppProviders } from './providers'
import { createAppRouter } from './router'
import { ServerStatusBanner } from './ServerStatusBanner'

const router = createAppRouter()

export default function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
      {/* Outside the router so it shows even while the first route chunk loads. */}
      <ServerStatusBanner />
    </AppProviders>
  )
}
