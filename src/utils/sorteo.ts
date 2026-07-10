// Lógica determinista del sorteo de lotes.
//
// El sorteo completo queda definido por una configuración
// (participantes + semilla + hora de inicio + intervalo + mapa opcional)
// que viaja en el hash de la URL. Cualquier dispositivo que abra el enlace
// reconstruye EXACTAMENTE el mismo sorteo y revela cada asignación a la
// misma hora de reloj, sin necesidad de servidor: eso da la vista "en
// tiempo real" sincronizada entre todos los asistentes.
import { deflateSync, inflateSync, strToU8, strFromU8 } from 'fflate';
import type { Lote, MapaSorteo } from '../types';
import { simplificarAnillo, centroide } from './kml';

export interface SorteoConfig {
  /** Versión del formato del enlace, por compatibilidad futura. */
  v: 1 | 2;
  /** Nombre de cada persona o agrupación participante. */
  participantes: string[];
  /** Semilla del generador pseudoaleatorio (entera, 32 bits). */
  seed: number;
  /** Época Unix en ms en que se revela la primera asignación. */
  inicio: number;
  /** Milisegundos entre una revelación y la siguiente. */
  intervaloMs: number;
  /**
   * Mapa personalizado (KML/KMZ subido) embebido en el enlace para que
   * todos los asistentes vean los mismos lotes. Ausente = mapa
   * predeterminado del sitio.
   */
  mapa?: MapaSorteo;
}

export interface Asignacion {
  /** Índice de la parcela (posición en el arreglo `parcelas`). */
  parcelaIdx: number;
  participante: string;
}

export type FaseSorteo = 'previa' | 'en_curso' | 'finalizado';

export interface EstadoSorteo {
  fase: FaseSorteo;
  /** Asignaciones ya reveladas, en orden de revelación. */
  reveladas: number;
  /** ms que faltan para el inicio (solo en fase previa). */
  msParaInicio: number;
  /** ms que faltan para la próxima revelación (solo en curso). */
  msParaSiguiente: number;
}

