/* eslint-disable react-hooks/set-state-in-effect, react-hooks/static-components */
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, type Asociado, type AsociadosList } from '../api'
import { AsociadosImport } from '../components/AsociadosImport'
import { useToast } from '../components/Toast'
import {
  asociadosAFilas,
  csvBlob,
  descargarBlob,
  erroresDeZod,
  plantillaFilas,
  validarAsociado,
  xlsxBlob,
  type AsociadoInput,
  type CampoAsociado,
} from '../lib/asociados'

const LIMIT = 20

const GENERO_FILTROS = [
  { value: '', label: 'Todos' },
  { value: 'femenino', label: 'Femenino' },
  { value: 'masculino', label: 'Masculino' },
  { value: 'otro', label: 'Otro' },
]

const GENERO_LABEL: Record<string, string> = { femenino: 'Femenino', masculino: 'Masculino', otro: 'Otro' }

const FORM_VACIO: AsociadoInput = {
  nombre: '',
  cedula: '',
  fechaNacimiento: '',
  telefono: '',
  correo: '',
  genero: '',
}

type CampoOrdenable = 'nombre' | 'cedula' | 'fechaNacimiento'

const INPUT_BASE =
  'w-full rounded border px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none'

function Campo({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-stone-700">
        {label}
        {required && <span className="text-red-600"> *</span>}
        {hint && <span className="ml-2 text-xs font-normal text-stone-400">{hint}</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  )
}

/** Par de botones CSV/XLSX con una etiqueta común (plantilla y exportación). */
function BotonesFormato({
  etiqueta,
  onClick,
  disabled,
}: {
  etiqueta: string
  onClick: (formato: 'csv' | 'xlsx') => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center overflow-hidden rounded border border-stone-300 bg-white text-sm">
      <span className="px-2.5 py-1.5 text-stone-500">{etiqueta}</span>
      {(['csv', 'xlsx'] as const).map((formato) => (
        <button
          key={formato}
          onClick={() => onClick(formato)}
          disabled={disabled}
          className="border-l border-stone-200 px-2.5 py-1.5 font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
        >
          {formato.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

export function AsociadosPage() {
  const toast = useToast()
  const queryClient = useQueryClient()

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [genero, setGenero] = useState('')
  const [sort, setSort] = useState<string>('nombre')
  const [page, setPage] = useState(1)

  const [editing, setEditing] = useState<Asociado | 'new' | null>(null)
  const [form, setForm] = useState<AsociadoInput>(FORM_VACIO)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<CampoAsociado, string>>>({})
  const [importOpen, setImportOpen] = useState(false)
  const [exportando, setExportando] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const qs = new URLSearchParams({ page: String(page), limit: String(LIMIT), sort })
  if (search) qs.set('search', search)
  if (genero) qs.set('genero', genero)

  const query = useQuery({
    queryKey: ['asociados', { search, genero, page, limit: LIMIT, sort }],
    queryFn: () => api.get<AsociadosList>(`/api/admin/asociados?${qs.toString()}`),
    placeholderData: keepPreviousData,
  })

  // Si la sesión expiró, refrescar ['me'] devuelve al login como el resto del dashboard.
  useEffect(() => {
    if (query.error instanceof ApiError && query.error.status === 401) {
      void queryClient.invalidateQueries({ queryKey: ['me'] })
    }
  }, [query.error, queryClient])

  // Al borrar los últimos elementos de la última página, retrocede a una válida.
  useEffect(() => {
    if (query.data && page > query.data.pages) setPage(query.data.pages)
  }, [query.data, page])

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['asociados'] })

  const abrirForm = (item: Asociado | 'new') => {
    setFieldErrors({})
    setEditing(item)
    setForm(
      item === 'new'
        ? FORM_VACIO
        : {
            nombre: item.nombre,
            cedula: item.cedula,
            fechaNacimiento: item.fechaNacimiento,
            telefono: item.telefono,
            correo: item.correo,
            genero: item.genero,
          },
    )
  }

  const save = useMutation({
    mutationFn: (p: { id?: string; body: AsociadoInput }) =>
      p.id
        ? api.put<Asociado>(`/api/admin/asociados/${p.id}`, p.body)
        : api.post<Asociado>('/api/admin/asociados', p.body),
    onSuccess: (_a, p) => {
      toast('success', p.id ? 'Cambios guardados' : 'Asociado creado')
      setEditing(null)
      invalidate()
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        setFieldErrors({ cedula: 'ya existe un asociado con esa cédula' })
      } else if (err instanceof ApiError && err.status === 400 && err.details) {
        const errores = erroresDeZod(err.details)
        setFieldErrors(errores)
        if (Object.keys(errores).length === 0) toast('error', err.message)
      } else {
        toast('error', err instanceof Error ? err.message : 'Error inesperado')
      }
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/admin/asociados/${id}`),
    onSuccess: () => {
      toast('success', 'Asociado eliminado')
      invalidate()
    },
    onError: (err) => toast('error', err instanceof Error ? err.message : 'No se pudo eliminar'),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errores = validarAsociado(form)
    setFieldErrors(errores)
    if (Object.keys(errores).length > 0) return
    save.mutate({ id: editing !== 'new' && editing ? editing.id : undefined, body: form })
  }

  const descargarPlantilla = (formato: 'csv' | 'xlsx') => {
    const filas = plantillaFilas()
    descargarBlob(`plantilla-asociados.${formato}`, formato === 'csv' ? csvBlob(filas) : xlsxBlob(filas))
  }

  const exportar = async (formato: 'csv' | 'xlsx') => {
    setExportando(true)
    try {
      const items = await api.get<Asociado[]>('/api/admin/asociados/export')
      if (items.length === 0) {
        toast('error', 'No hay asociados para exportar')
        return
      }
      const filas = asociadosAFilas(items)
      const fecha = new Date().toISOString().slice(0, 10)
      descargarBlob(`asociados-${fecha}.${formato}`, formato === 'csv' ? csvBlob(filas) : xlsxBlob(filas))
      toast('success', `${items.length} asociados exportados`)
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'No se pudo exportar')
    } finally {
      setExportando(false)
    }
  }

  const toggleSort = (campo: CampoOrdenable) => {
    setSort((s) => (s === campo ? `-${campo}` : campo))
    setPage(1)
  }

  const Th = ({ campo, children }: { campo?: CampoOrdenable; children: ReactNode }) => (
    <th className="px-3 py-2">
      {campo ? (
        <button onClick={() => toggleSort(campo)} className="uppercase hover:text-emerald-800">
          {children}
          {sort === campo && ' ▲'}
          {sort === `-${campo}` && ' ▼'}
        </button>
      ) : (
        children
      )}
    </th>
  )

  const data = query.data
  const sinAsociados = data !== undefined && data.total === 0 && search === '' && genero === ''
  const inputClase = (campo: CampoAsociado) =>
    `${INPUT_BASE} ${fieldErrors[campo] ? 'border-red-400' : 'border-stone-300'}`
  const hoy = new Date().toISOString().slice(0, 10)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Asociados</h1>
        <div className="flex flex-wrap items-center gap-2">
          <BotonesFormato etiqueta="Plantilla" onClick={descargarPlantilla} />
          <BotonesFormato etiqueta="Exportar" onClick={(f) => void exportar(f)} disabled={exportando} />
          <button onClick={() => setImportOpen(true)} className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50">
            Importar
          </button>
          <button
            onClick={() => abrirForm('new')}
            className="rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800"
          >
            + Nuevo asociado
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Buscar por nombre, cédula, correo o teléfono…"
          className={`${INPUT_BASE} max-w-xs border-stone-300`}
        />
        <div className="flex gap-2">
          {GENERO_FILTROS.map((g) => (
            <button
              key={g.value}
              onClick={() => {
                setGenero(g.value)
                setPage(1)
              }}
              className={`rounded-full px-3 py-1 text-sm ${
                genero === g.value ? 'bg-emerald-700 text-white' : 'border border-stone-200 bg-white text-stone-600'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
        {data && !sinAsociados && (
          <span className="ml-auto text-sm text-stone-500">
            {data.total} {data.total === 1 ? 'asociado' : 'asociados'} en total
          </span>
        )}
      </div>

      {query.isLoading && <p className="py-10 text-center text-stone-500">Cargando…</p>}
      {query.isError && <p className="py-10 text-center text-red-600">No se pudo cargar la lista</p>}

      {sinAsociados && (
        <div className="rounded-lg border border-dashed border-stone-300 bg-white py-14 text-center">
          <p className="mb-1 text-lg font-medium">Aún no hay asociados registrados</p>
          <p className="mx-auto mb-5 max-w-md text-sm text-stone-500">
            Agrega el primero a mano, o descarga la plantilla, diligénciala en Excel y súbela con
            «Importar».
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => abrirForm('new')}
              className="rounded bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
            >
              + Agregar asociado
            </button>
            <button
              onClick={() => setImportOpen(true)}
              className="rounded border border-emerald-700 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50"
            >
              Importar desde plantilla
            </button>
          </div>
        </div>
      )}

      {data && !sinAsociados && (
        <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase text-stone-500">
              <tr>
                <Th campo="nombre">Nombre</Th>
                <Th campo="cedula">Cédula</Th>
                <Th campo="fechaNacimiento">F. nacimiento</Th>
                <Th>Teléfono</Th>
                <Th>Correo</Th>
                <Th>Género</Th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((a) => (
                <tr key={a.id} className="border-t border-stone-100">
                  <td className="max-w-56 truncate px-3 py-2 font-medium">{a.nombre}</td>
                  <td className="px-3 py-2">{a.cedula}</td>
                  <td className="px-3 py-2">{a.fechaNacimiento || '—'}</td>
                  <td className="px-3 py-2">{a.telefono || '—'}</td>
                  <td className="max-w-56 truncate px-3 py-2">{a.correo || '—'}</td>
                  <td className="px-3 py-2">{GENERO_LABEL[a.genero] ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <button onClick={() => abrirForm(a)} className="rounded px-2 py-1 text-emerald-700 hover:bg-emerald-50">
                      Editar
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`¿Eliminar al asociado "${a.nombre}" (cédula ${a.cedula})? Esta acción no se puede deshacer.`)) {
                          remove.mutate(a.id)
                        }
                      }}
                      className="rounded px-2 py-1 text-red-700 hover:bg-red-50"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-stone-500">
                    Sin resultados para esta búsqueda o filtro
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {data && data.pages > 1 && (
        <div className="mt-5 flex items-center justify-center gap-3 text-sm">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border px-2 py-1 disabled:opacity-40">
            ← Anterior
          </button>
          <span>
            Página {page} de {data.pages}
          </span>
          <button
            disabled={page >= data.pages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border px-2 py-1 disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      )}

      {editing !== null && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditing(null)}>
          <form
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
          >
            <h2 className="mb-4 text-lg font-semibold">{editing === 'new' ? 'Nuevo asociado' : 'Editar asociado'}</h2>
            <div className="flex flex-col gap-3">
              <Campo label="Nombre" required error={fieldErrors.nombre}>
                <input
                  className={inputClase('nombre')}
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  required
                  maxLength={200}
                />
              </Campo>
              <Campo label="Cédula" required hint="solo dígitos, se admiten puntos" error={fieldErrors.cedula}>
                <input
                  type="text"
                  inputMode="numeric"
                  className={inputClase('cedula')}
                  value={form.cedula}
                  onChange={(e) => setForm((f) => ({ ...f, cedula: e.target.value }))}
                  required
                />
              </Campo>
              <Campo label="Fecha de nacimiento" error={fieldErrors.fechaNacimiento}>
                <input
                  type="date"
                  min="1900-01-01"
                  max={hoy}
                  className={inputClase('fechaNacimiento')}
                  value={form.fechaNacimiento}
                  onChange={(e) => setForm((f) => ({ ...f, fechaNacimiento: e.target.value }))}
                />
              </Campo>
              <Campo label="Teléfono" error={fieldErrors.telefono}>
                <input
                  type="tel"
                  className={inputClase('telefono')}
                  value={form.telefono}
                  onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                  placeholder="+57 300 123 4567"
                />
              </Campo>
              <Campo label="Correo electrónico" error={fieldErrors.correo}>
                <input
                  type="email"
                  className={inputClase('correo')}
                  value={form.correo}
                  onChange={(e) => setForm((f) => ({ ...f, correo: e.target.value }))}
                />
              </Campo>
              <Campo label="Género" error={fieldErrors.genero}>
                <select
                  className={inputClase('genero')}
                  value={form.genero}
                  onChange={(e) => setForm((f) => ({ ...f, genero: e.target.value }))}
                >
                  <option value="">— Sin especificar —</option>
                  <option value="femenino">Femenino</option>
                  <option value="masculino">Masculino</option>
                  <option value="otro">Otro</option>
                </select>
              </Campo>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="rounded border px-3 py-1.5 text-sm">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={save.isPending}
                className="rounded bg-emerald-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
              >
                {save.isPending ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {importOpen && <AsociadosImport onClose={() => setImportOpen(false)} />}
    </div>
  )
}
