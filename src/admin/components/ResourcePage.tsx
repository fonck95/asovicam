import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, type MediaRefValue, type ResourceItem } from '../api'
import type { FieldDef, ResourceDef } from '../resources'
import { MediaPicker, MediaThumb } from './MediaPicker'
import { useToast } from './Toast'

function emptyForm(def: ResourceDef): Record<string, unknown> {
  const form: Record<string, unknown> = { published: true }
  for (const f of def.fields) {
    if (f.type === 'list') form[f.name] = []
    else if (f.type === 'media') form[f.name] = null
    else if (f.type === 'color') form[f.name] = '#059669'
    else form[f.name] = ''
  }
  return form
}

function toPayload(def: ResourceDef, form: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = { published: form.published === true }
  for (const f of def.fields) {
    const value = form[f.name]
    if (f.type === 'media') {
      const ref = value as MediaRefValue | null
      payload[f.name] = ref ? { mediaId: ref.mediaId, alt: ref.alt } : null
    } else if (f.type === 'list') {
      payload[f.name] = (value as string[]).map((s) => s.trim()).filter((s) => s.length > 0)
    } else if (typeof value === 'string' && value.trim() === '' && !f.required) {
      payload[f.name] = ''
    } else {
      payload[f.name] = value
    }
  }
  return payload
}

function Field({
  def,
  value,
  onChange,
}: {
  def: FieldDef
  value: unknown
  onChange: (v: unknown) => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const base =
    'w-full rounded border border-stone-300 px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none'

  if (def.type === 'textarea') {
    return (
      <textarea
        className={`${base} min-h-24`}
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        required={def.required}
      />
    )
  }
  if (def.type === 'select') {
    return (
      <select className={base} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} required={def.required}>
        <option value="" disabled>
          — elegir —
        </option>
        {def.options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    )
  }
  if (def.type === 'color') {
    return (
      <div className="flex items-center gap-2">
        <input type="color" value={(value as string) ?? '#059669'} onChange={(e) => onChange(e.target.value)} />
        <input className={`${base} w-32`} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
      </div>
    )
  }
  if (def.type === 'list') {
    return (
      <textarea
        className={`${base} min-h-24 font-mono`}
        value={((value as string[]) ?? []).join('\n')}
        onChange={(e) => onChange(e.target.value.split('\n'))}
        placeholder="Un elemento por línea"
      />
    )
  }
  if (def.type === 'media') {
    const ref = value as MediaRefValue | null
    return (
      <div className="flex items-center gap-3">
        {ref ? (
          <>
            <div className="w-24">
              <MediaThumb item={{ url: ref.url, alt: ref.alt, kind: 'image' }} size="h-16" />
            </div>
            <span className="max-w-40 truncate text-xs text-stone-500">{ref.alt}</span>
            <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => setPickerOpen(true)}>
              Cambiar
            </button>
            <button type="button" className="rounded border border-red-300 px-2 py-1 text-xs text-red-700" onClick={() => onChange(null)}>
              Quitar
            </button>
          </>
        ) : (
          <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => setPickerOpen(true)}>
            Elegir medio…
          </button>
        )}
        {pickerOpen && (
          <MediaPicker
            kinds={def.mediaKinds ?? ['image']}
            onClose={() => setPickerOpen(false)}
            onSelect={(v) => {
              onChange(v)
              setPickerOpen(false)
            }}
          />
        )}
      </div>
    )
  }
  return (
    <input
      className={base}
      value={(value as string) ?? ''}
      onChange={(e) => onChange(e.target.value)}
      required={def.required}
    />
  )
}

