import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError, type Agrupacion, type Asociado, type Asignacion, type EventoSorteo, type MapaPolygon, type SorteoAdmin } from '../api'
import { ParcelMap } from '../components/ParcelMap'
import { useToast } from '../components/Toast'

type DrawResult = { eventoId: string; asignaciones: Asignacion[]; idempotent: boolean }

const button = 'rounded border border-stone-300 bg-white px-3 py-2 text-sm hover:bg-stone-50 disabled:opacity-50'
const primary = 'rounded bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50'
const idOf = (value: Agrupacion['asociadoIds'][number]) => typeof value === 'string' ? value : value.id ?? value._id ?? ''
const dateTime = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' })

/** Solo el 409 de carrera y los fallos de red/503 admiten reintento con el MISMO requestId. */
function retryableWithSameRequest(error: unknown) {
  if (!(error instanceof ApiError)) return true // red / timeout: la idempotencia evita duplicados
  if (error.status === 0 || error.status === 503) return true
  return error.status === 409 && error.message.includes('cambió simultáneamente')
}

export function RafflePage() {
  const { raffleId } = useParams()
  const toast = useToast()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'individual' | 'agrupacion'>('individual')
  const [associateId, setAssociateId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [search, setSearch] = useState('')
  const [focus, setFocus] = useState<string[]>([])
  const [result, setResult] = useState<DrawResult | null>(null)
  // Un requestId por intento de asignación: se genera al pulsar "Sortear" y se
  // CONSERVA en reintentos de red y en el 409 de concurrencia; solo se limpia
  // al tener éxito, al cambiar la selección o ante un 409 definitivo.
  const requestId = useRef<string | null>(null)

  const raffle = useQuery({ queryKey: ['sorteo', raffleId], queryFn: () => api.get<SorteoAdmin>(`/api/admin/sorteos/${raffleId}`), enabled: !!raffleId })
  const groups = useQuery({ queryKey: ['agrupaciones'], queryFn: () => api.get<Agrupacion[]>('/api/admin/agrupaciones') })
  const associates = useQuery({ queryKey: ['asociados', 'export'], queryFn: () => api.get<Asociado[]>('/api/admin/asociados/export') })
  const refresh = async () => { await qc.invalidateQueries({ queryKey: ['sorteo', raffleId] }); await qc.invalidateQueries({ queryKey: ['sorteos'] }) }

  const draw = useMutation({
    mutationFn: () => {
      requestId.current ??= crypto.randomUUID()
      const body = tab === 'individual'
        ? { tipo: tab, asociadoId: associateId, requestId: requestId.current }
        : { tipo: tab, agrupacionId: groupId, requestId: requestId.current }
      return api.post<DrawResult>(`/api/admin/sorteos/${raffleId}/sortear`, body)
    },
    onSuccess: async (res) => {
      requestId.current = null
      setFocus(res.asignaciones.map((a) => a.polygonId))
      setResult(res)
      setAssociateId(''); setGroupId('')
      await refresh()
    },
    onError: async (error) => {
      toast('error', error instanceof Error ? error.message : 'No se pudo sortear')
      if (error instanceof ApiError && error.status === 404) {
        // Socio o agrupación ya no existen: refrescar selectores.
        requestId.current = null
        await qc.invalidateQueries({ queryKey: ['agrupaciones'] })
        await qc.invalidateQueries({ queryKey: ['asociados', 'export'] })
      }
      if (error instanceof ApiError && error.status === 409) {
        // Todo 409 deja el estado local obsoleto: recargar SIEMPRE. Solo el de
        // "cambió simultáneamente" permite reintentar con el mismo requestId.
        if (!retryableWithSameRequest(error)) requestId.current = null
        await refresh()
      }
    },
  })

  const undo = useMutation({
    mutationFn: (eventId: string) => api.del(`/api/admin/sorteos/${raffleId}/eventos/${eventId}`),
    onSuccess: async () => { setFocus([]); setResult(null); toast('success', 'Último evento deshecho'); await refresh() },
    onError: async (e) => { toast('error', e instanceof Error ? e.message : 'No se pudo deshacer'); if (e instanceof ApiError && e.status === 409) await refresh() },
  })

  const finish = useMutation({
    mutationFn: () => api.post(`/api/admin/sorteos/${raffleId}/finalizar`, {}),
    onSuccess: async () => { toast('success', 'Sorteo cerrado'); await refresh() },
    onError: async (e) => { toast('error', e instanceof Error ? e.message : 'No se pudo cerrar'); if (e instanceof ApiError && e.status === 409) await refresh() },
  })

  // ——— Estado derivado (§4 del SPEC): todo sale de GET /sorteos/:id ———
  const data = raffle.data
  const sorteados = useMemo(() => new Set(data?.asignaciones.map((a) => a.asociadoId) ?? []), [data])
  const byAssociate = useMemo(() => new Map((associates.data ?? []).map((a) => [a.id, a])), [associates.data])
  const byGroup = useMemo(() => new Map((groups.data ?? []).map((g) => [g.id, g])), [groups.data])
  const socioLabels = useMemo(() => new Map((associates.data ?? []).map((a) => [a.id, `${a.nombre} · ${a.cedula}`])), [associates.data])
  const grupoLabels = useMemo(() => new Map((groups.data ?? []).map((g) => [g.id, g.nombre])), [groups.data])
  const filteredAssociates = useMemo(() => {
    const q = search.trim().toLocaleLowerCase()
    const all = associates.data ?? []
    return q ? all.filter((a) => `${a.nombre} ${a.cedula}`.toLocaleLowerCase().includes(q)) : all
  }, [associates.data, search])

  if (raffle.isLoading) return <p className="py-12 text-center">Cargando sorteo…</p>
  if (raffle.isError && raffle.error instanceof ApiError && raffle.error.status === 404) {
    return <div className="rounded-lg border border-dashed p-10 text-center"><p className="text-lg font-medium">Sorteo no encontrado</p><Link to="/admin/mapas" className="mt-2 inline-block text-sm text-emerald-800 hover:underline">← Volver a mapas y sorteos</Link></div>
  }
  if (!data) return <p className="rounded bg-red-50 p-4 text-red-700">{raffle.error instanceof Error ? raffle.error.message : 'No se pudo cargar el sorteo.'}</p>

  const map = data.mapa ?? null
  // Sin mapa (borrado de la DB) el sorteo sigue siendo válido como acta: se
  // renderiza desde el snapshot de coordenadas de cada asignación.
  const snapshotPolygons: MapaPolygon[] = map
    ? map.poligonos
    : data.asignaciones.map((a) => ({ polygonId: a.polygonId, numero: a.numeroPoligono, coordenadas: a.coordenadas, vecinos: [] }))
  const active = data.estado === 'en_progreso' && !!map
  const total = map?.poligonos.length ?? data.asignaciones.length + data.poligonosDisponibles.length
  const asignados = data.asignaciones.length
  const restantes = data.poligonosDisponibles.length
  const selectedGroup = byGroup.get(groupId)
  const required = tab === 'individual' ? 1 : selectedGroup?.asociadoIds.length ?? 0
  const canDraw = active && required > 0 && required <= restantes && (tab === 'individual' ? !!associateId : !!groupId)
  // eventos ya viene en orden cronológico: el último del array es el único deshacible.
  const events = [...data.eventos].reverse()
  const lastEventId = data.eventos.at(-1)?.eventoId

  const groupReason = (g: Agrupacion) => {
    if (g.asociadoIds.some((m) => sorteados.has(idOf(m)))) return 'incluye socio ya sorteado'
    if (g.asociadoIds.length > restantes) return 'supera los lotes disponibles'
    return null
  }

  const exportCsv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
    const rows = data.asignaciones.map((a) => {
      const socio = byAssociate.get(a.asociadoId)
      return [a.asignacionId, a.eventoId, a.tipo, socio?.nombre ?? a.asociadoId, socio?.cedula ?? '', a.agrupacionId ? grupoLabels.get(a.agrupacionId) ?? a.agrupacionId : '', a.numeroPoligono, a.polygonId, a.sorteadoAt, a.sorteadoPor].map(esc).join(';')
    })
    // BOM para que Excel abra el UTF-8 con tildes correctas.
    const csv = '\ufeff' + ['asignacionId;eventoId;tipo;socio;cedula;agrupacion;lote;polygonId;sorteadoAt;sorteadoPor', ...rows].join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = Object.assign(document.createElement('a'), { href: url, download: `sorteo-${data.id}.csv` })
    link.click()
    URL.revokeObjectURL(url)
  }

  return <div>
    <Link to="/admin/mapas" className="text-sm text-emerald-800 hover:underline">← Mapas y sorteos</Link>

    {/* Cabecera: nombre, estado, progreso y ciclo de vida */}
    <div className="my-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">Sorteo · {map?.nombre ?? 'Mapa eliminado'}</h1>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${data.estado === 'completado' ? 'bg-stone-200 text-stone-700' : 'bg-emerald-100 text-emerald-800'}`}>{data.estado === 'completado' ? 'Completado' : 'En progreso'}</span>
        </div>
        <p className="mt-1 text-sm text-stone-500">Iniciado {dateTime.format(new Date(data.iniciadoAt))}{data.completadoAt ? ` · Completado ${dateTime.format(new Date(data.completadoAt))}` : ''}</p>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-2 w-48 overflow-hidden rounded bg-stone-200"><div className="h-full bg-emerald-600 transition-all" style={{ width: `${total ? Math.round((asignados / total) * 100) : 0}%` }} /></div>
          <span className="text-sm text-stone-600">{asignados} / {total} asignadas · {restantes} disponibles</span>
        </div>
      </div>
      <div className="flex gap-2">
        {asignados > 0 && <button className={button} onClick={exportCsv}>Exportar CSV</button>}
        {active && <button className={`${button} text-red-700`} disabled={finish.isPending} onClick={() => confirm('Cerrar el sorteo no permitirá más asignaciones (solo deshacer el último evento lo reabre). ¿Continuar?') && finish.mutate()}>Cerrar sorteo</button>}
      </div>
    </div>

    {!map && <p className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">El mapa original ya no existe en la base de datos. Las asignaciones se muestran desde su copia inmutable (snapshot) y no se pueden hacer nuevas asignaciones.</p>}

    <div className={`grid gap-5 ${active ? 'xl:grid-cols-[minmax(0,1.6fr)_minmax(20rem,1fr)]' : ''}`}>
      <ParcelMap polygons={snapshotPolygons} assignments={data.asignaciones} focusIds={focus} socioLabels={socioLabels} grupoLabels={grupoLabels} />

      {/* Zona de acción: solo mientras el sorteo está en progreso */}
      {active && <aside className="rounded-lg border bg-white p-4">
        <div className="mb-4 flex rounded bg-stone-100 p-1">
          <button onClick={() => { setTab('individual'); requestId.current = null }} className={`flex-1 rounded px-3 py-2 text-sm ${tab === 'individual' ? 'bg-white font-medium shadow-sm' : ''}`}>Individual</button>
          <button onClick={() => { setTab('agrupacion'); requestId.current = null }} className={`flex-1 rounded px-3 py-2 text-sm ${tab === 'agrupacion' ? 'bg-white font-medium shadow-sm' : ''}`}>Agrupación</button>
        </div>

        {tab === 'individual' ? <div>
          <label className="block text-sm font-medium">Buscar socio
            <input type="search" placeholder="Nombre o cédula…" value={search} onChange={(e) => setSearch(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
          </label>
          <label className="mt-2 block text-sm font-medium">Socio
            <select value={associateId} onChange={(e) => { setAssociateId(e.target.value); requestId.current = null }} className="mt-1 w-full rounded border px-3 py-2">
              <option value="">Seleccionar…</option>
              {filteredAssociates.map((a) => <option key={a.id} value={a.id} disabled={sorteados.has(a.id)}>{a.nombre} · {a.cedula}{sorteados.has(a.id) ? ' (ya sorteado)' : ''}</option>)}
            </select>
          </label>
        </div> : <div>
          <label className="block text-sm font-medium">Agrupación
            <select value={groupId} onChange={(e) => { setGroupId(e.target.value); requestId.current = null }} className="mt-1 w-full rounded border px-3 py-2">
              <option value="">Seleccionar…</option>
              {groups.data?.map((g) => { const reason = groupReason(g); return <option key={g.id} value={g.id} disabled={!!reason}>{g.nombre} · {g.asociadoIds.length} socios{reason ? ` (${reason})` : ''}</option> })}
            </select>
          </label>
          {selectedGroup && <ul className="mt-2 max-h-40 overflow-auto rounded border bg-stone-50 p-2 text-sm">
            {selectedGroup.asociadoIds.map((m) => {
              const id = idOf(m)
              const label = socioLabels.get(id) ?? (typeof m === 'string' ? `${m.slice(0, 8)}…` : `${m.nombre} · ${m.cedula}`)
              const done = sorteados.has(id)
              return <li key={id} className={`flex items-center justify-between px-1 py-0.5 ${done ? 'text-red-700' : 'text-stone-700'}`}><span>{label}</span>{done && <span className="text-xs">ya sorteado</span>}</li>
            })}
          </ul>}
          <p className="mt-2 text-xs text-stone-500">El grupo necesita un bloque de lotes contiguos del tamaño exacto de la agrupación; si el mapa no tiene un bloque conexo suficiente, el sorteo lo rechazará.</p>
        </div>}

        <div className="my-4 rounded bg-stone-50 p-3 text-sm">
          <div className="flex justify-between"><span>Quedan lotes disponibles</span><strong>{restantes}</strong></div>
          <div className="mt-1 flex justify-between"><span>Esta acción asigna</span><strong>{required || '—'}</strong></div>
          {required > restantes && <p className="mt-2 text-xs text-red-700">No hay suficientes lotes disponibles.</p>}
        </div>

        <button className={`${primary} w-full`} disabled={!canDraw || draw.isPending} onClick={() => confirm(`Se asignarán ${required} lote(s) al azar. ¿Continuar?`) && draw.mutate()}>{draw.isPending ? 'Sorteando…' : 'Sortear'}</button>
        {draw.isError && retryableWithSameRequest(draw.error) && <button className={`${button} mt-2 w-full`} disabled={draw.isPending} onClick={() => draw.mutate()}>Reintentar la misma solicitud</button>}
        <p className="mt-3 text-xs text-stone-400">El servidor elige los lotes al azar; el resultado que devuelve es la única fuente de verdad.</p>
      </aside>}
    </div>

    {/* Historial: orden cronológico inverso; solo el último evento es deshacible */}
    <section className="mt-6">
      <h2 className="mb-3 text-lg font-semibold">Historial</h2>
      {events.length === 0 && <p className="rounded border border-dashed p-8 text-center text-stone-500">Aún no hay asignaciones.</p>}
      <div className="space-y-3">
        {events.map((event) => <EventRow key={event.eventoId} event={event} data={data} byAssociate={byAssociate} grupoLabels={grupoLabels}
          undoable={event.eventoId === lastEventId && !!map}
          undoPending={undo.isPending}
          onUndo={() => {
            const parts = [event.tipo === 'agrupacion' ? 'Se revertirán las asignaciones de TODOS los socios del bloque.' : 'Se revertirá esta asignación.']
            if (data.estado === 'completado') parts.push('El sorteo se reabrirá (volverá a "en progreso").')
            if (confirm(`${parts.join(' ')} ¿Continuar?`)) undo.mutate(event.eventoId)
          }} />)}
      </div>
    </section>

    {/* Resultado del último clic de "Sortear" */}
    {result && <div className="fixed inset-0 z-[1000] grid place-items-center bg-black/45 p-4" onMouseDown={(e) => e.target === e.currentTarget && setResult(null)}>
      <section className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
        <div className="mb-3 flex justify-between"><h2 className="text-lg font-semibold">🎉 Resultado del sorteo</h2><button onClick={() => setResult(null)} aria-label="Cerrar">✕</button></div>
        {result.idempotent && <p className="mb-3 rounded bg-amber-50 p-2 text-xs text-amber-800">Esta solicitud ya había sido procesada: se muestra el resultado original (no se duplicó ninguna asignación).</p>}
        <ul className="space-y-2">
          {result.asignaciones.map((a) => <li key={a.asignacionId} className="rounded border bg-stone-50 p-3 text-sm">
            <strong className="text-base">Lote {a.numeroPoligono}</strong> → {socioLabels.get(a.asociadoId) ?? `${a.asociadoId.slice(0, 8)}…`}
            <p className="mt-1 break-all text-xs text-stone-500">Comprobante: {a.asignacionId}</p>
          </li>)}
        </ul>
        <button className={`${primary} mt-4 w-full`} onClick={() => setResult(null)}>Aceptar</button>
      </section>
    </div>}
  </div>
}

function EventRow({ event, data, byAssociate, grupoLabels, undoable, undoPending, onUndo }: {
  event: EventoSorteo
  data: SorteoAdmin
  byAssociate: Map<string, Asociado>
  grupoLabels: Map<string, string>
  undoable: boolean
  undoPending: boolean
  onUndo: () => void
}) {
  const assignments = data.asignaciones.filter((a) => a.eventoId === event.eventoId)
  const title = event.tipo === 'individual' ? 'Asignación individual' : `Agrupación · ${grupoLabels.get(event.agrupacionId ?? '') ?? 'sin nombre'}`
  return <article className="rounded-lg border bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <strong>{title}</strong>
        <p className="text-xs text-stone-400">{dateTime.format(new Date(event.creadoAt))} · {event.polygonIds.length} lote(s) · Evento {event.eventoId}</p>
      </div>
      {undoable && <button className={`${button} text-red-700`} disabled={undoPending} onClick={onUndo}>Deshacer</button>}
    </div>
    <div className="mt-3 grid gap-2 md:grid-cols-2">
      {assignments.map((a) => {
        const socio = byAssociate.get(a.asociadoId)
        return <div key={a.asignacionId} className="rounded bg-stone-50 p-3 text-sm">
          <strong>Lote {a.numeroPoligono}</strong> · {socio ? `${socio.nombre} · ${socio.cedula}` : <span title={a.asociadoId}>{a.asociadoId.slice(0, 8)}… (socio eliminado)</span>}
          <p className="mt-1 text-xs text-stone-500">{dateTime.format(new Date(a.sorteadoAt))} · por {a.sorteadoPor}</p>
          <p className="break-all text-xs text-stone-500">Comprobante: {a.asignacionId}</p>
        </div>
      })}
    </div>
  </article>
}
