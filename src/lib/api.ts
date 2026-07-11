// Único punto donde el frontend conoce la URL del backend. El valor viene
// de VITE_API_BASE_URL (inyectada en build time); nunca hardcodear el
// dominio en otros archivos ni anteponerle "www.".
export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') ?? '';

// El dashboard de administración vive en el backend y solo se alcanza por
// navegación de página completa: sus rutas /auth/* y /api/admin/* no tienen
// CORS (a propósito), así que jamás hacerle fetch desde este origen.
export const ADMIN_DASHBOARD_URL = `${API_BASE_URL}/admin`;
