import { useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError, uploadBinary, type Mapa, type SorteoAdmin } from '../api'
import { useToast } from '../components/Toast'
import { ParcelMap } from '../components/ParcelMap'

const button = 'rounded border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50'
const primary = 'rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50'

export function MapsPage() {
  const toast = useToast()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [dialog, setDialog] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [progress, setProgress] = useState(0)
  const maps = useQuery({ queryKey: ['mapas'], queryFn: () => api.get<Mapa[]>('/api/admin/mapas') })
  const raffles = useQuery({ queryKey: ['sorteos'], queryFn: () => api.get<SorteoAdmin[]>('/api/admin/sorteos') })
  const upload = useMutation({
    mutationFn: async () => {
      if (!file || !name.trim()) throw new Error('Selecciona el archivo y escribe un nombre')
      setProgress(1)
      const qs = new URLSearchParams({ nombre: name.trim(), descripcion: description.trim(), filename: file.name })
      const kmz = file.name.toLowerCase().endsWith('.kmz')
      return uploadBinary<Mapa>(`/api/admin/mapas/importar?${qs}`, file, kmz ? 'application/vnd.google-earth.kmz' : 'application/vnd.google-earth.kml+xml', setProgress)
    },
    onSuccess: (map) => {
      toast('success', `${map.poligonos.length} polígonos importados`); setDialog(false); setFile(null); setProgress(0)
      void qc.invalidateQueries({ queryKey: ['mapas'] })
    },
    onError: (error) => toast('error', error instanceof Error ? error.message : 'No se pudo importar'),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/admin/mapas/${id}`),
    onSuccess: () => { toast('success', 'Mapa eliminado'); void qc.invalidateQueries({ queryKey: ['mapas'] }) },
    onError: (e) => toast('error', message(e)),
  })
  const raffleByMap = new Map((raffles.data ?? []).map((s) => [s.mapaId, s]))

  return <div>
    <div className="mb-5 flex items-center justify-between gap-3"><div><h1 className="text-xl font-semibold">Mapas y sorteos</h1><p className="text-sm text-stone-500">Importa, revisa y asigna las parcelas.</p></div><button className={primary} onClick={() => setDialog(true)}>+ Cargar KML/KMZ</button></div>
    {maps.isLoading && <p className="py-12 text-center text-stone-500">Cargando…</p>}
    {maps.isError && <ErrorText error={maps.error} />}
    <div className="grid gap-4 xl:grid-cols-2">{maps.data?.map((map) => {
      const raffle = raffleByMap.get(map.id)
      const assigned = raffle?.asignaciones.length ?? 0
      return <article key={map.id} className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex justify-between gap-4"><div><h2 className="font-semibold text-stone-900">{map.nombre}</h2><p className="mt-1 line-clamp-2 text-sm text-stone-500">{map.descripcion || 'Sin descripción'}</p></div><Status value={map.estado === 'borrador' ? 'Borrador' : raffle?.estado === 'completado' ? 'Completado' : 'En progreso'} /></div>
        <div className="my-4 grid grid-cols-3 gap-2 text-center"><Metric label="Polígonos" value={map.poligonos.length} /><Metric label="Asignados" value={assigned} /><Metric label="Disponibles" value={raffle?.poligonosDisponibles.length ?? map.poligonos.length} /></div>
        <p className="mb-3 text-xs text-stone-400">Actualizado {formatDate(map.updatedAt)}</p>
        <div className="flex flex-wrap gap-2"><Link className={button} to={`/admin/mapas/${map.id}`}>{map.estado === 'borrador' ? 'Vista previa' : 'Ver mapa'}</Link>{map.estado === 'finalizado' && map.sorteoId && <Link className={primary} to={`/admin/sorteos/${map.sorteoId}`}>Abrir sorteo</Link>}{map.estado === 'borrador' && <button className={`${button} text-red-700`} onClick={() => confirm('¿Eliminar este mapa borrador?') && remove.mutate(map.id)}>Eliminar</button>}</div>
      </article>
    })}</div>
    {maps.data?.length === 0 && <div className="rounded-lg border border-dashed border-stone-300 py-16 text-center text-stone-500">Aún no hay mapas. Carga un archivo KML o KMZ para comenzar.</div>}
    {dialog && <Modal title="Cargar mapa parcelario" close={() => !upload.isPending && setDialog(false)}><form onSubmit={(e) => { e.preventDefault(); upload.mutate() }} className="space-y-4">
      <label className="block text-sm font-medium">Nombre *<input autoFocus maxLength={200} value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded border border-stone-300 px-3 py-2" /></label>
      <label className="block text-sm font-medium">Descripción<textarea maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full rounded border border-stone-300 px-3 py-2" /></label>
      <input ref={fileRef} type="file" accept=".kml,.kmz,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz" onChange={(e) => { const next = e.target.files?.[0] ?? null; setFile(next); if (next && !name) setName(next.name.replace(/\.(kml|kmz)$/i, '')) }} className="block w-full text-sm" />
      {upload.isPending && <div><div className="h-2 overflow-hidden rounded bg-stone-200"><div className="h-full bg-emerald-600 transition-all" style={{ width: `${progress}%` }} /></div><p className="mt-1 text-xs text-stone-500">Leyendo y subiendo… {progress}%</p></div>}
      <div className="flex justify-end gap-2"><button type="button" className={button} onClick={() => setDialog(false)} disabled={upload.isPending}>Cancelar</button><button className={primary} disabled={!file || !name.trim() || upload.isPending}>{upload.isPending ? 'Importando…' : 'Importar'}</button></div>
    </form></Modal>}
  </div>
}

export function MapDetailPage() {
  const { mapId } = useParams(); const navigate = useNavigate(); const toast = useToast(); const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const query = useQuery({ queryKey: ['mapa', mapId], queryFn: () => api.get<Mapa>(`/api/admin/mapas/${mapId}`), enabled: !!mapId })
  const finalize = useMutation({
    mutationFn: () => api.post<{ mapa: Mapa; sorteo: SorteoAdmin }>(`/api/admin/mapas/${mapId}/finalizar`, {}),
    onSuccess: ({ sorteo }) => { toast('success', 'Mapa finalizado; el sorteo está listo'); void qc.invalidateQueries({ queryKey: ['mapas'] }); void qc.invalidateQueries({ queryKey: ['mapa', mapId] }); navigate(`/admin/sorteos/${sorteo.id}`) },
    onError: (e) => {
      toast('error', message(e))
      // "Ya finalizado" / "ya tiene un sorteo" incluyen sorteoId: navegar directo.
      const sorteoId = e instanceof ApiError && e.status === 409 ? e.body?.sorteoId : undefined
      if (typeof sorteoId === 'string') {
        void qc.invalidateQueries({ queryKey: ['mapas'] })
        navigate(`/admin/sorteos/${sorteoId}`)
      }
    },
  })
  const update = useMutation({
    mutationFn: (form: { nombre: string; descripcion: string }) => api.put<Mapa>(`/api/admin/mapas/${mapId}`, form),
    onSuccess: () => { toast('success', 'Mapa actualizado'); setEditing(false); void qc.invalidateQueries({ queryKey: ['mapa', mapId] }); void qc.invalidateQueries({ queryKey: ['mapas'] }) },
    onError: (e) => toast('error', message(e)),
  })
  if (query.isLoading) return <p className="py-12 text-center">Cargando…</p>
  if (!query.data) return <ErrorText error={query.error} />
  const map = query.data
  const numbers = map.poligonos.map((p) => p.numero.trim()); const missing = numbers.filter((n) => !n).length; const duplicate = [...new Set(numbers.filter((n, i) => n && numbers.indexOf(n) !== i))]
  // Diagnóstico de contigüidad: vecinos se calcula al finalizar; un lote sin
  // vecinos nunca podrá formar parte de un bloque grupal.
  const isolated = map.estado === 'finalizado' ? map.poligonos.filter((p) => p.vecinos.length === 0).length : 0
  return <div><Link to="/admin/mapas" className="text-sm text-emerald-800 hover:underline">← Mapas y sorteos</Link><div className="my-4 flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-xl font-semibold">{map.nombre}</h1><p className="text-sm text-stone-500">{map.descripcion}</p></div><div className="flex gap-2">{map.estado === 'borrador' ? <><button className={button} onClick={() => setEditing(true)}>Editar</button><button className={primary} disabled={finalize.isPending} onClick={() => confirm('Finalizar es irreversible: se bloqueará la geometría, se calcularán los vecinos y se creará el sorteo. ¿Continuar?') && finalize.mutate()}>{finalize.isPending ? 'Finalizando…' : 'Finalizar mapa'}</button></> : map.sorteoId && <Link className={primary} to={`/admin/sorteos/${map.sorteoId}`}>Abrir sorteo</Link>}</div></div>
    {map.estado === 'borrador' && <div className={`mb-4 rounded-lg border p-3 text-sm ${missing || duplicate.length ? 'border-amber-300 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}><strong>Revisión:</strong> {map.poligonos.length} polígonos · {missing} sin número · {duplicate.length ? `duplicados: ${duplicate.join(', ')}` : 'sin números duplicados'}. Los vecinos (contigüidad para sorteos grupales) se calculan al finalizar: dos lotes solo son vecinos si comparten una arista exacta.</div>}
    {isolated > 0 && <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm"><strong>Aviso:</strong> {isolated} polígono(s) quedaron sin vecinos (no comparten aristas exactas con ningún otro). Los sorteos de agrupaciones no podrán incluirlos en bloques contiguos.</div>}
    <ParcelMap polygons={map.poligonos} />
    {editing && <Modal title="Editar mapa" close={() => !update.isPending && setEditing(false)}><MapEditForm map={map} pending={update.isPending} onSave={(form) => update.mutate(form)} onCancel={() => setEditing(false)} /></Modal>}
  </div>
}

function MapEditForm({ map, pending, onSave, onCancel }: { map: Mapa; pending: boolean; onSave: (f: { nombre: string; descripcion: string }) => void; onCancel: () => void }) {
  const [nombre, setNombre] = useState(map.nombre)
  const [descripcion, setDescripcion] = useState(map.descripcion)
  return <form onSubmit={(e) => { e.preventDefault(); if (nombre.trim()) onSave({ nombre: nombre.trim(), descripcion: descripcion.trim() }) }} className="space-y-4">
    <label className="block text-sm font-medium">Nombre *<input autoFocus required maxLength={200} value={nombre} onChange={(e) => setNombre(e.target.value)} className="mt-1 w-full rounded border border-stone-300 px-3 py-2" /></label>
    <label className="block text-sm font-medium">Descripción<textarea maxLength={2000} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="mt-1 w-full rounded border border-stone-300 px-3 py-2" /></label>
    <div className="flex justify-end gap-2"><button type="button" className={button} onClick={onCancel} disabled={pending}>Cancelar</button><button className={primary} disabled={pending || !nombre.trim()}>{pending ? 'Guardando…' : 'Guardar'}</button></div>
  </form>
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded bg-stone-50 p-2"><strong className="block text-lg">{value}</strong><span className="text-xs text-stone-500">{label}</span></div> }
function Status({ value }: { value: string }) { return <span className="h-fit rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800">{value}</span> }
function formatDate(value: string) { return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(value)) }
function message(error: unknown) { if (error instanceof ApiError) return error.message; return error instanceof Error ? error.message : 'Error inesperado' }
function ErrorText({ error }: { error: unknown }) { return <p className="rounded bg-red-50 p-4 text-sm text-red-700">{message(error)}</p> }
function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) { return <div className="fixed inset-0 z-[1000] grid place-items-center bg-black/45 p-4" onMouseDown={(e) => e.target === e.currentTarget && close()}><section className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl"><div className="mb-4 flex justify-between"><h2 className="text-lg font-semibold">{title}</h2><button onClick={close} aria-label="Cerrar">✕</button></div>{children}</section></div> }
