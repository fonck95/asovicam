export type FieldType = 'text' | 'textarea' | 'select' | 'color' | 'list' | 'media' | 'number'

export interface FieldDef {
  name: string
  label: string
  type: FieldType
  required?: boolean
  options?: { value: string; label: string }[]
  help?: string
  /** para type=media */
  mediaKinds?: ('image' | 'document' | 'video')[]
}

export interface ResourceDef {
  /** segmento de URL de la API: /api/admin/<path> */
  path: string
  title: string
  singular: string
  /** campos mostrados como columnas en la tabla */
  columns: { name: string; label: string }[]
  fields: FieldDef[]
  /** aviso mostrado sobre la tabla */
  note?: string
}

export const RESOURCES: ResourceDef[] = [
  {
    path: 'programs',
    title: 'Programas',
    singular: 'programa',
    columns: [
      { name: 'title', label: 'Título' },
      { name: 'icon', label: 'Icono' },
    ],
    fields: [
      { name: 'slug', label: 'Slug', type: 'text', required: true, help: 'minúsculas-y-guiones' },
      { name: 'title', label: 'Título', type: 'text', required: true },
      { name: 'description', label: 'Descripción', type: 'textarea', required: true },
      {
        name: 'icon',
        label: 'Icono',
        type: 'select',
        required: true,
        options: [
          { value: 'leaf', label: 'Hoja (leaf)' },
          { value: 'wheat', label: 'Trigo (wheat)' },
          { value: 'book', label: 'Libro (book)' },
          { value: 'tree', label: 'Árbol (tree)' },
        ],
      },
    ],
  },
  {
    path: 'impact-stats',
    title: 'Estadísticas de impacto',
    singular: 'estadística',
    columns: [
      { name: 'value', label: 'Valor' },
      { name: 'label', label: 'Etiqueta' },
    ],
    fields: [
      { name: 'slug', label: 'Slug', type: 'text', required: true },
      { name: 'value', label: 'Valor', type: 'text', required: true, help: 'ej. "50+", "120", "70%"' },
      { name: 'label', label: 'Etiqueta', type: 'text', required: true },
      { name: 'description', label: 'Descripción', type: 'textarea', required: true },
    ],
  },
  {
    path: 'team-members',
    title: 'Equipo',
    singular: 'miembro',
    columns: [
      { name: 'name', label: 'Nombre' },
      { name: 'role', label: 'Rol' },
    ],
    fields: [
      { name: 'slug', label: 'Slug', type: 'text', required: true },
      { name: 'name', label: 'Nombre', type: 'text', required: true },
      { name: 'role', label: 'Rol', type: 'text', required: true },
      { name: 'description', label: 'Descripción', type: 'textarea', required: true },
      { name: 'photo', label: 'Foto', type: 'media', mediaKinds: ['image'] },
    ],
  },
  {
    path: 'testimonials',
    title: 'Testimonios',
    singular: 'testimonio',
    columns: [
      { name: 'author', label: 'Autor' },
      { name: 'role', label: 'Rol' },
    ],
    fields: [
      { name: 'author', label: 'Autor', type: 'text', required: true },
      { name: 'role', label: 'Rol', type: 'text', required: true },
      { name: 'content', label: 'Testimonio', type: 'textarea', required: true },
      { name: 'photo', label: 'Foto', type: 'media', mediaKinds: ['image'] },
    ],
  },
  {
    path: 'faqs',
    title: 'Preguntas frecuentes',
    singular: 'pregunta',
    columns: [
      { name: 'question', label: 'Pregunta' },
      { name: 'category', label: 'Categoría' },
    ],
    fields: [
      { name: 'question', label: 'Pregunta', type: 'text', required: true },
      { name: 'answer', label: 'Respuesta', type: 'textarea', required: true },
      {
        name: 'category',
        label: 'Categoría',
        type: 'select',
        required: true,
        options: [
          { value: 'general', label: 'General' },
          { value: 'milpa', label: 'La Milpa' },
          { value: 'participacion', label: 'Participación' },
        ],
      },
    ],
  },
  {
    path: 'crops',
    title: 'Cultivos',
    singular: 'cultivo',
    columns: [
      { name: 'icon', label: '' },
      { name: 'name', label: 'Nombre' },
      { name: 'scientificName', label: 'Nombre científico' },
    ],
    fields: [
      { name: 'slug', label: 'Slug', type: 'text', required: true },
      { name: 'name', label: 'Nombre', type: 'text', required: true },
      { name: 'scientificName', label: 'Nombre científico', type: 'text', required: true },
      { name: 'description', label: 'Descripción', type: 'textarea', required: true },
      { name: 'benefits', label: 'Beneficios', type: 'list', help: 'uno por línea' },
      { name: 'icon', label: 'Icono (emoji)', type: 'text', required: true, help: 'ej. 🌽' },
      { name: 'color', label: 'Color', type: 'color', required: true },
    ],
  },
  {
    path: 'gallery',
    title: 'Galería',
    singular: 'ítem de galería',
    note: 'Un ítem solo puede publicarse cuando tiene un medio adjunto.',
    columns: [
      { name: 'title', label: 'Título' },
      { name: 'category', label: 'Categoría' },
    ],
    fields: [
      { name: 'title', label: 'Título', type: 'text', required: true },
      { name: 'description', label: 'Descripción', type: 'textarea' },
      { name: 'media', label: 'Medio', type: 'media', mediaKinds: ['image', 'video'] },
      { name: 'category', label: 'Categoría', type: 'text' },
    ],
  },
  {
    path: 'home-slides',
    title: 'Slides del Home',
    singular: 'slide',
    note: 'Un slide solo puede publicarse cuando tiene imagen adjunta.',
    columns: [
      { name: 'title', label: 'Título' },
      { name: 'subtitle', label: 'Subtítulo' },
    ],
    fields: [
      { name: 'title', label: 'Título', type: 'text', required: true },
      { name: 'subtitle', label: 'Subtítulo', type: 'text' },
      { name: 'description', label: 'Descripción', type: 'textarea' },
      { name: 'badge', label: 'Badge', type: 'text' },
      { name: 'accent', label: 'Acento (CSS)', type: 'text', help: 'ej. var(--color-primary) o #059669' },
      { name: 'image', label: 'Imagen', type: 'media', mediaKinds: ['image'] },
    ],
  },
]
