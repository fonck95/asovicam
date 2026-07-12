import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError, type Agrupacion, type Asociado, type Asignacion, type SorteoAdmin } from '../api'
import { ParcelMap } from '../components/ParcelMap'
import { useToast } from '../components/Toast'

type DrawResult = { eventoId: string; asignaciones: Asignacion[]; idempotent: boolean }
const button = 'rounded border border-stone-300 bg-white px-3 py-2 text-sm hover:bg-stone-50 disabled:opacity-50'
const primary = 'rounded bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50'
const idOf = (value: Agrupacion['asociadoIds'][number]) => typeof value === 'string' ? value : value.id ?? value._id ?? ''

export function RafflePage() {
  const { raffleId } = useParams(); const toast = useToast(); const qc = useQueryClient()
  const [tab, setTab] = useState<'individual' | 'agrupacion'>('individual'); const [associateId, setAssociateId] = useState(''); const [groupId, setGroupId] = useState(''); const [focus, setFocus] = useState<string[]>([])
  const requestId = useRef<string | null>(null)
  const raffle = useQuery({ queryKey: ['sorteo', raffleId], queryFn: () => api.get<SorteoAdmin>(`/api/admin/sorteos/${raffleId}`), enabled: !!raffleId })
  const groups = useQuery({ queryKey: ['agrupaciones'], queryFn: () => api.get<Agrupacion[]>('/api/admin/agrupaciones') })
  const associates = useQuery({ queryKey: ['asociados', 'export'], queryFn: () => api.get<Asociado[]>('/api/admin/asociados/export') })
  const refresh = async () => { await qc.invalidateQueries({ queryKey: ['sorteo', raffleId] }); await qc.invalidateQueries({ queryKey: ['sorteos'] }) }
  const draw = useMutation({
    mutationFn: () => {
      requestId.current ??= crypto.randomUUID()
      const body = tab === 'individual' ? { tipo: tab, asociadoId: associateId, requestId: requestId.current } : { tipo: tab, agrupacionId: groupId, requestId: requestId.current }
      return api.post<DrawResult>(`/api/admin/sorteos/${raffleId}/sortear`, body)
    },
    onSuccess: async (result) => { requestId.current = null; setFocus(result.asignaciones.map((a) => a.polygonId)); toast('success', result.idempotent ? 'La asignación ya había sido procesada' : `${result.asignaciones.length} parcela(s) asignada(s)`); await refresh() },
    onError: async (error) => { toast('error', error instanceof Error ? error.message : 'No se pudo sortear'); if (error instanceof ApiError && error.status === 409) { requestId.current = null; await refresh() } },
  })
  const undo = useMutation({ mutationFn: (eventId: string) => api.del(`/api/admin/sorteos/${raffleId}/eventos/${eventId}`), onSuccess: async () => { setFocus([]); toast('success', 'Último evento deshecho'); await refresh() }, onError: (e) => toast('error', e instanceof Error ? e.message : 'No se pudo deshacer') })
  const finish = useMutation({ mutationFn: () => api.post(`/api/admin/sorteos/${raffleId}/finalizar`, {}), onSuccess: async () => { toast('success', 'Sorteo cerrado'); await refresh() }, onError: (e) => toast('error', e instanceof Error ? e.message : 'No se pudo cerrar') })
  const assignedIds = useMemo(() => new Set(raffle.data?.asignaciones.map((a) => a.asociadoId) ?? []), [raffle.data])
  if (raffle.isLoading) return <p className="py-12 text-center">Cargando sorteo…</p>
  if (!raffle.data?.mapa) return <p className="rounded bg-red-50 p-4 text-red-700">{raffle.error instanceof Error ? raffle.error.message : 'El sorteo no incluye su mapa.'}</p>
  const data = raffle.data; const map = data.mapa!; const active = data.estado === 'en_progreso'; const selectedGroup = groups.data?.find((g) => g.id === groupId); const required = tab === 'individual' ? 1 : selectedGroup?.asociadoIds.length ?? 0
  const canDraw = active && required > 0 && required <= data.poligonosDisponibles.length && (tab === 'individual' ? !!associateId : !!groupId)
  const byAssociate = new Map((associates.data ?? []).map((a) => [a.id, a])); const byGroup = new Map((groups.data ?? []).map((g) => [g.id, g]))
  const events = [...data.eventos].sort((a, b) => +new Date(b.creadoAt) - +new Date(a.creadoAt))
  return <div><Link to="/admin/mapas" className="text-sm text-emerald-800 hover:underline">← Mapas y sorteos</Link><div className="my-4 flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-xl font-semibold">Sorteo · {map.nombre}</h1><p className="text-sm text-stone-500">{data.poligonosDisponibles.length} disponibles · {data.asignaciones.length} asignadas · {data.estado === 'completado' ? 'Completado' : 'En progreso'}</p></div>{active && <button className={`${button} text-red-700`} disabled={finish.isPending} onClick={() => confirm('Cerrar el sorteo es irreversible y ya no permitirá asignaciones. ¿Continuar?') && finish.mutate()}>Cerrar sorteo</button>}</div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(20rem,1fr)]"><ParcelMap polygons={map.poligonos} assignments={data.asignaciones} focusIds={focus} /><aside className="rounded-lg border bg-white p-4"><div className="mb-4 flex rounded bg-stone-100 p-1"><button onClick={() => setTab('individual')} className={`flex-1 rounded px-3 py-2 text-sm ${tab === 'individual' ? 'bg-white font-medium shadow-sm' : ''}`}>Individual</button><button onClick={() => setTab('agrupacion')} className={`flex-1 rounded px-3 py-2 text-sm ${tab === 'agrupacion' ? 'bg-white font-medium shadow-sm' : ''}`}>Agrupación</button></div>
      {tab === 'individual' ? <label className="block text-sm font-medium">Socio<select value={associateId} onChange={(e) => { setAssociateId(e.target.value); requestId.current = null }} className="mt-1 w-full rounded border px-3 py-2"><option value="">Seleccionar…</option>{associates.data?.map((a) => <option key={a.id} value={a.id} disabled={assignedIds.has(a.id)}>{a.nombre} · {a.cedula}{assignedIds.has(a.id) ? ' (ya sorteado)' : ''}</option>)}</select></label> : <label className="block text-sm font-medium">Agrupación<select value={groupId} onChange={(e) => { setGroupId(e.target.value); requestId.current = null }} className="mt-1 w-full rounded border px-3 py-2"><option value="">Seleccionar…</option>{groups.data?.map((g) => { const unavailable = g.asociadoIds.some((id) => assignedIds.has(idOf(id))); return <option key={g.id} value={g.id} disabled={unavailable}>{g.nombre} · {g.asociadoIds.length} socios{unavailable ? ' (incluye socio sorteado)' : ''}</option> })}</select></label>}
      <div className="my-4 rounded bg-stone-50 p-3 text-sm"><div className="flex justify-between"><span>Parcelas disponibles</span><strong>{data.poligonosDisponibles.length}</strong></div><div className="mt-1 flex justify-between"><span>Tamaño requerido</span><strong>{required || '—'}</strong></div>{required > data.poligonosDisponibles.length && <p className="mt-2 text-xs text-red-700">No hay suficientes parcelas disponibles.</p>}</div>
      <button className={`${primary} w-full`} disabled={!canDraw || draw.isPending} onClick={() => confirm(`Se asignarán ${required} parcela(s) al azar. ¿Continuar?`) && draw.mutate()}>{draw.isPending ? 'Sorteando…' : active ? 'Realizar sorteo' : 'Sorteo cerrado'}</button>{draw.isError && !(draw.error instanceof ApiError && draw.error.status === 409) && <button className={`${button} mt-2 w-full`} onClick={() => draw.mutate()}>Reintentar la misma solicitud</button>}
    </aside></div>
    <section className="mt-6"><h2 className="mb-3 text-lg font-semibold">Historial</h2>{events.length === 0 && <p className="rounded border border-dashed p-8 text-center text-stone-500">Aún no hay asignaciones.</p>}<div className="space-y-3">{events.map((event, index) => { const assignments = data.asignaciones.filter((a) => a.eventoId === event.eventoId); return <article key={event.eventoId} className="rounded-lg border bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><strong>{event.tipo === 'individual' ? 'Asignación individual' : byGroup.get(event.agrupacionId ?? '')?.nombre ?? 'Asignación grupal'}</strong><p className="text-xs text-stone-400">{new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.creadoAt))} · Evento {event.eventoId}</p></div>{index === 0 && active && <button className={`${button} text-red-700`} disabled={undo.isPending} onClick={() => confirm('Se revertirán todas las asignaciones de este evento. ¿Continuar?') && undo.mutate(event.eventoId)}>Deshacer</button>}</div><div className="mt-3 grid gap-2 md:grid-cols-2">{assignments.map((a) => <div key={a.asignacionId} className="rounded bg-stone-50 p-3 text-sm"><strong>{a.numeroPoligono}</strong> · {byAssociate.get(a.asociadoId)?.nombre ?? a.asociadoId}<p className="mt-1 break-all text-xs text-stone-500">Asignación: {a.asignacionId}</p><details className="mt-1 text-xs text-stone-500"><summary className="cursor-pointer">Coordenadas</summary><pre className="mt-1 max-h-32 overflow-auto">{JSON.stringify(a.coordenadas, null, 2)}</pre></details></div>)}</div></article> })}</div></section>
  </div>
}
