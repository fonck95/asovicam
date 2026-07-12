import { useEffect, useRef } from 'react'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Asignacion, MapaPolygon } from '../api'

const COLORS = ['#059669', '#2563eb', '#7c3aed', '#db2777', '#d97706', '#0891b2']

export function ParcelMap({
  polygons,
  assignments = [],
  focusIds = [],
}: {
  polygons: MapaPolygon[]
  assignments?: Asignacion[]
  focusIds?: string[]
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
        if (!eventColors.has(assignment.eventoId)) eventColors.set(assignment.eventoId, COLORS[eventColors.size % COLORS.length]!)
        color = eventColors.get(assignment.eventoId)!
      }
      const layer = L.polygon(
        polygon.coordenadas.map((ring) => ring.map(({ lat, lng }) => [lat, lng] as L.LatLngTuple)),
        { color: focusIds.includes(polygon.polygonId) ? '#facc15' : color, weight: focusIds.includes(polygon.polygonId) ? 4 : 2, fillColor: color, fillOpacity: assignment ? 0.58 : 0.2 },
      ).addTo(instance)
      const detail = assignment
        ? `<br>Asignación: <strong>${escapeHtml(assignment.asignacionId)}</strong><br>Socio: ${escapeHtml(assignment.asociadoId)}${assignment.agrupacionId ? `<br>Agrupación: ${escapeHtml(assignment.agrupacionId)}` : ''}`
        : '<br>Disponible'
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
  }, [polygons, assignments, focusIds])

  if (polygons.length === 0) return <div className="grid h-80 place-items-center rounded-lg bg-stone-100 text-stone-500">El mapa no contiene polígonos</div>
  return <div ref={host} className="h-[32rem] min-h-80 w-full overflow-hidden rounded-lg border border-stone-200" aria-label="Vista parcelaria" />
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
