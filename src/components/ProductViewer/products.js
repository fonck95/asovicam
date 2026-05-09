// =====================================================
// Datos de los productos del visor 3D.
// Edita aquí textos y datos clave; los modelos se construyen
// proceduralmente, así que no hay archivos .glb que mantener.
// =====================================================

export const products = [
  {
    id: 'maiz',
    name: 'Maíz',
    scientificName: 'Zea mays',
    tagline: 'El pilar de la milpa campesina',
    description:
      'Variedad criolla adaptada al trópico húmedo del Magdalena Medio. ' +
      'Aporta la estructura vertical del sistema milpa y es la base alimentaria de la región.',
    color: '#f59e0b',
    accent: 'from-amber-400 via-yellow-500 to-amber-600',
    facts: [
      { label: 'Variedad', value: 'Criolla amarilla' },
      { label: 'Ciclo de cultivo', value: '120 – 150 días' },
      { label: 'Región', value: 'Yondó, Antioquia' },
      { label: 'Rendimiento', value: '2.8 – 3.5 t/ha' },
    ],
  },
  {
    id: 'frijol',
    name: 'Frijol Caupí',
    scientificName: 'Vigna unguiculata',
    tagline: 'Fija nitrógeno y nutre el suelo',
    description:
      'Leguminosa tropical de ciclo corto, ideal para suelos de baja fertilidad. ' +
      'Fija nitrógeno atmosférico mejorando el suelo de forma natural.',
    color: '#059669',
    accent: 'from-emerald-400 via-green-500 to-emerald-600',
    facts: [
      { label: 'Variedad', value: 'Caupí regional' },
      { label: 'Ciclo de cultivo', value: '60 – 90 días' },
      { label: 'Región', value: 'Magdalena Medio' },
      { label: 'Rendimiento', value: '0.9 – 1.4 t/ha' },
    ],
  },
  {
    id: 'sandia',
    name: 'Sandía',
    scientificName: 'Citrullus lanatus',
    tagline: 'Cobertura viva, cosecha dulce',
    description:
      'Cobertura rastrera que protege el suelo, conserva la humedad y entrega un fruto ' +
      'de alto valor comercial para los mercados locales.',
    color: '#dc2626',
    accent: 'from-rose-400 via-red-500 to-rose-600',
    facts: [
      { label: 'Variedad', value: 'Charleston Gray' },
      { label: 'Ciclo de cultivo', value: '80 – 100 días' },
      { label: 'Región', value: 'Yondó, Antioquia' },
      { label: 'Rendimiento', value: '18 – 25 t/ha' },
    ],
  },
];

export const getProductById = (id) =>
  products.find((p) => p.id === id) ?? products[0];
