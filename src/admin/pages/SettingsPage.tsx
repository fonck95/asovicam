/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type SettingsData } from '../api'
import { useToast } from '../components/Toast'

const EMPTY: SettingsData = {
  contact: { phone: '', email: '', address: '', whatsapp: '' },
  social: { facebook: '', instagram: '', youtube: '', tiktok: '', x: '' },
  hero: { badge: '', title: '', highlight: '', subtitle: '' },
  seo: { defaultTitle: '', defaultDescription: '' },
}

const SECTIONS: {
  key: keyof SettingsData
  title: string
  fields: { name: string; label: string; textarea?: boolean }[]
}[] = [
  {
    key: 'contact',
    title: 'Contacto',
    fields: [
      { name: 'phone', label: 'Teléfono' },
      { name: 'email', label: 'Correo' },
      { name: 'address', label: 'Ubicación' },
      { name: 'whatsapp', label: 'WhatsApp' },
    ],
  },
  {
    key: 'social',
    title: 'Redes sociales',
    fields: [
      { name: 'facebook', label: 'Facebook (URL)' },
      { name: 'instagram', label: 'Instagram (URL)' },
      { name: 'youtube', label: 'YouTube (URL)' },
      { name: 'tiktok', label: 'TikTok (URL)' },
      { name: 'x', label: 'X / Twitter (URL)' },
    ],
  },
  {
    key: 'hero',
    title: 'Hero del Home',
    fields: [
      { name: 'badge', label: 'Badge' },
      { name: 'title', label: 'Título' },
      { name: 'highlight', label: 'Resaltado' },
      { name: 'subtitle', label: 'Subtítulo', textarea: true },
    ],
  },
  {
    key: 'seo',
    title: 'SEO',
    fields: [
      { name: 'defaultTitle', label: 'Título por defecto' },
      { name: 'defaultDescription', label: 'Descripción por defecto', textarea: true },
    ],
  },
]

export function SettingsPage() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<SettingsData & { id: string }>('/api/admin/settings'),
  })
  const [form, setForm] = useState<SettingsData>(EMPTY)

  useEffect(() => {
    if (query.data) {
      setForm({
        contact: { ...EMPTY.contact, ...query.data.contact },
        social: { ...EMPTY.social, ...query.data.social },
        hero: { ...EMPTY.hero, ...query.data.hero },
        seo: { ...EMPTY.seo, ...query.data.seo },
      })
    }
  }, [query.data])

  const saveMutation = useMutation({
    mutationFn: (body: SettingsData) => api.put<SettingsData>('/api/admin/settings', body),
    onSuccess: () => {
      toast('success', 'Ajustes guardados')
      void queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: (err) => toast('error', err instanceof Error ? err.message : 'No se pudo guardar'),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    saveMutation.mutate(form)
  }

  if (query.isLoading) return <p className="py-10 text-center text-stone-500">Cargando…</p>
  if (query.isError) return <p className="py-10 text-center text-red-600">No se pudo cargar</p>

  return (
    <form onSubmit={submit} className="max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Ajustes del sitio</h1>
        <button
          type="submit"
          disabled={saveMutation.isPending}
          className="rounded bg-emerald-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {saveMutation.isPending ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
      <div className="flex flex-col gap-6">
        {SECTIONS.map((section) => (
          <fieldset key={section.key} className="rounded-lg border border-stone-200 bg-white p-4">
            <legend className="px-1 text-sm font-semibold text-emerald-800">{section.title}</legend>
            <div className="flex flex-col gap-3">
              {section.fields.map((f) => {
                const group = form[section.key] as Record<string, string>
                const setVal = (v: string) =>
                  setForm((prev) => ({
                    ...prev,
                    [section.key]: { ...(prev[section.key] as Record<string, string>), [f.name]: v },
                  }))
                return (
                  <label key={f.name} className="block">
                    <span className="mb-1 block text-sm font-medium text-stone-700">{f.label}</span>
                    {f.textarea ? (
                      <textarea
                        className="min-h-20 w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                        value={group[f.name] ?? ''}
                        onChange={(e) => setVal(e.target.value)}
                      />
                    ) : (
                      <input
                        className="w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                        value={group[f.name] ?? ''}
                        onChange={(e) => setVal(e.target.value)}
                      />
                    )}
                  </label>
                )
              })}
            </div>
          </fieldset>
        ))}
      </div>
    </form>
  )
}
