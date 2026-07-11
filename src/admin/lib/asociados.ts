import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import type { Asociado } from '../api'

/**
 * Utilidades del módulo Asociados (docs/SPEC-ASOCIADOS.md §5): validación
 * local espejo de apps/server/src/validation/schemas.ts, generación de la
 * plantilla/exportación en CSV y XLSX, y parseo en el navegador de archivos
 * diligenciados. Los datos son PII: todo ocurre en el cliente, nada sale
 * hacia terceros ni se loggea.
 */

export const CAMPOS = ['nombre', 'cedula', 'fechaNacimiento', 'telefono', 'correo', 'genero'] as const
export type CampoAsociado = (typeof CAMPOS)[number]

/** Fila tal como la espera POST /api/admin/asociados{,/import}. */
export type AsociadoInput = Record<CampoAsociado, string>

export const GENEROS = ['femenino', 'masculino', 'otro'] as const

/** Cabeceras oficiales de la plantilla, en el orden de la plantilla. */
export const PLANTILLA_HEADERS: readonly string[] = [
  'NOMBRE ASOCIADO',
  'CÉDULA',
  'FECHA DE NACIMIENTO',
  'N°_TELEFONO_ASOCIADO',
  'CORREO_ELECTRÓNICO_ASOCIADO',
  'GENERO',
]

const FILA_EJEMPLO: readonly string[] = [
  'María Pérez',
  '1234567',
  '1985-03-15',
  '+57 300 123 4567',
  'maria@example.com',
  'F',
]

// ---------- Validación local (mismas reglas que el servidor) ----------

const ALIAS_GENERO: Record<string, string> = {
  f: 'femenino',
  femenino: 'femenino',
  mujer: 'femenino',
  m: 'masculino',
  masculino: 'masculino',
  hombre: 'masculino',
  o: 'otro',
  otro: 'otro',
}

export const normalizarCedula = (v: string): string => v.trim().replace(/[.\s-]/g, '')

export const normalizarGenero = (v: string): string => {
  const s = v.trim().toLowerCase()
  return ALIAS_GENERO[s] ?? s
}

/** 'DD/MM/AAAA' o 'DD-MM-AAAA' → 'AAAA-MM-DD'; lo demás pasa tal cual. */
const aFechaIso = (v: string): string => {
  const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(v.trim())
  if (!m) return v.trim()
  const [, dia = '', mes = '', anio = ''] = m
  return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
}

/** Fecha de calendario real entre 1900-01-01 y hoy (UTC). */
const esFechaNacimientoReal = (s: string): boolean => {
  const [y = 0, m = 0, d = 0] = s.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d &&
    y >= 1900 &&
    date.getTime() <= Date.now()
  )
}

/**
 * Valida una fila con las mismas reglas que el servidor para dar feedback
 * inmediato en el formulario y en la preview de importación. El servidor
 * sigue siendo la autoridad: aquí solo se anticipa lo que él rechazaría.
 */
export function validarAsociado(input: AsociadoInput): Partial<Record<CampoAsociado, string>> {
  const errores: Partial<Record<CampoAsociado, string>> = {}
  const nombre = input.nombre.trim()
  if (nombre.length < 1 || nombre.length > 200) errores.nombre = 'obligatorio (1 a 200 caracteres)'
  if (!/^\d{4,15}$/.test(normalizarCedula(input.cedula)))
    errores.cedula = 'solo dígitos, de 4 a 15 (se admiten puntos y espacios)'
  const fecha = aFechaIso(input.fechaNacimiento)
  if (fecha !== '' && !(/^\d{4}-\d{2}-\d{2}$/.test(fecha) && esFechaNacimientoReal(fecha)))
    errores.fechaNacimiento = 'usa AAAA-MM-DD o DD/MM/AAAA, entre 1900 y hoy'
  const tel = input.telefono.trim().replace(/\s+/g, ' ')
  if (tel !== '' && !(/^\+?[\d ().-]{7,29}$/.test(tel) && (tel.match(/\d/g) ?? []).length >= 7))
    errores.telefono = 'dígitos, espacios y "+()-", con al menos 7 dígitos'
  const correo = input.correo.trim().toLowerCase()
  if (correo !== '' && !(correo.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)))
    errores.correo = 'correo electrónico inválido'
  const genero = normalizarGenero(input.genero)
  if (genero !== '' && !(GENEROS as readonly string[]).includes(genero))
    errores.genero = 'usa femenino, masculino, otro (o F/M), o deja vacío'
  return errores
}

