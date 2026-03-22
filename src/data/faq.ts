export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: 'general' | 'milpa' | 'participacion';
}

export const faqItems: FAQItem[] = [
  {
    id: '1',
    question: '¿Qué es ASOVICAM?',
    answer:
      'ASOVICAM (Asociación Campesina Vida en el Campo) es una organización de base comunitaria ubicada en la Ciénaga de Barbacoas, municipio de Yondó, Antioquia, en la región del Magdalena Medio colombiano. Agrupa a más de 50 familias campesinas dedicadas a la agricultura sostenible mediante el sistema milpa con técnica de mulch.',
    category: 'general',
  },
  {
    id: '2',
    question: '¿Qué es el sistema milpa?',
    answer:
      'La milpa es un sistema de cultivo ancestral de origen mesoamericano basado en la siembra asociada de múltiples especies que se complementan entre sí. En ASOVICAM cultivamos maíz, frijol caupí y sandía juntos. El maíz sirve de soporte estructural, el frijol caupí fija nitrógeno al suelo mejorando la fertilidad, y la sandía cubre el suelo con sus guías rastreras reduciendo la erosión y las malezas.',
    category: 'milpa',
  },
  {
    id: '3',
    question: '¿Qué es la técnica de mulch?',
    answer:
      'El mulch o acolchado consiste en cubrir el suelo con una capa de materia orgánica como hojas secas, restos de cosecha y pasto cortado. Esta cobertura protege el suelo de la erosión, retiene la humedad (reduciendo la evaporación hasta en un 70%), suprime malezas, regula la temperatura del suelo y al descomponerse aporta nutrientes de forma natural. Es especialmente valiosa en el clima cálido y húmedo de Yondó.',
    category: 'milpa',
  },
  {
    id: '4',
    question: '¿Por qué estos tres cultivos juntos?',
    answer:
      'El maíz (Zea mays) proporciona la estructura vertical y sirve de tutor para el frijol. El frijol caupí (Vigna unguiculata) fija nitrógeno atmosférico al suelo, mejorando la fertilidad naturalmente y reduciendo la necesidad de fertilizantes. La sandía (Citrullus lanatus) actúa como cobertura viva del suelo, reduciendo malezas y evaporación. Juntos imitan un ecosistema natural y producen alimentos diversos con mayor productividad por hectárea que el monocultivo.',
    category: 'milpa',
  },
  {
    id: '5',
    question: '¿Dónde se encuentra ASOVICAM?',
    answer:
      'Estamos ubicados en la Ciénaga de Barbacoas, municipio de Yondó, departamento de Antioquia, Colombia. Yondó se encuentra en el margen oriental de Antioquia, a orillas del río Magdalena, en la región conocida como Magdalena Medio. El territorio tiene clima tropical cálido y húmedo (28-35°C), altitud entre 75-150 msnm y suelos aluviales fértiles ideales para la milpa.',
    category: 'general',
  },
  {
    id: '6',
    question: '¿Los productos de ASOVICAM son orgánicos?',
    answer:
      'Sí. Nuestro modelo de producción es 100% orgánico y sostenible. No utilizamos agroquímicos, pesticidas sintéticos ni fertilizantes artificiales. La fertilidad del suelo se mantiene mediante la técnica de mulch, la fijación biológica de nitrógeno del frijol caupí y la rotación natural de cultivos. Producimos alimentos sanos, libres de químicos.',
    category: 'milpa',
  },
  {
    id: '7',
    question: '¿Puedo visitar los cultivos de ASOVICAM?',
    answer:
      'Sí, recibimos visitas de personas interesadas en conocer nuestro modelo agroecológico. Organizamos recorridos por las fincas asociadas donde se puede ver el sistema milpa en funcionamiento, conocer a los campesinos y aprender sobre la técnica de mulch. Para coordinar una visita, contáctanos al +57 316 557 0682 o escríbenos a asovicam2023@gmail.com.',
    category: 'participacion',
  },
  {
    id: '8',
    question: '¿Cómo puedo apoyar a ASOVICAM?',
    answer:
      'Hay varias formas de apoyarnos: comprando nuestros productos agrícolas (maíz, frijol caupí, sandía); estableciendo alianzas institucionales o académicas; participando como voluntario en jornadas de siembra; difundiendo nuestro trabajo en redes sociales; o contactándonos para explorar formas de colaboración. Cada apoyo fortalece la agricultura campesina sostenible.',
    category: 'participacion',
  },
  {
    id: '9',
    question: '¿Cuánto dura el ciclo de cultivo de la milpa?',
    answer:
      'El ciclo completo es de aproximadamente 150 días. La cosecha es escalonada: el frijol caupí se cosecha primero entre los 60-90 días, la sandía entre los 80-100 días, y el maíz al final entre los 120-150 días. Este escalonamiento permite un flujo continuo de alimentos y reduce el riesgo de pérdidas.',
    category: 'milpa',
  },
  {
    id: '10',
    question: '¿Cómo puedo asociarme a ASOVICAM?',
    answer:
      'Si eres campesino del municipio de Yondó o la región del Magdalena Medio y estás interesado en la agricultura sostenible, puedes solicitar tu vinculación. Contáctanos para conocer los requisitos y beneficios de ser parte de la asociación. Ofrecemos acompañamiento técnico, acceso a semillas criollas y participación en los programas de formación.',
    category: 'participacion',
  },
];