export function ResourcePage({ def }: { def: ResourceDef }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const listKey = ['resource', def.path]
  const query = useQuery({
    queryKey: listKey,
    queryFn: () => api.get<ResourceItem[]>(`/api/admin/${def.path}`),
  })

  const [editing, setEditing] = useState<ResourceItem | 'new' | null>(null)
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: listKey })
  const onError = (err: unknown) => {
    if (err instanceof ApiError && err.referencedBy) {
      toast('error', `${err.message}: ${err.referencedBy.map((r) => r.label).join(', ')}`)
    } else {
      toast('error', err instanceof Error ? err.message : 'Error inesperado')
    }
  }

  const saveMutation = useMutation({
    mutationFn: (payload: { id?: string; body: Record<string, unknown> }) =>
      payload.id
        ? api.put<ResourceItem>(`/api/admin/${def.path}/${payload.id}`, payload.body)
        : api.post<ResourceItem>(`/api/admin/${def.path}`, payload.body),
    onSuccess: () => {
      toast('success', 'Guardado')
      setEditing(null)
      void invalidate()
    },
    onError,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/api/admin/${def.path}/${id}`),
    onSuccess: () => {
      toast('success', 'Eliminado')
      void invalidate()
    },
    onError,
  })

  const togglePublished = useMutation({
    mutationFn: (item: ResourceItem) =>
      api.put<ResourceItem>(`/api/admin/${def.path}/${item.id}`, { published: !item.published }),
    onSuccess: () => void invalidate(),
    onError,
  })

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => api.patch<ResourceItem[]>(`/api/admin/${def.path}/reorder`, { ids }),
    onSuccess: (items) => queryClient.setQueryData(listKey, items),
    onError,
  })

  const items = useMemo(() => query.data ?? [], [query.data])

  const openEdit = (item: ResourceItem | 'new') => {
    setEditing(item)
    if (item === 'new') {
      setForm(emptyForm(def))
    } else {
      const f: Record<string, unknown> = { published: item.published }
      for (const field of def.fields) f[field.name] = item[field.name] ?? (field.type === 'list' ? [] : field.type === 'media' ? null : '')
      setForm(f)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    saveMutation.mutate({
      id: editing !== 'new' && editing ? editing.id : undefined,
      body: toPayload(def, form),
    })
  }

  const handleDrop = (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) return
    const ids = items.map((i) => i.id)
    const [moved] = ids.splice(dragIndex, 1)
    ids.splice(targetIndex, 0, moved!)
    setDragIndex(null)
    reorderMutation.mutate(ids)
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{def.title}</h1>
          {def.note && <p className="mt-1 text-sm text-amber-700">{def.note}</p>}
        </div>
        <button
          onClick={() => openEdit('new')}
          className="rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800"
        >
          + Nuevo {def.singular}
        </button>
      </div>

      {query.isLoading && <p className="py-10 text-center text-stone-500">Cargando…</p>}
      {query.isError && <p className="py-10 text-center text-red-600">No se pudo cargar la lista</p>}

      {query.isSuccess && (
        <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase text-stone-500">
              <tr>
                <th className="w-8 px-3 py-2" title="Arrastra para reordenar">⠿</th>
                {def.columns.map((c) => (
                  <th key={c.name} className="px-3 py-2">
                    {c.label}
                  </th>
                ))}
                <th className="px-3 py-2">Publicado</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr
                  key={item.id}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(index)}
                  className={`border-t border-stone-100 ${dragIndex === index ? 'opacity-40' : ''}`}
                >
                  <td className="cursor-grab px-3 py-2 text-stone-400">⠿</td>
                  {def.columns.map((c) => (
                    <td key={c.name} className="max-w-64 truncate px-3 py-2">
                      {String(item[c.name] ?? '')}
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <button
                      onClick={() => togglePublished.mutate(item)}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        item.published ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'
                      }`}
                    >
                      {item.published ? 'Publicado' : 'Borrador'}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => openEdit(item)} className="rounded px-2 py-1 text-emerald-700 hover:bg-emerald-50">
                      Editar
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`¿Eliminar este ${def.singular}? Esta acción no se puede deshacer.`)) {
                          deleteMutation.mutate(item.id)
                        }
                      }}
                      className="rounded px-2 py-1 text-red-700 hover:bg-red-50"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={def.columns.length + 3} className="px-3 py-8 text-center text-stone-500">
                    Sin elementos todavía
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing !== null && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditing(null)}>
          <form
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
          >
            <h2 className="mb-4 text-lg font-semibold">
              {editing === 'new' ? `Nuevo ${def.singular}` : `Editar ${def.singular}`}
            </h2>
            <div className="flex flex-col gap-3">
              {def.fields.map((f) => (
                <label key={f.name} className="block">
                  <span className="mb-1 block text-sm font-medium text-stone-700">
                    {f.label}
                    {f.required && <span className="text-red-600"> *</span>}
                    {f.help && <span className="ml-2 text-xs font-normal text-stone-400">{f.help}</span>}
                  </span>
                  <Field def={f} value={form[f.name]} onChange={(v) => setForm((prev) => ({ ...prev, [f.name]: v }))} />
                </label>
              ))}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.published === true}
                  onChange={(e) => setForm((prev) => ({ ...prev, published: e.target.checked }))}
                />
                Publicado
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="rounded border px-3 py-1.5 text-sm">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="rounded bg-emerald-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
              >
                {saveMutation.isPending ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
