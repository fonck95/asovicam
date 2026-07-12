import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, type ImportResult } from '../api'
import {
  csvBlob,
  descargarBlob,
  parsearArchivo,
  TAMANO_LOTE,
  trocear,
  type ArchivoParseado,
} from '../lib/asociados'

const PREVIEW_MAX = 20

interface ErrorImportacion {
  fila: number
  cedula: string
  error: string
}

interface Resultado {
  total: number
  inserted: number
  updated: number
  unchanged: number
  failed: number
  errors: ErrorImportacion[]
}

type Estado =
  | { paso: 'elegir'; error?: string }
  | { paso: 'preview'; archivo: ArchivoParseado; nombreArchivo: string }
  | { paso: 'enviando'; lotesHechos: number; totalLotes: number; filasEnviadas: number; totalFilas: number }
  | { paso: 'reporte'; resultado: Resultado; interrumpido?: string }

const NOTA_UPSERT =
  'Las filas cuya cédula ya exista sobrescribirán TODOS los datos del asociado con lo que diga el ' +
  'archivo (las celdas vacías borran el dato actual). En archivos antiguos sin la columna LK, el ' +
  'valor LK existente se conserva; para asociados nuevos se usa 0.'

/** Diálogo de carga masiva: archivo → preview/validación → lotes → reporte. */
export function AsociadosImport({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [estado, setEstado] = useState<Estado>({ paso: 'elegir' })
  const [mode, setMode] = useState<'upsert' | 'insert'>('upsert')
  const [leyendo, setLeyendo] = useState(false)

  const enviando = estado.paso === 'enviando'
  const cerrar = () => {
    if (enviando) return
    onClose()
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setLeyendo(true)
    try {
      const archivo = await parsearArchivo(file)
      if (archivo.filas.length === 0) throw new Error('El archivo no tiene filas de datos debajo de la cabecera')
      setEstado({ paso: 'preview', archivo, nombreArchivo: file.name })
    } catch (err) {
      setEstado({ paso: 'elegir', error: err instanceof Error ? err.message : 'No se pudo leer el archivo' })
    } finally {
      setLeyendo(false)
    }
  }

  const importar = async (archivo: ArchivoParseado) => {
    const lotes = trocear(archivo.filas, TAMANO_LOTE)
    const totalFilas = archivo.filas.length
    const resultado: Resultado = { total: 0, inserted: 0, updated: 0, unchanged: 0, failed: 0, errors: [] }
    setEstado({ paso: 'enviando', lotesHechos: 0, totalLotes: lotes.length, filasEnviadas: 0, totalFilas })
    let interrumpido: string | undefined
    try {
      for (const [i, lote] of lotes.entries()) {
        const r = await api.post<ImportResult>('/api/admin/asociados/import', {
          mode,
          rows: lote.map((f) => f.datos),
        })
        resultado.total += r.total
        resultado.inserted += r.inserted
        resultado.updated += r.updated
        resultado.unchanged += r.unchanged
        resultado.failed += r.failed
        for (const e of r.errors) {
          // El server numera sobre el lote enviado; se reubica a la fila del archivo
          // (también dentro del mensaje "misma que la fila N" de cédulas repetidas).
          const aFilaArchivo = (n: number) => lote[n - 1]?.fila ?? i * TAMANO_LOTE + n + 1
          resultado.errors.push({
            fila: aFilaArchivo(e.row),
            cedula: e.cedula ?? '',
            error: e.error.replace(/la fila (\d+)/, (_, n: string) => `la fila ${aFilaArchivo(Number(n))}`),
          })
        }
        setEstado({
          paso: 'enviando',
          lotesHechos: i + 1,
          totalLotes: lotes.length,
          filasEnviadas: Math.min((i + 1) * TAMANO_LOTE, totalFilas),
          totalFilas,
        })
      }
    } catch (err) {
      interrumpido = err instanceof Error ? err.message : 'Error de red'
    }
    resultado.errors.sort((a, b) => a.fila - b.fila)
    setEstado({ paso: 'reporte', resultado, interrumpido })
    void queryClient.invalidateQueries({ queryKey: ['asociados'] })
  }

  const descargarErrores = (errors: ErrorImportacion[]) => {
    const filas = [['FILA', 'CÉDULA', 'ERROR'], ...errors.map((e) => [String(e.fila), e.cedula, e.error])]
    descargarBlob('errores-importacion-asociados.csv', csvBlob(filas))
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4" onClick={cerrar}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Importar asociados</h2>
          <button onClick={cerrar} disabled={enviando} className="text-sm text-stone-400 hover:text-stone-600 disabled:opacity-40">
            ✕
          </button>
        </div>

        {estado.paso === 'elegir' && (
          <div>
            <p className="mb-3 text-sm text-stone-600">
              Sube la plantilla diligenciada en CSV o Excel (.xlsx). El archivo se procesa en tu
              navegador y solo se envían los datos de las filas al servidor.
            </p>
            {estado.error && (
              <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{estado.error}</p>
            )}
            <label className="block cursor-pointer rounded-lg border border-dashed border-stone-300 bg-stone-50 px-4 py-10 text-center text-sm text-stone-600 hover:border-emerald-500">
              {leyendo ? 'Leyendo archivo…' : 'Haz clic para elegir un archivo .csv, .xlsx o .xls'}
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                disabled={leyendo}
                onChange={(e) => {
                  void onFile(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </label>
          </div>
        )}

        {estado.paso === 'preview' && (
          <div>
            <p className="mb-1 text-sm">
              <span className="font-medium">{estado.nombreArchivo}</span>: {estado.archivo.filas.length}{' '}
              {estado.archivo.filas.length === 1 ? 'fila detectada' : 'filas detectadas'}
              {estado.archivo.erroresLocales > 0 && (
                <span className="text-red-700">
                  , {estado.archivo.erroresLocales} con errores locales (fallarán al importar)
                </span>
              )}
              .
            </p>
            {estado.archivo.columnasIgnoradas.length > 0 && (
              <p className="mb-2 text-xs text-amber-700">
                Columnas desconocidas ignoradas: {estado.archivo.columnasIgnoradas.join(', ')}
              </p>
            )}

            <fieldset className="my-3 flex flex-col gap-2 text-sm">
              <label className="flex items-start gap-2">
                <input type="radio" name="mode" checked={mode === 'upsert'} onChange={() => setMode('upsert')} className="mt-1" />
                <span>
                  <span className="font-medium">Crear y actualizar (upsert)</span> — recomendado.{' '}
                  <span className="text-stone-500">La cédula es la clave: crea las nuevas y actualiza las existentes.</span>
                </span>
              </label>
              <label className="flex items-start gap-2">
                <input type="radio" name="mode" checked={mode === 'insert'} onChange={() => setMode('insert')} className="mt-1" />
                <span>
                  <span className="font-medium">Solo crear nuevos (insert)</span>{' '}
                  <span className="text-stone-500">Las cédulas ya registradas fallan fila a fila.</span>
                </span>
              </label>
            </fieldset>
            {mode === 'upsert' && (
              <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                ⚠ {NOTA_UPSERT}
              </p>
            )}

            <div className="mb-3 overflow-x-auto rounded-lg border border-stone-200">
              <table className="w-full text-xs">
                <thead className="bg-stone-50 text-left uppercase text-stone-500">
                  <tr>
                    <th className="px-2 py-1.5">Fila</th>
                    <th className="px-2 py-1.5">Nombre</th>
                    <th className="px-2 py-1.5">Cédula</th>
                    <th className="px-2 py-1.5">F. nacimiento</th>
                    <th className="px-2 py-1.5">Teléfono</th>
                    <th className="px-2 py-1.5">Correo</th>
                    <th className="px-2 py-1.5">Género</th>
                    <th className="px-2 py-1.5">LK</th>
                    <th className="px-2 py-1.5">Errores locales</th>
                  </tr>
                </thead>
                <tbody>
                  {estado.archivo.filas.slice(0, PREVIEW_MAX).map((f) => (
                    <tr key={f.fila} className={`border-t border-stone-100 ${f.errores.length > 0 ? 'bg-red-50' : ''}`}>
                      <td className="px-2 py-1 text-stone-400">{f.fila}</td>
                      <td className="max-w-40 truncate px-2 py-1">{f.datos.nombre}</td>
                      <td className="px-2 py-1">{f.datos.cedula}</td>
                      <td className="px-2 py-1">{f.datos.fechaNacimiento}</td>
                      <td className="px-2 py-1">{f.datos.telefono}</td>
                      <td className="max-w-40 truncate px-2 py-1">{f.datos.correo}</td>
                      <td className="px-2 py-1">{f.datos.genero}</td>
                      <td className="whitespace-nowrap px-2 py-1">
                        {'lk' in f.datos ? f.datos.lk : '— (conservar)'}
                      </td>
                      <td className="max-w-56 px-2 py-1 text-red-700">{f.errores.join('; ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {estado.archivo.filas.length > PREVIEW_MAX && (
                <p className="border-t border-stone-100 px-2 py-1.5 text-xs text-stone-400">
                  … y {estado.archivo.filas.length - PREVIEW_MAX} filas más (se muestran las primeras {PREVIEW_MAX}).
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setEstado({ paso: 'elegir' })} className="rounded border px-3 py-1.5 text-sm">
                Elegir otro archivo
              </button>
              <button
                onClick={() => void importar(estado.archivo)}
                className="rounded bg-emerald-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-800"
              >
                Importar {estado.archivo.filas.length} {estado.archivo.filas.length === 1 ? 'fila' : 'filas'}
              </button>
            </div>
          </div>
        )}

        {estado.paso === 'enviando' && (
          <div className="py-6">
            <p className="mb-2 text-center text-sm text-stone-600">
              Importando… lote {estado.lotesHechos} de {estado.totalLotes} ({estado.filasEnviadas}/{estado.totalFilas} filas)
            </p>
            <div className="mx-auto h-2 max-w-md overflow-hidden rounded-full bg-stone-200">
              <div
                className="h-full bg-emerald-600 transition-all"
                style={{ width: `${Math.round((estado.lotesHechos / Math.max(1, estado.totalLotes)) * 100)}%` }}
              />
            </div>
            <p className="mt-3 text-center text-xs text-stone-400">No cierres esta ventana hasta que termine.</p>
          </div>
        )}

        {estado.paso === 'reporte' && (
          <div>
            {estado.interrumpido && (
              <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                La importación se interrumpió antes de terminar: {estado.interrumpido}. Los contadores
                reflejan solo los lotes que sí se procesaron ({estado.resultado.total} filas).
              </p>
            )}
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  ['Insertados', estado.resultado.inserted, 'text-emerald-700'],
                  ['Actualizados', estado.resultado.updated, 'text-sky-700'],
                  ['Sin cambios', estado.resultado.unchanged, 'text-stone-500'],
                  ['Fallidos', estado.resultado.failed, 'text-red-700'],
                ] as const
              ).map(([etiqueta, valor, color]) => (
                <div key={etiqueta} className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-center">
                  <p className={`text-2xl font-semibold ${color}`}>{valor}</p>
                  <p className="text-xs text-stone-500">{etiqueta}</p>
                </div>
              ))}
            </div>

            {estado.resultado.errors.length > 0 && (
              <>
                <div className="mb-3 max-h-64 overflow-auto rounded-lg border border-stone-200">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-stone-50 text-left uppercase text-stone-500">
                      <tr>
                        <th className="px-2 py-1.5">Fila</th>
                        <th className="px-2 py-1.5">Cédula</th>
                        <th className="px-2 py-1.5">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {estado.resultado.errors.map((e, i) => (
                        <tr key={i} className="border-t border-stone-100">
                          <td className="px-2 py-1 text-stone-400">{e.fila}</td>
                          <td className="px-2 py-1">{e.cedula}</td>
                          <td className="px-2 py-1 text-red-700">{e.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mb-3 text-xs text-stone-500">
                  Los números de fila corresponden al archivo original (la cabecera es la fila 1).
                  Descárgalos, corrige esas filas en tu archivo y vuelve a importarlo: las filas ya
                  guardadas quedarán «sin cambios».
                </p>
              </>
            )}

            <div className="flex justify-end gap-2">
              {estado.resultado.errors.length > 0 && (
                <button onClick={() => descargarErrores(estado.resultado.errors)} className="rounded border px-3 py-1.5 text-sm">
                  Descargar errores (CSV)
                </button>
              )}
              <button
                onClick={cerrar}
                className="rounded bg-emerald-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-800"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