/** Extrae errores por campo del `details` (zod flatten) de un 400 del API. */
export function erroresDeZod(details: unknown): Partial<Record<CampoAsociado, string>> {
  const out: Partial<Record<CampoAsociado, string>> = {}
  const fieldErrors = (details as { fieldErrors?: Record<string, string[]> } | null | undefined)
    ?.fieldErrors
  if (!fieldErrors) return out
  for (const campo of CAMPOS) {
    const msgs = fieldErrors[campo]
    if (msgs && msgs.length > 0) out[campo] = msgs.join('; ')
  }
  return out
}

// ---------- Generación de CSV / XLSX (plantilla y exportación) ----------

export function descargarBlob(nombreArchivo: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** CSV con separador coma, saltos \r\n y BOM UTF-8 para Excel en español. */
export function csvBlob(filas: string[][]): Blob {
  const csv = Papa.unparse(filas, { newline: '\r\n' })
  return new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' })
}

export function xlsxBlob(filas: string[][]): Blob {
  const ws = XLSX.utils.aoa_to_sheet(filas)
  // La columna CÉDULA (B) va como texto para que Excel no convierta cédulas
  // largas a notación científica ni les recorte ceros a la izquierda.
  const rango = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
  for (let r = rango.s.r; r <= rango.e.r; r++) {
    const celda = ws[XLSX.utils.encode_cell({ r, c: 1 })] as XLSX.CellObject | undefined
    if (celda) {
      celda.t = 's'
      celda.z = '@'
    }
  }
  ws['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 20 }, { wch: 22 }, { wch: 32 }, { wch: 12 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Asociados')
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  return new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

export function plantillaFilas(): string[][] {
  return [[...PLANTILLA_HEADERS], [...FILA_EJEMPLO]]
}

/** Exporta con las cabeceras de la plantilla: el archivo sirve para reimportar. */
export function asociadosAFilas(items: Asociado[]): string[][] {
  return [
    [...PLANTILLA_HEADERS],
    ...items.map((a) => [a.nombre, a.cedula, a.fechaNacimiento, a.telefono, a.correo, a.genero]),
  ]
}

// ---------- Parseo de archivos (CSV con , o ; y XLSX) ----------

/** MAYÚSCULAS → sin tildes ni '°' → no-alfanuméricos a espacio → trim. */
export function normalizarCabecera(h: string): string {
  return h
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/°/g, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

const CABECERA_A_CAMPO: Record<string, CampoAsociado> = {
  'NOMBRE ASOCIADO': 'nombre',
  NOMBRE: 'nombre',
  CEDULA: 'cedula',
  'FECHA DE NACIMIENTO': 'fechaNacimiento',
  'N TELEFONO ASOCIADO': 'telefono',
  TELEFONO: 'telefono',
  'CORREO ELECTRONICO ASOCIADO': 'correo',
  CORREO: 'correo',
  GENERO: 'genero',
}

export interface FilaImportada {
  /** Número de fila en el archivo original (la cabecera cuenta como fila 1). */
  fila: number
  datos: AsociadoInput
  /** Errores locales ('campo: mensaje'); la fila se envía igual y el server decide. */
  errores: string[]
}

export interface ArchivoParseado {
  filas: FilaImportada[]
  /** Cabeceras no reconocidas (o repetidas); se ignoran y se avisa en la preview. */
  columnasIgnoradas: string[]
  erroresLocales: number
}

type Celda = string | number | boolean | null | undefined

/** Serial de fecha de Excel (época 1899-12-30) → 'AAAA-MM-DD'. */
const serialExcelAIso = (serial: number): string => {
  if (!Number.isFinite(serial) || serial <= 0) return String(serial)
  const fecha = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000)
  return fecha.toISOString().slice(0, 10)
}

const celdaATexto = (v: Celda, campo: CampoAsociado): string => {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number') {
    // Excel entrega números en CÉDULA/TELÉFONO y seriales en la fecha.
    return campo === 'fechaNacimiento' ? serialExcelAIso(v) : String(v)
  }
  return String(v).trim()
}

async function matrizDeArchivo(file: File): Promise<Celda[][]> {
  const nombre = file.name.toLowerCase()
  if (nombre.endsWith('.xlsx') || nombre.endsWith('.xls')) {
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
    const primeraHoja = wb.SheetNames[0]
    const ws = primeraHoja ? wb.Sheets[primeraHoja] : undefined
    if (!ws) throw new Error('El libro de Excel no tiene hojas')
    return XLSX.utils.sheet_to_json<Celda[]>(ws, { header: 1, raw: true, defval: '', blankrows: true })
  }
  // CSV: papaparse detecta el delimitador entre ',' y ';' (Excel en español exporta con ';').
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      delimitersToGuess: [',', ';'],
      complete: (r) => resolve(r.data),
      error: (e) => reject(new Error(`No se pudo leer el CSV: ${e.message}`)),
    })
  })
}

