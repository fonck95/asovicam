import { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { parcelas, limitePredio } from '../../data/parcelas';
import { colorDeParcela } from '../../utils/sorteo';
import styles from './MapaParcelas.module.css';

interface MapaParcelasProps {
  /** Participante ya revelado por índice de parcela. */
  asignaciones: ReadonlyMap<number, string>;
  /** Índice de la parcela que se está sorteando en este momento. */
  enJuego: number | null;
  /** Índice de la última parcela revelada (el mapa vuela hacia ella). */
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

function contenidoPopup(idx: number, participante: string | undefined): string {
  const p = parcelas[idx];
  const area = p.areaHa != null ? ` · ${p.areaHa} ha` : '';
  const estado = participante
    ? `Asignada a: <strong>${participante.replace(/</g, '&lt;')}</strong>`
    : 'Aún sin asignar';
  return `<strong>${p.nombre}</strong>${area}<br/>${estado}`;
}

export default function MapaParcelas({ asignaciones, enJuego, ultima, seguir }: MapaParcelasProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const capasRef = useRef<L.Polygon[]>([]);
  const pintadasRef = useRef(new Map<number, string | undefined>());

  // Creación del mapa: una sola vez.
  useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    const map = L.map(divRef.current, { zoomSnap: 0.5 });
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Imágenes © Esri — Esri, Maxar, Earthstar Geographics',
        maxZoom: 19,
        maxNativeZoom: 18,
      },
    ).addTo(map);

    L.polygon(limitePredio, {
      color: '#ffffff',
      weight: 2,
      dashArray: '6 6',
      fill: false,
      opacity: 0.85,
      interactive: false,
    }).addTo(map);

    capasRef.current = parcelas.map((p, idx) => {
      const capa = L.polygon(p.coords, ESTILO_LIBRE).addTo(map);
      capa.bindTooltip(String(p.id), {
        permanent: true,
        direction: 'center',
        className: styles.numeroLote,
      });
      capa.bindPopup(contenidoPopup(idx, undefined));
      return capa;
    });

    // Capas recién creadas: invalida el caché de pintado para que el
    // siguiente efecto las pinte aunque el componente se haya remontado
    // (p. ej. StrictMode) con asignaciones ya reveladas.
    pintadasRef.current.clear();

    map.fitBounds(L.latLngBounds(limitePredio), { padding: [16, 16] });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      capasRef.current = [];
    };
  }, []);

  // Pinta las parcelas ya asignadas. El efecto corre en cada tick del
  // reloj, así que solo toca las capas cuyo estado realmente cambió.
  useEffect(() => {
    capasRef.current.forEach((capa, idx) => {
      const participante = asignaciones.get(idx);
      if (pintadasRef.current.get(idx) === participante) return;
      pintadasRef.current.set(idx, participante);
      capa.setStyle(participante ? estiloAsignada(idx) : ESTILO_LIBRE);
      capa.setPopupContent(contenidoPopup(idx, participante));
    });
  }, [asignaciones]);

  // Pulso sobre la parcela que está en juego.
  useEffect(() => {
    const capa = enJuego != null ? capasRef.current[enJuego] : null;
    const el = capa?.getElement();
    el?.classList.add(styles.pulso);
    return () => el?.classList.remove(styles.pulso);
  }, [enJuego]);

  // Vuela hacia la última parcela revelada.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !seguir) return;
    if (ultima == null) {
      map.flyToBounds(L.latLngBounds(limitePredio), { padding: [16, 16], duration: 1 });
      return;
    }
    const capa = capasRef.current[ultima];
    if (capa) map.flyToBounds(capa.getBounds(), { maxZoom: 16, duration: 1.1, padding: [40, 40] });
  }, [ultima, seguir]);

  return <div ref={divRef} className={styles.mapa} role="application" aria-label="Mapa de parcelas del predio La Faraona" />;
}