/** PRNG mulberry32: rápido, determinista e idéntico en todo navegador. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates con PRNG inyectado; no muta el arreglo original. */
export function barajar<T>(items: readonly T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Calcula el emparejamiento completo del sorteo. Es una función pura de la
 * configuración: misma semilla ⇒ mismas asignaciones en cualquier equipo.
 * Se barajan tanto los participantes como las parcelas, de modo que el
 * orden de revelación también es aleatorio y todos los lotes tienen la
 * misma probabilidad para todos.
 */
export function calcularAsignaciones(
  config: Pick<SorteoConfig, 'participantes' | 'seed'>,
  totalParcelas: number,
): Asignacion[] {
  const rng = mulberry32(config.seed);
  const orden = barajar(
    Array.from({ length: totalParcelas }, (_, i) => i),
    rng,
  );
  const personas = barajar(config.participantes, rng);
  return personas.map((participante, i) => ({ parcelaIdx: orden[i], participante }));
}

/** Estado del sorteo según el reloj: cuántas asignaciones ya son públicas. */
export function estadoSorteo(config: SorteoConfig, ahora: number): EstadoSorteo {
  const total = config.participantes.length;
  if (ahora < config.inicio) {
    return {
      fase: 'previa',
      reveladas: 0,
      msParaInicio: config.inicio - ahora,
      msParaSiguiente: config.inicio - ahora,
    };
  }
  const reveladas = Math.min(
    total,
    Math.floor((ahora - config.inicio) / config.intervaloMs) + 1,
  );
  if (reveladas >= total) {
    return { fase: 'finalizado', reveladas: total, msParaInicio: 0, msParaSiguiente: 0 };
  }
  const proxima = config.inicio + reveladas * config.intervaloMs;
  return {
    fase: 'en_curso',
    reveladas,
    msParaInicio: 0,
    msParaSiguiente: proxima - ahora,
  };
}

// --- Codificación del enlace compartible (deflate + base64url) ----------

// Los enlaces nuevos llevan el prefijo "2!" y el JSON comprimido con
// deflate; los enlaces v1 (sin prefijo, base64 plano) se siguen aceptando.
const PREFIJO_V2 = '2!';

function bytesABase64Url(bytes: Uint8Array): string {
  let bin = '';
  const BLOQUE = 0x8000;
  for (let i = 0; i < bytes.length; i += BLOQUE) {
    bin += String.fromCharCode(...bytes.subarray(i, i + BLOQUE));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlABytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function codificarSorteo(config: SorteoConfig): string {
  const bytes = deflateSync(strToU8(JSON.stringify(config)), { level: 9 });
  return PREFIJO_V2 + bytesABase64Url(bytes);
}

export function decodificarSorteo(hash: string): SorteoConfig | null {
  try {
    const limpio = decodeURIComponent(hash.replace(/^#/, ''));
    if (!limpio) return null;
    const json = limpio.startsWith(PREFIJO_V2)
      ? strFromU8(inflateSync(base64UrlABytes(limpio.slice(PREFIJO_V2.length))))
      : strFromU8(base64UrlABytes(limpio));
    const data: unknown = JSON.parse(json);
    if (typeof data !== 'object' || data === null) return null;
    const c = data as Partial<SorteoConfig>;
    if (
      (c.v !== 1 && c.v !== 2) ||
      !Array.isArray(c.participantes) ||
      c.participantes.length === 0 ||
      !c.participantes.every((p) => typeof p === 'string') ||
      typeof c.seed !== 'number' ||
      typeof c.inicio !== 'number' ||
      typeof c.intervaloMs !== 'number' ||
      c.intervaloMs < 500
    ) {
      return null;
    }
    if (c.mapa !== undefined && !esMapaValido(c.mapa)) return null;
    return c as SorteoConfig;
  } catch {
    return null;
  }
}

function esMapaValido(mapa: unknown): mapa is MapaSorteo {
  if (typeof mapa !== 'object' || mapa === null) return false;
  const m = mapa as Partial<MapaSorteo>;
  const esCoord = (c: unknown): boolean =>
    Array.isArray(c) && c.length === 2 && c.every((n) => typeof n === 'number');
  return (
    typeof m.nombre === 'string' &&
    Array.isArray(m.lotes) &&
    m.lotes.length > 0 &&
    m.lotes.every(
      (l) =>
        typeof l === 'object' &&
        l !== null &&
        typeof l.nombre === 'string' &&
        (l.areaHa === null || typeof l.areaHa === 'number') &&
        Array.isArray(l.coords) &&
        l.coords.length >= 3 &&
        l.coords.every(esCoord) &&
        esCoord(l.centro),
    ) &&
    (m.limite === null || (Array.isArray(m.limite) && m.limite.every(esCoord)))
  );
}

// --- Empaquetado de mapas personalizados para el enlace ------------------

/** Presupuesto máximo del hash: URLs mayores se vuelven difíciles de compartir. */
export const HASH_MAXIMO = 24000;

function redondearRing(ring: [number, number][]): [number, number][] {
  return ring.map(([lat, lng]) => [Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5]);
}

function compactarMapa(mapa: MapaSorteo, tolerancia: number): MapaSorteo {
  const lote = (l: Lote): Lote => {
    const coords = redondearRing(simplificarAnillo(l.coords, tolerancia));
    return { nombre: l.nombre, areaHa: l.areaHa, coords, centro: centroide(coords) };
  };
  return {
    nombre: mapa.nombre,
    lotes: mapa.lotes.map(lote),
    limite: mapa.limite ? redondearRing(simplificarAnillo(mapa.limite, tolerancia * 2)) : null,
  };
}

/**
 * Codifica el sorteo con el mapa embebido, simplificando progresivamente
 * los polígonos (≈1 m → ≈30 m) hasta que el enlace quepa en el hash.
 * Devuelve el hash y la configuración final (con el mapa que realmente
 * viaja en el enlace, para que el organizador vea lo mismo que el resto).
 */
export function codificarSorteoConMapa(
  config: SorteoConfig,
  mapa: MapaSorteo,
): { hash: string; config: SorteoConfig } {
  const tolerancias = [0, 0.00001, 0.00003, 0.0001, 0.0003];
  let resultado = { hash: '', config };
  for (const tol of tolerancias) {
    const empaquetado: SorteoConfig = { ...config, mapa: compactarMapa(mapa, tol) };
    resultado = { hash: codificarSorteo(empaquetado), config: empaquetado };
    if (resultado.hash.length <= HASH_MAXIMO) break;
  }
  return resultado;
}

/** Semilla aleatoria de 32 bits con la entropía del navegador. */
export function nuevaSemilla(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0];
}

/**
 * Interpreta la lista pegada o subida por el organizador: una persona o
 * agrupación por línea; en archivos CSV toma la primera columna.
 */
export function parsearParticipantes(texto: string): string[] {
  return texto
    .split(/\r?\n/)
    .map((linea) => primeraColumnaCsv(linea).trim())
    .filter(Boolean);
}

/** Primera celda de una línea CSV: respeta comillas y comas/; internas. */
function primeraColumnaCsv(linea: string): string {
  const recortada = linea.trimStart();
  if (recortada.startsWith('"')) {
    // Celda entrecomillada: leer hasta la comilla de cierre ("" = escape).
    let celda = '';
    for (let i = 1; i < recortada.length; i++) {
      if (recortada[i] === '"') {
        if (recortada[i + 1] === '"') {
          celda += '"';
          i++;
        } else {
          return celda;
        }
      } else {
        celda += recortada[i];
      }
    }
    return celda;
  }
  // Sin comillas: la celda termina en el primer separador , o ;
  return recortada.split(/[,;]/)[0];
}

/** Paleta estable por índice (ángulo áureo) para colorear cada parcela. */
export function colorDeParcela(idx: number): string {
  const hue = (idx * 137.508) % 360;
  return `hsl(${hue.toFixed(1)} 72% 46%)`;
}
