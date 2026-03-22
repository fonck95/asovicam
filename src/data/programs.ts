export interface Program {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export const programs: Program[] = [
  {
    id: 'milpa-sostenible',
    title: 'Milpa Sostenible',
    description:
      'Implementación y expansión del sistema milpa con técnica de mulch en las fincas asociadas. Capacitación en siembra asociada y manejo agroecológico para nuevas familias.',
    icon: 'leaf',
  },
  {
    id: 'soberania-alimentaria',
    title: 'Soberanía Alimentaria',
    description:
      'Fortalecimiento de la producción local de alimentos sanos. Creación de bancos comunitarios de semillas criollas y ferias campesinas de intercambio.',
    icon: 'wheat',
  },
  {
    id: 'formacion-campesina',
    title: 'Formación Campesina',
    description:
      'Talleres y escuelas de campo donde los campesinos comparten saberes ancestrales y aprenden técnicas agroecológicas modernas adaptadas al Magdalena Medio.',
    icon: 'book',
  },
  {
    id: 'conservacion-territorio',
    title: 'Conservación del Territorio',
    description:
      'Protección de las ciénagas, humedales y bosques de la zona. Reforestación con especies nativas y manejo sostenible de los recursos hídricos.',
    icon: 'tree',
  },
];
