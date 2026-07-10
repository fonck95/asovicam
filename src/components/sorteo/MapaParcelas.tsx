import { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Lote } from '../../types';
import { colorDeParcela } from '../../utils/sorteo';
import styles from './MapaParcelas.module.css';

interface MapaParcelasProps {
  /** Lotes a dibujar (del mapa predeterminado o de un KML/KMZ subido). */
  lotes: Lote[];
  /** Lindero del predio, si el mapa lo trae. */
  limite: [number, number][] | null;
  /** Participante ya revelado por índice de lote. */
  asignaciones: ReadonlyMap<number, string>;
  /** Índice del lote que se está sorteando en este momento. */
  enJuego: number | null;
  /** Índice del último lote revelado (el mapa vuela hacia él). */
  ultima: number | null;
  /** Si el mapa debe seguir automáticamente cada revelación. */
  seguir: boolean;
}

const ESTILO_LIBRE: L.PathOptions = {
  color: '#fde68a',
  weight: 1.5,
  opacity: 0.9,
  fillColor: '#ffffff',
  fillOpacity: 0.06,
};

function estiloAsignada(idx: number): L.PathOptions {
  return {
    color: '#ffffff',
    weight: 2,
    opacity: 1,
    fillColor: colorDeParcela(idx),
    fillOpacity: 0.55,
  };
}

/** Texto corto del chip sobre el lote: su número si lo tiene, o su orden. */
function etiquetaCorta(lote: Lote, idx: number): string {
  const numero = lote.nombre.match(/\d+/);
  return numero ? numero[0] : String(idx + 1);
}

function contenidoPopup(lote: Lote, participante: string | undefined): string {
  const area = lote.areaHa != null ? ` · ${lote.areaHa} ha` : '';
  const estado = participante
    ? `Asignado a: <strong>${escaparHtml(participante)}</strong>`
    : 'Aún sin asignar';
  return `<strong>${escaparHtml(lote.nombre)}</strong>${area}<br/>${estado}`;
}

function escaparHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function limitesDelMapa(lotes: Lote[], limite: [number, number][] | null): L.LatLngBounds {
  if (limite && limite.length >= 2) return L.latLngBounds(limite);
  return L.latLngBounds(lotes.flatMap((l) => l.coords));
}

export default function MapaParcelas({
  lotes,
  limite,
  asignaciones,
  enJuego,
  ultima,
  seguir,
}: MapaParcelasProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const capasRef = useRef<L.Polygon[]>([]);
  const pintadasRef = useRef(new Map<number, string | undefined>());

  // Creación del mapa; se reconstruye si cambian los lotes (otro KML).
  useEffect(() => {
    if (!divRef.current) return;
    const map = L.map(divRef.current, { zoomSnap: 0.5 });
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Imágenes © Esri — Esri, Maxar, Earthstar Geographics',
        maxZoom: 19,
        maxNativeZoom: 18,
      },
    ).addTo(map);

    if (limite && limite.length >= 2) {
      L.polygon(limite, {
        color: '#ffffff',
        weight: 2,
        dashArray: '6 6',
        fill: false,
        opacity: 0.85,
        interactive: false,
      }).addTo(map);
    }

    capasRef.current = lotes.map((lote, idx) => {
      const capa = L.polygon(lote.coords, ESTILO_LIBRE).addTo(map);
      capa.bindTooltip(etiquetaCorta(lote, idx), {
        permanent: true,
        direction: 'center',
        className: styles.numeroLote,
      });
      capa.bindPopup(contenidoPopup(lote, undefined));
      return capa;
    });

    // Capas recién creadas: invalida el caché de pintado para que el
    // siguiente efecto las pinte aunque el componente se haya remontado
    // (p. ej. StrictMode) con asignaciones ya reveladas.
    pintadasRef.current.clear();

    map.fitBounds(limitesDelMapa(lotes, limite), { padding: [16, 16] });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      capasRef.current = [];
    };
  }, [lotes, limite]);

  // Pinta los lotes ya asignados. El efecto corre en cada tick del
  // reloj, así que solo toca las capas cuyo estado realmente cambió.
  useEffect(() => {
    capasRef.current.forEach((capa, idx) => {
      const participante = asignaciones.get(idx);
      if (pintadasRef.current.get(idx) === participante) return;
      pintadasRef.current.set(idx, participante);
      capa.setStyle(participante ? estiloAsignada(idx) : ESTILO_LIBRE);
      capa.setPopupContent(contenidoPopup(lotes[idx], participante));
    });
  }, [asignaciones, lotes]);

  // Pulso sobre el lote que está en juego.
  useEffect(() => {
    const capa = enJuego != null ? capasRef.current[enJuego] : null;
    const el = capa?.getElement();
    el?.classList.add(styles.pulso);
    return () => el?.classList.remove(styles.pulso);
  }, [enJuego]);

  // Vuela hacia el último lote revelado.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !seguir) return;
    if (ultima == null) {
      map.flyToBounds(limitesDelMapa(lotes, limite), { padding: [16, 16], duration: 1 });
      return;
    }
    const capa = capasRef.current[ultima];
    if (capa) map.flyToBounds(capa.getBounds(), { maxZoom: 16, duration: 1.1, padding: [40, 40] });
  }, [ultima, seguir, lotes, limite]);

  return (
    <div
      ref={divRef}
      className={styles.mapa}
      role="application"
      aria-label="Mapa de lotes del sorteo"
    />
  );
}
