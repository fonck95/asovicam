// Lectura de mapas KML/KMZ en el navegador para el sorteo de lotes.
//
// Cada polígono del archivo se toma como un lote sorteable, con dos
// excepciones automáticas: los polígonos "contenedores" (los que envuelven
// los centros de dos o más polígonos, típicamente el lindero del predio o
// un borde decorativo) se apartan y el mayor de ellos se usa como límite
// del mapa. Puntos y líneas se ignoran.
import { unzipSync, strFromU8 } from 'fflate';
import type { Lote, MapaSorteo } from '../types';

const RADIO_TIERRA_M = 6371008.8;
const RAD = Math.PI / 180;

/** Carga un File .kml o .kmz (se detecta por contenido) y extrae sus lotes. */
export async function cargarMapaDeArchivo(archivo: File): Promise<MapaSorteo> {
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  // Un KMZ es un ZIP: firma "PK".
  const esKmz = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const texto = esKmz ? kmlDentroDeKmz(bytes) : new TextDecoder().decode(bytes);
  const nombreArchivo = archivo.name.replace(/\.(kml|kmz)$/i, '');
  return parsearKml(texto, nombreArchivo);
}

function kmlDentroDeKmz(bytes: Uint8Array): string {
  let entradas: Record<string, Uint8Array>;
  try {
    entradas = unzipSync(bytes);
  } catch {
    throw new Error('No se pudo descomprimir el archivo KMZ.');
  }
  // Por convención el documento principal es doc.kml, pero se acepta
  // cualquier .kml dentro del paquete.
  const nombre =
    Object.keys(entradas).find((n) => /(^|\/)doc\.kml$/i.test(n)) ??
    Object.keys(entradas).find((n) => /\.kml$/i.test(n));
  if (!nombre) throw new Error('El KMZ no contiene ningún archivo .kml.');
  return strFromU8(entradas[nombre]);
}

/** Interpreta un texto KML y arma el mapa de lotes para el sorteo. */
export function parsearKml(texto: string, nombreRespaldo: string): MapaSorteo {
  const doc = new DOMParser().parseFromString(texto, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('El archivo no es un KML válido.');
  }

  interface Crudo {
    nombre: string | null;
    ring: [number, number][];
    centro: [number, number];
    areaHa: number;
  }
  const crudos: Crudo[] = [];
  for (const pm of Array.from(doc.getElementsByTagNameNS('*', 'Placemark'))) {
    const etiqueta = nombreDePlacemark(pm);
    // Cubre también polígonos dentro de MultiGeometry.
    for (const poly of Array.from(pm.getElementsByTagNameNS('*', 'Polygon'))) {
      const ring = anilloExterior(poly);
      if (ring && ring.length >= 3) {
        crudos.push({ nombre: etiqueta, ring, centro: centroide(ring), areaHa: areaHa(ring) });
      }
    }
  }
  if (crudos.length === 0) {
    throw new Error('El archivo no contiene polígonos: no hay lotes que sortear.');
  }

  // Un polígono que envuelve los centros de ≥2 polígonos MÁS PEQUEÑOS es
  // lindero/borde, no lote. La condición de área evita el caso inverso:
  // el "centro" (promedio de vértices) de un anillo perimetral gigante
  // suele caer dentro de algún lote pequeño, y sin esa condición ese lote
  // quedaría descartado por error.
  const esContenedor = crudos.map(
    (c, i) =>
      crudos.filter(
        (otro, j) => j !== i && otro.areaHa < c.areaHa && puntoEnAnillo(otro.centro, c.ring),
      ).length >= 2,
  );
  const lotesCrudos = crudos.filter((_, i) => !esContenedor[i]);
  const contenedores = crudos.filter((_, i) => esContenedor[i]);
  if (lotesCrudos.length === 0) {
    throw new Error('Todos los polígonos del archivo se envuelven entre sí; no se pudo distinguir los lotes.');
  }
  const limite =
    contenedores.length > 0
      ? contenedores.reduce((a, b) => (b.areaHa > a.areaHa ? b : a)).ring
      : null;

  const lotes: Lote[] = lotesCrudos.map((c, i) => {
    // Si el autor del mapa declaró el área en el nombre («Parcela 3 —
    // 11.76 ha»), esa cifra manda sobre la calculada con la geometría.
    const declarada = c.nombre ? areaDeclarada(c.nombre) : null;
    return {
      nombre: declarada?.nombre ?? c.nombre ?? `Lote ${i + 1}`,
      areaHa: declarada?.areaHa ?? c.areaHa,
      coords: c.ring,
      centro: c.centro,
    };
  });

  const nombreDoc = textoDirecto(doc.getElementsByTagNameNS('*', 'Document')[0], 'name');
  return { nombre: (nombreDoc || nombreRespaldo).trim() || 'Mapa cargado', lotes, limite };
}

/** <name> del placemark o, en su defecto, la primera línea de <description>. */
function nombreDePlacemark(pm: Element): string | null {
  const nombre = textoDirecto(pm, 'name');
  if (nombre) return acotar(nombre);
  const desc = textoDirecto(pm, 'description');
  if (!desc) return null;
  // Las descripciones pueden traer HTML; se queda solo el texto plano.
  const plano = desc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return plano ? acotar(plano) : null;
}

function acotar(s: string): string {
  const t = s.trim();
  return t.length > 60 ? t.slice(0, 57) + '…' : t;
}

