import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import ScrollToTop from './components/ScrollToTop';
import ErrorBoundary from './components/ErrorBoundary';

const Home = lazy(() => import('./pages/Home'));
const About = lazy(() => import('./pages/About'));
const Milpa = lazy(() => import('./pages/Milpa'));
const Productos = lazy(() => import('./pages/Productos'));
const Experiencia = lazy(() => import('./pages/Experiencia'));
const Gallery = lazy(() => import('./pages/Gallery'));
const Contact = lazy(() => import('./pages/Contact'));
const Sorteo = lazy(() => import('./pages/Sorteo'));
const FAQ = lazy(() => import('./pages/FAQ'));
const NotFound = lazy(() => import('./pages/NotFound'));

function PageLoader() {
  return (
    <div className="page-loader" role="status">
      <span className="page-loader__spinner" aria-hidden="true" />
      Cargando...
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ScrollToTop />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Experiencia inmersiva: ruta full-bleed FUERA del Layout
                (sin header/footer global) para máxima inmersión. El slug
                opcional elige el cultivo (maíz / frijol / sandía). */}
            <Route path="experiencia" element={<Experiencia />} />
            <Route path="experiencia/:producto" element={<Experiencia />} />
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="nosotros" element={<About />} />
              <Route path="milpa" element={<Milpa />} />
              <Route path="productos" element={<Productos />} />
              <Route path="galeria" element={<Gallery />} />
              <Route path="sorteo" element={<Sorteo />} />
              <Route path="contacto" element={<Contact />} />
              <Route path="preguntas" element={<FAQ />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
