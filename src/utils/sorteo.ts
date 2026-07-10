// Lógica determinista del sorteo de parcelas.
//
// El sorteo completo queda definido por una configuración pequeña
// (participantes + semilla + hora de inicio + intervalo) que viaja en el
// hash de la URL. Cualquier dispositivo que abra el enlace reconstruye
// EXACTAMENTE el mismo sorteo y revela cada asignación a la misma hora de
// reloj, sin necesidad de servidor: eso da la vista "en tiempo real"
// sincronizada entre todos los asistentes.

export interface SorteoConfig {
  /** Versión del formato del enlace, por compatibilidad futura. */
  v: 1;
  /** Nombre de cada persona o agrupación participante. */
  participantes: string[];
  /** Semilla del generador pseudoaleatorio (entera, 32 bits). */
  seed: number;
  /** Época Unix en ms en que se revela la primera asignación. */
  inicio: number;
  /** Milisegundos entre una revelación y la siguiente. */
  intervaloMs: number;
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

// --- Codificación del enlace compartible (base64url en el hash) ---------

function aBase64Url(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function deBase64Url(b64url: string): string {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function codificarSorteo(config: SorteoConfig): string {
  return aBase64Url(JSON.stringify(config));
}

export function decodificarSorteo(hash: string): SorteoConfig | null {
  try {
    const limpio = hash.replace(/^#/, '');
    if (!limpio) return null;
    const data: unknown = JSON.parse(deBase64Url(limpio));
    if (typeof data !== 'object' || data === null) return null;
    const c = data as Partial<SorteoConfig>;
    if (
      c.v !== 1 ||
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
    return c as SorteoConfig;
  } catch {
    return null;
  }
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