const AREA_SUFIJO = /\s*[—–-]?\s*(\d+(?:[.,]\d+)?)\s*(?:ha|hect[áa]reas?)\.?\s*$/i;
const AREA_PREFIJO = /^\s*(\d+(?:[.,]\d+)?)\s*(?:ha|hect[áa]reas?)\.?\s*[—–:-]?\s*/i;

/** Extrae «… — 11.76 ha» (o «66.4 ha - …») del nombre de un lote. */
function areaDeclarada(nombre: string): { nombre: string; areaHa: number } | null {
  for (const patron of [AREA_SUFIJO, AREA_PREFIJO]) {
    const m = nombre.match(patron);
    if (m) {
      const areaHa = Number(m[1].replace(',', '.'));
      const limpio = nombre.replace(patron, '').trim();
      if (Number.isFinite(areaHa) && areaHa > 0 && limpio) return { nombre: limpio, areaHa };
    }
  }
  return null;
}

/** Texto de un hijo directo `tag` (evita capturar names de subcarpetas). */
function textoDirecto(el: Element | undefined, tag: string): string | null {
  if (!el) return null;
  for (const hijo of Array.from(el.children)) {
    if (hijo.localName === tag) return hijo.textContent?.trim() || null;
  }
  return null;
}

/** Anillo exterior de un <Polygon> como [lat, lng][], sin el cierre repetido. */
function anilloExterior(poly: Element): [number, number][] | null {
  const outer = poly.getElementsByTagNameNS('*', 'outerBoundaryIs')[0] ?? poly;
  const coords = outer.getElementsByTagNameNS('*', 'coordinates')[0]?.textContent;
  if (!coords) return null;
  const ring: [number, number][] = [];
  for (const tripleta of coords.trim().split(/\s+/)) {
    const [lng, lat] = tripleta.split(',').map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng)) ring.push([lat, lng]);
  }
  const [primero, ultimo] = [ring[0], ring[ring.length - 1]];
  if (ring.length > 1 && primero[0] === ultimo[0] && primero[1] === ultimo[1]) ring.pop();
  return ring;
}

export function centroide(ring: [number, number][]): [number, number] {
  const lat = ring.reduce((s, c) => s + c[0], 0) / ring.length;
  const lng = ring.reduce((s, c) => s + c[1], 0) / ring.length;
  return [redondear5(lat), redondear5(lng)];
}

/** Área del anillo en hectáreas (shoelace sobre proyección local plana). */
export function areaHa(ring: [number, number][]): number {
  const lat0 = (ring.reduce((s, c) => s + c[0], 0) / ring.length) * RAD;
  const k = Math.cos(lat0);
  let suma = 0;
  for (let i = 0; i < ring.length; i++) {
    const [lat1, lng1] = ring[i];
    const [lat2, lng2] = ring[(i + 1) % ring.length];
    const x1 = lng1 * RAD * k;
    const y1 = lat1 * RAD;
    const x2 = lng2 * RAD * k;
    const y2 = lat2 * RAD;
    suma += x1 * y2 - x2 * y1;
  }
  const m2 = Math.abs(suma / 2) * RADIO_TIERRA_M * RADIO_TIERRA_M;
  return Math.round(m2 / 100) / 100; // ha con 2 decimales
}

/** Ray casting clásico: ¿el punto [lat, lng] cae dentro del anillo? */
export function puntoEnAnillo(punto: [number, number], ring: [number, number][]): boolean {
  const [lat, lng] = punto;
  let dentro = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [latI, lngI] = ring[i];
    const [latJ, lngJ] = ring[j];
    const cruza =
      latI > lat !== latJ > lat &&
      lng < ((lngJ - lngI) * (lat - latI)) / (latJ - latI) + lngI;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

function redondear5(n: number): number {
  return Math.round(n * 1e5) / 1e5;
}

/**
 * Simplificación Douglas–Peucker de un anillo (tolerancia en grados;
 * 0.00001° ≈ 1 m). Se usa para que los mapas subidos quepan en el enlace.
 */
export function simplificarAnillo(
  ring: [number, number][],
  tolerancia: number,
): [number, number][] {
  if (tolerancia <= 0 || ring.length <= 8) return ring;
  const k = Math.cos((ring[0][0] * RAD));
  const conservar = new Array<boolean>(ring.length).fill(false);
  conservar[0] = conservar[ring.length - 1] = true;
  const pila: [number, number][] = [[0, ring.length - 1]];
  while (pila.length > 0) {
    const [ini, fin] = pila.pop()!;
    let maxDist = 0;
    let maxIdx = -1;
    for (let i = ini + 1; i < fin; i++) {
      const d = distPerpendicular(ring[i], ring[ini], ring[fin], k);
      if (d > maxDist) {
        maxDist = d;
        maxIdx = i;
      }
    }
    if (maxIdx !== -1 && maxDist > tolerancia) {
      conservar[maxIdx] = true;
      pila.push([ini, maxIdx], [maxIdx, fin]);
    }
  }
  const resultado = ring.filter((_, i) => conservar[i]);
  return resultado.length >= 3 ? resultado : ring;
}

function distPerpendicular(
  p: [number, number],
  a: [number, number],
  b: [number, number],
  k: number,
): number {
  // Coordenadas planas locales: lng escalada por cos(lat) para que un
  // grado "mida" lo mismo en ambos ejes.
  const px = p[1] * k;
  const py = p[0];
  const ax = a[1] * k;
  const ay = a[0];
  const bx = b[1] * k;
  const by = b[0];
  const dx = bx - ax;
  const dy = by - ay;
  const largo2 = dx * dx + dy * dy;
  if (largo2 === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / largo2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
