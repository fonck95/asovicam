import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import ScrollToTop from './components/ScrollToTop';
import ErrorBoundary from './components/ErrorBoundary';
import ContentProvider from './content/ContentProvider';
import { API_BASE_URL } from './lib/api';

const Home = lazy(() => import('./pages/Home'));
const About = lazy(() => import('./pages/About'));
const Milpa = lazy(() => import('./pages/Milpa'));
const Productos = lazy(() => import('./pages/Productos'));
const Experiencia = lazy(() => import('./pages/Experiencia'));
const Gallery = lazy(() => import('./pages/Gallery'));
const Contact = lazy(() => import('./pages/Contact'));
const Sorteo = lazy(() => import('./pages/Sorteo'));
const FAQ = lazy(() => import('./pages/FAQ'));
const AdminApp = lazy(() => import('./admin/AdminApp'));
const NotFound = lazy(() => import('./pages/NotFound'));

function PageLoader() {
  return (
    <div className="page-loader" role="status">
      <span className="page-loader__spinner" aria-hidden="true" />
      Cargando...
    </div>
  );
}

// El panel solo puede autenticarse servido same-origin con la API (la cookie
// de sesión es SameSite=Lax y no viaja cross-site): en cualquier otro dominio
// (Vercel, asovicam.org) /admin redirige al panel real en vez de renderizar
// una copia que jamás podría iniciar sesión. En dev se sirve local (proxy).
function AdminGate() {
  if (!import.meta.env.DEV && API_BASE_URL && API_BASE_URL !== window.location.origin) {
    window.location.replace(`${API_BASE_URL}/admin/`);
    return <PageLoader />;
  }
  return <AdminApp />;
}

export default function App() {
  return (
    <ErrorBoundary>
      {/* Contenido del CMS (API pública con fallback estático) para toda la app. */}
      <ContentProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Experiencia inmersiva: ruta full-bleed FUERA del Layout
                  (sin header/footer global) para máxima inmersión. El slug
                  opcional elige el cultivo (maíz / frijol / sandía). */}
              <Route path="experiencia" element={<Experiencia />} />
              <Route path="experiencia/:producto" element={<Experiencia />} />
              {/* Panel privado, separado del layout público. */}
              <Route path="admin/*" element={<AdminGate />} />
              <Route element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="nosotros" element={<About />} />
                <Route path="milpa" element={<Milpa />} />
                <Route path="productos" element={<Productos />} />
                <Route path="galeria" element={<Gallery />} />
                {/* El sorteo dejó de ser público: /sorteo solo muestra en vivo
                    los enlaces compartidos; la organización de sorteos vive en
                    la ruta de administración (sin enlaces en el sitio). */}
                <Route path="sorteo" element={<Sorteo modo="publico" />} />
                <Route path="contacto" element={<Contact />} />
                <Route path="preguntas" element={<FAQ />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ContentProvider>
    </ErrorBoundary>
  );
}
