import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type ContactMessageItem } from '../api'
import { useToast } from '../components/Toast'

export function MessagesPage() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['messages'],
    queryFn: () => api.get<ContactMessageItem[]>('/api/admin/messages'),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['messages'] })

  const markRead = useMutation({
    mutationFn: (m: ContactMessageItem) => api.patch(`/api/admin/messages/${m.id}`, { read: !m.read }),
    onSuccess: () => void invalidate(),
    onError: (err) => toast('error', err instanceof Error ? err.message : 'Error'),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/admin/messages/${id}`),
    onSuccess: () => {
      toast('success', 'Mensaje eliminado')
      void invalidate()
    },
    onError: (err) => toast('error', err instanceof Error ? err.message : 'Error'),
  })

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Mensajes de contacto</h1>
      {query.isLoading && <p className="py-10 text-center text-stone-500">Cargando…</p>}
      {query.isError && <p className="py-10 text-center text-red-600">No se pudo cargar</p>}
      {query.isSuccess && query.data.length === 0 && (
        <p className="py-10 text-center text-stone-500">
          No hay mensajes. Llegarán aquí cuando el sitio conecte su formulario de contacto a
          POST /api/public/contact.
        </p>
      )}
      <div className="flex max-w-3xl flex-col gap-3">
        {(query.data ?? []).map((m) => (
          <div
            key={m.id}
            className={`rounded-lg border bg-white p-4 ${m.read ? 'border-stone-200 opacity-70' : 'border-emerald-300'}`}
          >
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">
                {m.name} <span className="font-normal text-stone-500">&lt;{m.email}&gt;</span>
              </p>
              <span className="text-xs text-stone-400">{new Date(m.createdAt).toLocaleString('es-CO')}</span>
            </div>
            {m.subject && <p className="text-sm font-medium text-stone-700">{m.subject}</p>}
            <p className="mt-1 whitespace-pre-wrap text-sm text-stone-600">{m.message}</p>
            <div className="mt-2 flex gap-3 text-xs">
              <button onClick={() => markRead.mutate(m)} className="text-emerald-700 hover:underline">
                {m.read ? 'Marcar como no leído' : 'Marcar como leído'}
              </button>
              <button
                onClick={() => {
                  if (confirm('¿Eliminar este mensaje?')) remove.mutate(m.id)
                }}
                className="text-red-700 hover:underline"
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
