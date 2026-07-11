import { useEffect } from 'react';
import SEO from '../components/SEO';
import { ADMIN_DASHBOARD_URL, API_BASE_URL } from '../lib/api';

/**
 * Atajo local: www.asovicam.org/admin → dashboard real del backend
 * (api.asovicam.org/admin). El dashboard maneja su propio login con Google,
 * así que aquí solo se navega (página completa) y no se renderiza nada más.
 */
export default function Admin() {
  useEffect(() => {
    // Sin API configurada no se redirige: `${''}/admin` apuntaría a esta
    // misma ruta y crearía un bucle infinito de redirecciones.
    if (API_BASE_URL) window.location.replace(ADMIN_DASHBOARD_URL);
  }, []);

  return (
    <>
      <SEO
        title="Acceso administradores"
        description="Acceso al panel de administración de ASOVICAM."
        noindex
      />
      <div className="page-loader" role="status">
        {API_BASE_URL ? (
          <>
            <span className="page-loader__spinner" aria-hidden="true" />
            Abriendo el panel de administración…
          </>
        ) : (
          'Panel no disponible: falta configurar VITE_API_BASE_URL.'
        )}
      </div>
    </>
  );
}
