import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, uploadMedia, type MediaItem, type MediaRefValue } from '../api'
import { useToast } from './Toast'

interface Props {
  kinds: ('image' | 'document' | 'video')[]
  onSelect: (value: MediaRefValue) => void
  onClose: () => void
}

export function MediaThumb({ item, size = 'h-24' }: { item: { url: string; alt?: string; kind?: string; mime?: string }; size?: string }) {
  if (item.kind === 'image' || item.mime?.startsWith('image/')) {
    return <img src={item.url} alt={item.alt ?? ''} className={`${size} w-full rounded object-cover`} loading="lazy" />
  }
  return (
    <div className={`${size} flex w-full items-center justify-center rounded bg-stone-200 text-3xl`}>
      {item.kind === 'video' || item.mime?.startsWith('video/') ? '🎬' : '📄'}
    </div>
  )
}

export function UploadButton({
  accept,
  onUploaded,
}: {
  accept: string
  onUploaded: (item: MediaItem) => void
}) {
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [alt, setAlt] = useState('')
  const [busy, setBusy] = useState(false)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    if (file.type.startsWith('image/') && alt.trim().length === 0) {
      toast('error', 'Escribe el texto alternativo (alt) antes de subir una imagen')
      return
    }
    setBusy(true)
    try {
      const item = await uploadMedia(file, alt.trim())
      toast('success', 'Archivo subido')
      setAlt('')
      onUploaded(item)
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Fallo la subida')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        value={alt}
        onChange={(e) => setAlt(e.target.value)}
        placeholder="Texto alternativo (obligatorio para imágenes)"
        className="w-72 rounded border border-stone-300 px-2 py-1.5 text-sm"
      />
      <label className={`cursor-pointer rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 ${busy ? 'pointer-events-none opacity-60' : ''}`}>
        {busy ? 'Subiendo…' : 'Subir archivo'}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
      </label>
    </div>
  )
}

const ACCEPT: Record<string, string> = {
  image: 'image/jpeg,image/png,image/webp,image/avif',
  document: 'application/pdf',
  video: 'video/mp4',
}

export function MediaPicker({ kinds, onSelect, onClose }: Props) {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const kindFilter = kinds.length === 1 ? kinds[0] : undefined
  const query = useQuery({
    queryKey: ['media', kindFilter ?? 'all', page],
    queryFn: () =>
      api.get<{ items: MediaItem[]; total: number; pages: number }>(
        `/api/admin/media?page=${page}&limit=24${kindFilter ? `&kind=${kindFilter}` : ''}`,
      ),
  })
  const accept = kinds.map((k) => ACCEPT[k]).join(',')
  const items = (query.data?.items ?? []).filter((m) => kinds.includes(m.kind))

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Seleccionar medio</h2>
          <button onClick={onClose} className="rounded px-2 py-1 text-stone-500 hover:bg-stone-100">✕</button>
        </div>
        <div className="mb-4">
          <UploadButton
            accept={accept}
            onUploaded={(item) => {
              void queryClient.invalidateQueries({ queryKey: ['media'] })
              onSelect({ mediaId: item.id, url: item.url, alt: item.alt })
            }}
          />
        </div>
        {query.isLoading && <p className="py-8 text-center text-stone-500">Cargando…</p>}
        {query.isError && <p className="py-8 text-center text-red-600">No se pudo cargar la lista</p>}
        {items.length === 0 && query.isSuccess && (
          <p className="py-8 text-center text-stone-500">No hay medios de este tipo todavía. Sube el primero.</p>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {items.map((m) => (
            <button
              key={m.id}
              className="rounded-lg border border-stone-200 p-2 text-left hover:border-emerald-600 hover:shadow"
              onClick={() => onSelect({ mediaId: m.id, url: m.url, alt: m.alt })}
            >
              <MediaThumb item={m} />
              <p className="mt-1 truncate text-xs text-stone-600">{m.alt || m.key.split('/').pop()}</p>
            </button>
          ))}
        </div>
        {(query.data?.pages ?? 1) > 1 && (
          <div className="mt-4 flex items-center justify-center gap-3 text-sm">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded border px-2 py-1 disabled:opacity-40"
            >
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
    </div>
  )
}
