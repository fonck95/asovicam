import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, type MediaItem } from '../api'
import { MediaThumb, UploadButton } from '../components/MediaPicker'
import { useToast } from '../components/Toast'

const KINDS = [
  { value: '', label: 'Todos' },
  { value: 'image', label: 'Imágenes' },
  { value: 'document', label: 'Documentos' },
  { value: 'video', label: 'Videos' },
]

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function MediaLibrary() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [kind, setKind] = useState('')
  const [page, setPage] = useState(1)

  const query = useQuery({
    queryKey: ['media', kind || 'all', page],
    queryFn: () =>
      api.get<{ items: MediaItem[]; total: number; pages: number }>(
        `/api/admin/media?page=${page}&limit=24${kind ? `&kind=${kind}` : ''}`,
      ),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/api/admin/media/${id}`),
    onSuccess: () => {
      toast('success', 'Medio eliminado (también del bucket)')
      void queryClient.invalidateQueries({ queryKey: ['media'] })
    },
    onError: (err) => {
      if (err instanceof ApiError && err.referencedBy) {
        toast('error', `En uso por: ${err.referencedBy.map((r) => `${r.resource} → ${r.label}`).join(', ')}`)
      } else {
        toast('error', err instanceof Error ? err.message : 'No se pudo eliminar')
      }
    },
  })

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Medios</h1>
        <UploadButton
          accept="image/jpeg,image/png,image/webp,image/avif,application/pdf,video/mp4"
          onUploaded={() => void queryClient.invalidateQueries({ queryKey: ['media'] })}
        />
      </div>
      <p className="mb-3 text-sm text-stone-500">
        Límites: imágenes (jpg/png/webp/avif) ≤ 10 MB · PDF ≤ 20 MB · MP4 ≤ 100 MB. La subida va
        directa a Cloudflare R2 con URL prefirmada.
      </p>
      <div className="mb-4 flex gap-2">
        {KINDS.map((k) => (
          <button
            key={k.value}
            onClick={() => {
              setKind(k.value)
              setPage(1)
            }}
            className={`rounded-full px-3 py-1 text-sm ${
              kind === k.value ? 'bg-emerald-700 text-white' : 'bg-white text-stone-600 border border-stone-200'
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      {query.isLoading && <p className="py-10 text-center text-stone-500">Cargando…</p>}
      {query.isError && <p className="py-10 text-center text-red-600">No se pudo cargar la lista</p>}
      {query.isSuccess && query.data.items.length === 0 && (
        <p className="py-10 text-center text-stone-500">No hay medios todavía. Sube el primero.</p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {(query.data?.items ?? []).map((m) => (
          <div key={m.id} className="rounded-lg border border-stone-200 bg-white p-2">
            <a href={m.url} target="_blank" rel="noreferrer">
              <MediaThumb item={m} />
            </a>
            <p className="mt-2 truncate text-xs font-medium" title={m.alt}>
              {m.alt || m.key.split('/').pop()}
            </p>
            <p className="text-xs text-stone-400">
              {m.mime} · {formatSize(m.size)}
            </p>
            <button
              onClick={() => {
                if (confirm('¿Eliminar este medio del bucket? Fallará si está en uso.')) {
                  deleteMutation.mutate(m.id)
                }
              }}
              className="mt-1 text-xs text-red-700 hover:underline"
            >
              Eliminar
            </button>
          </div>
        ))}
      </div>

      {(query.data?.pages ?? 1) > 1 && (
        <div className="mt-5 flex items-center justify-center gap-3 text-sm">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border px-2 py-1 disabled:opacity-40">
            ← Anterior
          </button>
          <span>
            {page} / {query.data?.pages}
          </span>
          <button
            disabled={page >= (query.data?.pages ?? 1)}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border px-2 py-1 disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  )
}
