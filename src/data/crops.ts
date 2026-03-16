import type { CropInfo } from '../types';

export const crops: CropInfo[] = [
  {
    id: 'maiz',
    name: 'Maíz',
    scientificName: 'Zea mays',
    description:
      'El pilar central de la milpa. El maíz proporciona la estructura vertical del sistema, sirviendo como tutor natural para el frijol. Es la base de la alimentación campesina y fuente de identidad cultural en el Magdalena Medio.',
    benefits: [
      'Base alimentaria rica en carbohidratos y fibra',
      'Estructura de soporte para cultivos asociados',
      'Adaptado al clima tropical del Magdalena Medio',
      'Múltiples usos: alimentación humana, animal y artesanal',
    ],
    icon: '🌽',
    color: '#F59E0B',
  },
  {
    id: 'frijol-caupi',
    name: 'Frijol Caupí',
    scientificName: 'Vigna unguiculata',
    description:
      'El frijol caupí es fundamental en el sistema milpa por su capacidad de fijar nitrógeno atmosférico al suelo, mejorando la fertilidad de manera natural. En Yondó, esta leguminosa se adapta perfectamente al clima cálido y húmedo.',
    benefits: [
      'Fijación biológica de nitrógeno al suelo',
      'Alto contenido proteico para la dieta campesina',
      'Tolerante a suelos de baja fertilidad',
      'Ciclo corto de producción (60-90 días)',
    ],
    icon: '🫘',
    color: '#059669',
  },
  {
    id: 'sandia',
    name: 'Sandía',
    scientificName: 'Citrullus lanatus',
    description:
      'La sandía actúa como cobertura viva en el sistema milpa, protegiendo el suelo de la erosión y manteniendo la humedad gracias a sus amplias hojas rastreras. La técnica de mulch potencia estos beneficios, creando un microclima ideal.',
    benefits: [
      'Cobertura del suelo que reduce la evaporación',
      'Control natural de arvenses (malezas)',
      'Fruto de alto valor comercial y nutricional',
      'Excelente adaptación al clima de Yondó',
    ],
    icon: '🍉',
    color: '#DC2626',
  },
];
