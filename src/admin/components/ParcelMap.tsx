import { useEffect, useRef } from 'react'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Asignacion, MapaPolygon } from '../api'

/** Verde fijo para asignaciones individuales; paleta cíclica por evento grupal. */
const INDIVIDUAL_COLOR = '#059669'
const GROUP_COLORS = ['#2563eb', '#7c3aed', '#db2777', '#d97706', '#0891b2', '#4f46e5', '#b91c1c', '#65a30d']

const dateFormat = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' })

export function ParcelMap({
  polygons,
  assignments = [],
  focusIds = [],
  socioLabels,
  grupoLabels,
}: {
  polygons: MapaPolygon[]
  assignments?: Asignacion[]
  focusIds?: string[]
  /** asociadoId → "Nombre · cédula" para el tooltip. */
  socioLabels?: Map<string, string>
  /** agrupacionId → nombre para el tooltip. */
  grupoLabels?: Map<string, string>
}) {
  const host = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!host.current || polygons.length === 0) return
    const instance = L.map(host.current, { zoomSnap: 0.5 })
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Imágenes © Esri', maxZoom: 19, maxNativeZoom: 18,
    }).addTo(instance)
    const byPolygon = new Map(assignments.map((a) => [a.polygonId, a]))
    const eventColors = new Map<string, string>()
    const layers = polygons.map((polygon) => {
      const assignment = byPolygon.get(polygon.polygonId)
      let color = '#78716c'
      if (assignment) {
        if (assignment.tipo === 'individual') {
          color = INDIVIDUAL_COLOR
        } else {
          // Un color por eventoId para que el bloque grupal se lea como unidad.
          if (!eventColors.has(assignment.eventoId)) eventColors.set(assignment.eventoId, GROUP_COLORS[eventColors.size % GROUP_COLORS.length]!)
          color = eventColors.get(assignment.eventoId)!
        }
      }
      const focused = focusIds.includes(polygon.polygonId)
      const layer = L.polygon(
        // coordenadas = [anillo exterior, ...huecos]; Leaflet usa [lat, lng].
        polygon.coordenadas.map((ring) => ring.map(({ lat, lng }) => [lat, lng] as L.LatLngTuple)),
        { color: focused ? '#facc15' : color, weight: focused ? 4 : 2, fillColor: color, fillOpacity: assignment ? 0.58 : 0.2 },
      ).addTo(instance)
      let detail = '<br>Disponible'
      if (assignment) {
        const socio = socioLabels?.get(assignment.asociadoId) ?? `${assignment.asociadoId.slice(0, 8)}…`
        const grupo = assignment.agrupacionId
          ? grupoLabels?.get(assignment.agrupacionId) ?? `${assignment.agrupacionId.slice(0, 8)}…`
          : null
        detail = `<br>Socio: <strong>${escapeHtml(socio)}</strong>` +
          (grupo ? `<br>Agrupación: ${escapeHtml(grupo)}` : '') +
          `<br>Sorteado: ${escapeHtml(dateFormat.format(new Date(assignment.sorteadoAt)))}` +
          `<br>Asignación: ${escapeHtml(assignment.asignacionId)}`
      }
      layer.bindTooltip(`<strong>${escapeHtml(polygon.numero || 'Sin número')}</strong>${detail}`)
      return layer
    })
    const group = L.featureGroup(layers)
    instance.fitBounds(group.getBounds(), { padding: [20, 20] })
    if (focusIds.length) {
      const focused = layers.filter((_, i) => focusIds.includes(polygons[i]!.polygonId))
      if (focused.length) instance.flyToBounds(L.featureGroup(focused).getBounds(), { padding: [50, 50], maxZoom: 17 })
    }
    map.current = instance
    return () => { instance.remove(); map.current = null }
  }, [polygons, assignments, focusIds, socioLabels, grupoLabels])

  if (polygons.length === 0) return <div className="grid h-80 place-items-center rounded-lg bg-stone-100 text-stone-500">El mapa no contiene polígonos</div>
  return <div ref={host} className="h-[32rem] min-h-80 w-full overflow-hidden rounded-lg border border-stone-200" aria-label="Vista parcelaria" />
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
