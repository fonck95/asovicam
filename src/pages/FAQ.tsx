import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import SEO from '../components/SEO';
import { useContent } from '../content/ContentContext';
import styles from './FAQ.module.css';

const categories = [
  { key: 'all', label: 'Todas' },
  { key: 'general', label: 'General' },
  { key: 'milpa', label: 'La Milpa' },
  { key: 'participacion', label: 'Participación' },
] as const;

export default function FAQ() {
  const { faqs: faqItems } = useContent();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const toggleQuestion = (id: string) => {
    setActiveId((prev) => (prev === id ? null : id));
  };

  const filteredItems = activeCategory === 'all'
    ? faqItems
    : faqItems.filter((item) => item.category === activeCategory);

  return (
    <>
      <SEO
        title="Preguntas Frecuentes"
        description="Respuestas a las preguntas más comunes sobre ASOVICAM, el sistema milpa, la técnica de mulch y cómo participar en nuestra asociación campesina."
      />

      <section className={styles.hero}>
        <div className="container">
          <h1 className={styles.heroTitle}>Preguntas Frecuentes</h1>
          <p className={styles.heroSubtitle}>
            Respuestas sobre ASOVICAM, la milpa y cómo participar
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className={styles.filters}>
            {categories.map((cat) => (
              <button
                key={cat.key}
                className={`${styles.filterBtn} ${activeCategory === cat.key ? styles.filterBtnActive : ''}`}
                onClick={() => setActiveCategory(cat.key)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className={styles.list}>
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className={`${styles.item} ${activeId === item.id ? styles.itemOpen : ''}`}
              >
                <button
                  className={styles.question}
                  onClick={() => toggleQuestion(item.id)}
                  aria-expanded={activeId === item.id}
                >
                  <span>{item.question}</span>
                  <ChevronDown size={20} className={styles.chevron} />
                </button>
                <div className={styles.answer}>
                  <p>{item.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
