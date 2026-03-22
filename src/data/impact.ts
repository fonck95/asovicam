export interface ImpactStat {
  id: string;
  value: string;
  label: string;
  description: string;
}

export const impactStats: ImpactStat[] = [
  {
    id: 'familias',
    value: '50+',
    label: 'Familias campesinas',
    description: 'Familias asociadas que practican agricultura sostenible con el sistema milpa en Yondó.',
  },
  {
    id: 'hectareas',
    value: '120',
    label: 'Hectáreas cultivadas',
    description: 'Hectáreas de tierra productiva bajo el modelo agroecológico de milpa con mulch.',
  },
  {
    id: 'quimicos',
    value: '0',
    label: 'Agroquímicos',
    description: 'Cero uso de pesticidas sintéticos o fertilizantes artificiales en nuestros cultivos.',
  },
  {
    id: 'agua',
    value: '70%',
    label: 'Menos evaporación',
    description: 'Reducción de la evaporación del agua gracias a la técnica de mulch como cobertura orgánica.',
  },
  {
    id: 'produccion',
    value: '3x',
    label: 'Más diversidad',
    description: 'Tres cultivos simultáneos por parcela frente al monocultivo convencional.',
  },
  {
    id: 'alimentos',
    value: '100%',
    label: 'Orgánico',
    description: 'Toda la producción es orgánica, libre de químicos y amigable con el medio ambiente.',
  },
];
