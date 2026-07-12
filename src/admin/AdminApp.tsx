import { lazy, Suspense, useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { Navigate, Route, Routes } from 'react-router-dom'
import { api, ApiError, type SessionUser } from './api'
import { Layout } from './components/Layout'
import { ResourcePage } from './components/ResourcePage'
import { ToastProvider } from './components/Toast'
import { Login } from './pages/Login'
import { MediaLibrary } from './pages/MediaLibrary'
import { MessagesPage } from './pages/MessagesPage'
import { SettingsPage } from './pages/SettingsPage'
import { RESOURCES } from './resources'
import SEO from '../components/SEO'

// En chunk aparte: arrastra xlsx/papaparse y solo se usa en /asociados.
const AsociadosPage = lazy(() =>
  import('./pages/AsociadosPage').then((m) => ({ default: m.AsociadosPage })),
)
const MapsPage = lazy(() => import('./pages/MapsPage').then((m) => ({ default: m.MapsPage })))
const MapDetailPage = lazy(() => import('./pages/MapsPage').then((m) => ({ default: m.MapDetailPage })))
const GroupsPage = lazy(() => import('./pages/GroupsPage').then((m) => ({ default: m.GroupsPage })))
const RafflePage = lazy(() => import('./pages/RafflePage').then((m) => ({ default: m.RafflePage })))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return false
        return failureCount < 2
      },
      staleTime: 10_000,
    },
  },
})

function AuthGate() {
  const [expired, setExpired] = useState(false)
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<SessionUser>('/auth/me'),
    retry: false,
  })
  useEffect(() => {
    const onExpired = () => setExpired(true)
    window.addEventListener('asovicam:unauthenticated', onExpired)
    return () => window.removeEventListener('asovicam:unauthenticated', onExpired)
  }, [])

  if (me.isLoading) {
    return <p className="py-20 text-center text-stone-500">Cargando…</p>
  }
  if (expired || me.isError || !me.data) {
    return <Login />
  }

  return (
    <Routes>
      <Route element={<Layout user={me.data} />}>
        {/* Rutas absolutas: bajo el montaje admin/* los destinos relativos se
            resuelven contra la URL actual y anidan segmentos sin fin. */}
        <Route index element={<Navigate to={`/admin/${RESOURCES[0]!.path}`} replace />} />
        {RESOURCES.map((r) => (
          <Route key={r.path} path={r.path} element={<ResourcePage def={r} />} />
        ))}
        <Route
          path="asociados"
          element={
            <Suspense fallback={<p className="py-20 text-center text-stone-500">Cargando…</p>}>
              <AsociadosPage />
            </Suspense>
          }
        />
        <Route path="media" element={<MediaLibrary />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="mapas" element={<Suspense fallback={<p className="py-20 text-center text-stone-500">Cargando…</p>}><MapsPage /></Suspense>} />
        <Route path="mapas/:mapId" element={<Suspense fallback={<p className="py-20 text-center text-stone-500">Cargando…</p>}><MapDetailPage /></Suspense>} />
        <Route path="sorteos/:raffleId" element={<Suspense fallback={<p className="py-20 text-center text-stone-500">Cargando…</p>}><RafflePage /></Suspense>} />
        <Route path="agrupaciones" element={<Suspense fallback={<p className="py-20 text-center text-stone-500">Cargando…</p>}><GroupsPage /></Suspense>} />
        <Route path="*" element={<Navigate to={`/admin/${RESOURCES[0]!.path}`} replace />} />
      </Route>
    </Routes>
  )
}

export default function AdminApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <SEO
          title="Administración"
          description="Panel privado de ASOVICAM."
          noindex
        />
        <AuthGate />
      </ToastProvider>
    </QueryClientProvider>
  )
}
