import { NavLink, Outlet } from 'react-router-dom'
import { API_URL, type SessionUser } from '../api'
import { RESOURCES } from '../resources'

const EXTRA = [
  { to: 'asociados', label: 'Asociados' },
  { to: 'mapas', label: 'Mapas y sorteos' },
  { to: 'agrupaciones', label: 'Agrupaciones' },
  { to: 'media', label: 'Medios' },
  { to: 'messages', label: 'Mensajes' },
  { to: 'settings', label: 'Ajustes' },
]

export function Layout({ user }: { user: SessionUser }) {
  const logout = async () => {
    await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' })
    window.location.reload()
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r border-stone-200 bg-white">
        <div className="border-b border-stone-100 px-4 py-4">
          <img
            src="/logo.jpg"
            alt="ASOVICAM — Asociación Vida en el Campo"
            className="h-12 w-auto max-w-full object-contain object-left"
          />
          <p className="mt-2 text-xs text-stone-400">Gestión de contenido</p>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          {RESOURCES.map((r) => (
            <NavLink
              key={r.path}
              to={r.path}
              className={({ isActive }) =>
                `block rounded px-3 py-2 text-sm ${
                  isActive ? 'bg-emerald-50 font-medium text-emerald-900' : 'text-stone-600 hover:bg-stone-50'
                }`
              }
            >
              {r.title}
            </NavLink>
          ))}
          <div className="my-2 border-t border-stone-100" />
          {EXTRA.map((r) => (
            <NavLink
              key={r.to}
              to={r.to}
              className={({ isActive }) =>
                `block rounded px-3 py-2 text-sm ${
                  isActive ? 'bg-emerald-50 font-medium text-emerald-900' : 'text-stone-600 hover:bg-stone-50'
                }`
              }
            >
              {r.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-stone-100 p-3">
          <div className="flex items-center gap-2">
            {user.picture ? (
              <img src={user.picture} alt="" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
            ) : (
              <div className="grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-sm">👤</div>
            )}
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">{user.name || user.email}</p>
              <button onClick={() => void logout()} className="text-xs text-red-700 hover:underline">
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-6">
        <Outlet />
      </main>
    </div>
  )
}