/**
 * Parsea un CSV/XLSX diligenciado: localiza la fila de cabeceras, mapea las
 * columnas con matching tolerante, normaliza celdas (números y seriales de
 * Excel a texto) y valida cada fila localmente. Lanza Error con mensaje claro
 * si faltan NOMBRE ASOCIADO o CÉDULA, sin enviar nada al servidor.
 */
export async function parsearArchivo(file: File): Promise<ArchivoParseado> {
  const matriz = await matrizDeArchivo(file)
  const noVacia = (fila: Celda[]) =>
    fila.some((c) => c !== null && c !== undefined && String(c).trim() !== '')
  const idxCabecera = matriz.findIndex(noVacia)
  if (idxCabecera === -1) throw new Error('El archivo está vacío')

  const cabeceras = (matriz[idxCabecera] ?? []).map((c) => String(c ?? '').trim())
  const columnaDeCampo = new Map<CampoAsociado, number>()
  const columnasIgnoradas: string[] = []
  cabeceras.forEach((h, col) => {
    if (h === '') return
    const campo = CABECERA_A_CAMPO[normalizarCabecera(h)]
    if (campo !== undefined && !columnaDeCampo.has(campo)) columnaDeCampo.set(campo, col)
    else columnasIgnoradas.push(h)
  })

  const faltantes: string[] = []
  if (!columnaDeCampo.has('nombre')) faltantes.push('NOMBRE ASOCIADO')
  if (!columnaDeCampo.has('cedula')) faltantes.push('CÉDULA')
  if (faltantes.length > 0) {
    throw new Error(
      `Al archivo le faltan las columnas obligatorias: ${faltantes.join(' y ')}. ` +
        'Descarga la plantilla para ver el formato esperado.',
    )
  }

  const filas: FilaImportada[] = []
  const cedulasVistas = new Map<string, number>()
  let erroresLocales = 0
  for (let i = idxCabecera + 1; i < matriz.length; i++) {
    const cruda = matriz[i] ?? []
    const datos = {} as AsociadoInput
    for (const campo of CAMPOS) {
      const col = columnaDeCampo.get(campo)
      datos[campo] = col === undefined ? '' : celdaATexto(cruda[col], campo)
    }
    if (CAMPOS.every((campo) => datos[campo] === '')) continue // fila totalmente vacía
    const fila = i + 1
    const errores = Object.entries(validarAsociado(datos)).map(([campo, msg]) => `${campo}: ${msg}`)
    const cedula = normalizarCedula(datos.cedula)
    if (/^\d{4,15}$/.test(cedula)) {
      const primera = cedulasVistas.get(cedula)
      if (primera !== undefined) errores.push(`cédula repetida en el archivo (misma que la fila ${primera})`)
      else cedulasVistas.set(cedula, fila)
    }
    if (errores.length > 0) erroresLocales++
    filas.push({ fila, datos, errores })
  }
  return { filas, columnasIgnoradas, erroresLocales }
}

// ---------- Envío por lotes ----------

/** Límite duro del server: 1000 filas/petición y body de 1 MB; 500 va holgado. */
export const TAMANO_LOTE = 500

export function trocear<T>(items: T[], tamano: number): T[][] {
  const lotes: T[][] = []
  for (let i = 0; i < items.length; i += tamano) lotes.push(items.slice(i, i + tamano))
  return lotes
}
