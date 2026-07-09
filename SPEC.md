# SPEC — Backend de gestión de contenido + Dashboard para el sitio ASOVICAM

> Documento de arranque para el agente que construirá el repositorio del backend.
> Versión 1.0 — 2026-07-09

---

## 1. Contexto y objetivo

El sitio actual (`fonck95/asovicam`) es una SPA **React 19 + TypeScript + Vite**
desplegada en Vercel, **sin backend**. Todo el contenido visible está hardcodeado
en el código fuente:

| Contenido | Archivo actual | Página que lo usa |
|---|---|---|
| Navegación | `src/data/navigation.ts` | Header/Footer |
| Programas (4) | `src/data/programs.ts` | Home |
| Estadísticas de impacto (6) | `src/data/impact.ts` | Home |
| Equipo (4 miembros, sin foto) | `src/data/team.ts` | Nosotros |
| Testimonios (3) | `src/data/testimonials.ts` | Home |
| FAQ (8+ preguntas, 3 categorías) | `src/data/faq.ts` | Preguntas |
| Cultivos (maíz, frijol caupí, sandía) | `src/data/crops.ts` | La Milpa / Home |
| Galería | `src/pages/Gallery.tsx` (placeholders con emoji, **sin fotos reales**) | Galería |
| Slides del carrusel 3D del Home | `src/pages/Home.tsx` (`productSlides`) | Home |
| Textos del visor 3D | `src/components/ProductViewer/products.js` | Productos |
| Textos de la experiencia scroll | `src/components/Experience/sections*.js` | Experiencia 3D |
| Datos de contacto (tel, email, ubicación) | hardcodeados en varios archivos | Contacto/Footer |
| Formulario de contacto | `src/hooks/useContactForm.ts` — hoy abre `mailto:` (sin backend) | Contacto |

**Objetivo:** construir un repositorio nuevo (`asovicam-backend`) con:

1. Una **API REST** que sirva ese contenido de forma dinámica (lectura pública)
   y permita administrarlo (escritura autenticada).
2. Un **dashboard web** donde un manager edita todo lo que la web muestra.
3. **Carga de archivos multimedia** (imágenes, documentos, video) a Cloudflare R2,
   para reemplazar los placeholders de la galería y añadir fotos al equipo,
   slides del Home, etc.

La conexión del frontend actual a esta API es una **fase posterior** (fuera del
alcance de este repo), pero el contrato de la API pública queda definido aquí
(§7) para que esa integración sea directa.

---

## 2. Variables de entorno (restricción dura)

Del servicio existente **solo** se toman estos tres grupos. **No** usar
Cloudinary, OpenAI, Anthropic, Google API Key ni MCP.

### 2.1 Autorización del manager
| Variable | Uso |
|---|---|
| `ADMIN_EMAIL` | Whitelist de acceso al dashboard. Soportar lista separada por comas (`a@x.com,b@y.com`) para permitir más managers a futuro sin cambiar código. |

### 2.2 Inicio de sesión con Google (OAuth 2.0)
| Variable | Uso |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth 2.0 Authorization Code Flow |
| `GOOGLE_CLIENT_SECRET` | ídem |
| `GOOGLE_CALLBACK_URL` | Redirect URI registrada en Google Cloud Console, p. ej. `https://<backend>/auth/google/callback` |

### 2.3 Cloudflare R2 (multimedia y documentos)
| Variable | Uso |
|---|---|
| `R2_ACCOUNT_ID` | Cuenta de Cloudflare |
| `R2_ACCESS_KEY_ID` | Credencial S3-compatible |
| `R2_SECRET_ACCESS_KEY` | Credencial S3-compatible |
| `R2_BUCKET_NAME` | Bucket destino |
| `R2_ENDPOINT` | `https://<account_id>.r2.cloudflarestorage.com` |

### 2.4 Infraestructura mínima (no negociable para que el backend exista)
Estas no son integraciones nuevas, son el mínimo operativo; ya existen en el
servicio de referencia:

| Variable | Uso |
|---|---|
| `MONGODB_URI` | Persistencia del contenido |
| `SESSION_SECRET` | Firma de la cookie de sesión |
| `FRONTEND_URL` | Origen permitido en CORS (el sitio Vercel) |
| `PUBLIC_BASE_URL` | URL pública del propio backend (para armar el callback y URLs absolutas) |
| `NODE_ENV` | `production` / `development` |
| `PORT` | Puerto HTTP (default `3000`) |

---

## 3. Stack técnico

- **Runtime:** Node.js 22 LTS, TypeScript estricto, ESM.
- **Servidor:** Express 5 (o Fastify si el agente lo prefiere; mantener simple).
- **DB:** MongoDB + Mongoose.
- **Auth:** `google-auth-library` u `openid-client` (Authorization Code Flow) +
  sesión con cookie `httpOnly` firmada (`express-session` + `connect-mongo`).
  **No** usar Passport si añade complejidad innecesaria; el flujo es uno solo.
- **R2:** `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (R2 es
  S3-compatible; `region: "auto"`, `endpoint: R2_ENDPOINT`).
- **Validación:** `zod` en todos los bodies de escritura.
- **Dashboard:** React + Vite + TypeScript en el mismo repo (`apps/dashboard`),
  servido como estático por el backend bajo `/admin`. React Router +
  TanStack Query. UI sencilla y funcional (Tailwind); no invertir en diseño
  elaborado en la fase inicial.

### Estructura del repo

```
asovicam-backend/
├── package.json            # workspaces: server, dashboard
├── .env.example            # todas las variables de §2, sin valores
├── apps/
│   ├── server/
│   │   └── src/
│   │       ├── index.ts            # bootstrap, CORS, sesión, estáticos de /admin
│   │       ├── config/env.ts       # carga y valida env con zod; falla al arrancar si falta algo
│   │       ├── auth/               # rutas OAuth + middleware requireAdmin
│   │       ├── models/             # esquemas Mongoose (§5)
│   │       ├── routes/public.ts    # API pública de lectura (§7)
│   │       ├── routes/admin/       # CRUD autenticado por recurso
│   │       ├── media/r2.ts         # cliente R2, presign, delete
│   │       └── seed/seed.ts        # importa el contenido actual del sitio (§6)
│   └── dashboard/                  # SPA del manager
└── README.md
```

---

## 4. Autenticación y autorización

Flujo único: **Google OAuth 2.0 Authorization Code**.

1. `GET /auth/google` → redirige a Google (`scope: openid email profile`,
   `prompt: select_account`).
2. `GET /auth/google/callback` → intercambia el code, **verifica el `id_token`**
   y extrae `email` + `email_verified`.
3. **Autorización:** si `email_verified === true` y el email (case-insensitive)
   está en `ADMIN_EMAIL` → crear sesión y redirigir a `/admin`. Si no →
   `403` con página "Cuenta no autorizada" y **sin sesión**.
4. `POST /auth/logout` → destruye la sesión.
5. `GET /auth/me` → `{ email, name, picture }` o `401`.

Reglas:
- Cookie `httpOnly`, `secure` en producción, `sameSite=lax`, expiración 7 días.
- Middleware `requireAdmin` protege **todo** `/api/admin/*`. No existe registro
  de usuarios, ni roles, ni contraseñas: la whitelist es la única puerta.
- Rate limit en `/auth/*` y `/api/admin/*` (p. ej. `express-rate-limit`).

---

## 5. Modelo de datos (colecciones Mongoose)

Campos comunes a todo documento editable: `order: number`,
`published: boolean` (default `true`), `createdAt/updatedAt` (timestamps),
`updatedBy: string` (email del manager).

| Colección | Campos específicos (espejo de los tipos actuales del frontend + foto donde aplica) |
|---|---|
| `programs` | `slug`, `title`, `description`, `icon` (enum: `leaf\|wheat\|book\|tree`) |
| `impact_stats` | `slug`, `value` (string, ej. `"50+"`), `label`, `description` |
| `team_members` | `slug`, `name`, `role`, `description`, `photo?: MediaRef` |
| `testimonials` | `author`, `role`, `content`, `photo?: MediaRef` |
| `faqs` | `question`, `answer`, `category` (enum: `general\|milpa\|participacion`) |
| `crops` | `slug`, `name`, `scientificName`, `description`, `benefits: string[]`, `icon` (emoji), `color` (hex) |
| `gallery_items` | `title`, `description`, `media: MediaRef` (requerido), `category?` |
| `home_slides` | `title`, `subtitle`, `description`, `badge`, `accent`, `image: MediaRef` |
| `media` | `key` (ruta en R2), `url` (pública), `mime`, `size`, `width?`, `height?`, `alt`, `kind: image\|document\|video`, `uploadedBy` |
| `settings` | **Documento singleton** con: `contact { phone, email, address, whatsapp }`, `social { facebook?, instagram?, ... }`, `hero { badge, title, highlight, subtitle }`, `seo { defaultTitle, defaultDescription }` |
| `contact_messages` | (Fase 2, opcional) `name`, `email`, `subject`, `message`, `read: boolean` — destino del formulario de contacto que hoy usa `mailto:` |

`MediaRef` = `{ mediaId: ObjectId, url: string, alt: string }` (URL denormalizada
para que la API pública no haga joins).

**No modelar todavía** los textos del visor 3D ni de la experiencia scroll
(`ProductViewer/products.js`, `Experience/sections*.js`): están acoplados a
animaciones y coordenadas. Se evaluará en una fase posterior.

---

## 6. Seed obligatorio

`npm run seed` debe poblar la DB con el contenido **actual** del sitio, copiado
literalmente de:

- `src/data/programs.ts`, `impact.ts`, `team.ts`, `testimonials.ts`, `faq.ts`, `crops.ts`
- `productSlides` de `src/pages/Home.tsx`
- `galleryItems` de `src/pages/Gallery.tsx` (sin media; quedarán `published: false` hasta que el manager suba fotos reales)
- Settings: teléfono `+57 316 557 0682`, email `asovicam2023@gmail.com`,
  ubicación "Ciénaga de Barbacoas, Yondó, Antioquia", y los textos del hero del Home.

El seed es **idempotente** (upsert por `slug`/clave natural) y nunca borra datos.

---

## 7. API

### 7.1 Pública (consumida por el sitio; sin auth, solo lectura)

```
GET /api/public/content        → bundle completo (ver shape abajo)
GET /api/public/gallery        → solo galería publicada
GET /health                    → { ok: true }
```

`GET /api/public/content` responde (solo documentos `published: true`,
ordenados por `order`):

```jsonc
{
  "settings":     { "contact": {...}, "social": {...}, "hero": {...}, "seo": {...} },
  "programs":     [ { "id", "slug", "title", "description", "icon" } ],
  "impactStats":  [ { "id", "slug", "value", "label", "description" } ],
  "teamMembers":  [ { "id", "slug", "name", "role", "description", "photo": { "url", "alt" } | null } ],
  "testimonials": [ { "id", "author", "role", "content" } ],
  "faqs":         [ { "id", "question", "answer", "category" } ],
  "crops":        [ { "id", "slug", "name", "scientificName", "description", "benefits", "icon", "color" } ],
  "homeSlides":   [ { "id", "title", "subtitle", "description", "badge", "accent", "image": { "url", "alt" } } ],
  "gallery":      [ { "id", "title", "description", "media": { "url", "alt", "kind" } } ],
  "updatedAt":    "ISO-8601"
}
```

Requisitos: CORS restringido a `FRONTEND_URL`, `ETag` + `Cache-Control:
public, max-age=60, stale-while-revalidate=300`, respuesta < 100 KB (las
imágenes van por URL de R2, nunca embebidas).

> Contrato de integración futura: el frontend hará un fetch de este bundle al
> arrancar y usará sus `src/data/*.ts` actuales como **fallback** si la API no
> responde. Los tipos del bundle son un superconjunto de `src/types/index.ts`.

### 7.2 Admin (requiere sesión; prefijo `/api/admin`)

CRUD homogéneo por recurso — `programs`, `impact-stats`, `team-members`,
`testimonials`, `faqs`, `crops`, `gallery`, `home-slides`:

```
GET    /api/admin/<recurso>          → lista completa (incluye no publicados)
POST   /api/admin/<recurso>          → crear (body validado con zod)
PUT    /api/admin/<recurso>/:id      → actualizar
DELETE /api/admin/<recurso>/:id      → eliminar
PATCH  /api/admin/<recurso>/reorder  → { ids: [...] } reordena en lote
GET    /api/admin/settings           → singleton
PUT    /api/admin/settings           → singleton
```

### 7.3 Media (R2)

Subida por **URL prefirmada** (el archivo nunca pasa por el servidor):

```
POST   /api/admin/media/presign   body: { filename, mime, size }
       → valida mime (imágenes: jpg/png/webp/avif; docs: pdf; video: mp4)
         y tamaño (imágenes ≤ 10 MB, docs ≤ 20 MB, video ≤ 100 MB)
       → key: media/<yyyy>/<mm>/<nanoid>-<filename-slug>
       → responde { uploadUrl (PUT prefirmado, exp. 10 min), key, publicUrl }
POST   /api/admin/media/confirm   body: { key, alt, ... } → crea doc en `media`
GET    /api/admin/media           → listado paginado con filtro por kind
DELETE /api/admin/media/:id       → borra objeto en R2 + doc; rechazar (409)
                                    si está referenciado por otro documento
```

`publicUrl`: el bucket debe exponerse vía dominio público de R2 (r2.dev o
dominio propio). Configurar la base como constante derivable o variable
adicional documentada en `.env.example`; **no** firmar URLs de lectura para
contenido público del sitio.

---

## 8. Dashboard (`/admin`)

SPA mínima y funcional:

- **Login:** pantalla con botón "Entrar con Google" → `/auth/google`.
  Si `GET /auth/me` da 401, siempre redirigir aquí.
- **Layout:** sidebar con secciones = recursos de §7.2 + Medios + Ajustes.
- **Por recurso:** tabla (drag & drop para `order`, toggle `published`) +
  formulario de edición (crear/editar/eliminar con confirmación).
- **Medios:** grid de archivos subidos, botón de subida (presign → PUT directo
  a R2 → confirm), campo `alt` obligatorio para imágenes.
- **Selector de media:** en los formularios que aceptan `MediaRef` (foto de
  equipo, galería, slides), modal que lista `media` y permite subir en el acto.
- **Ajustes:** formulario del singleton `settings`.
- Toda mutación muestra éxito/error; nada de estados silenciosos.

---

## 9. Fases de construcción y criterios de aceptación

Construir en este orden; cada fase debe quedar verificada antes de seguir.

**Fase 0 — Scaffold.** Monorepo, TS, lint, `config/env.ts` validando §2 con
zod, `GET /health`. ✅ El server arranca y falla con mensaje claro si falta
una variable.

**Fase 1 — Auth.** Flujo Google completo + whitelist `ADMIN_EMAIL` + sesión +
`requireAdmin`. ✅ Un email de la whitelist entra; cualquier otro recibe 403;
`/api/admin/*` sin sesión da 401.

**Fase 2 — Modelos + CRUD + seed.** Todo §5, §6, §7.2. ✅ `npm run seed`
puebla la DB con el contenido actual del sitio; el CRUD funciona vía curl.

**Fase 3 — Media R2.** §7.3 completo. ✅ Se sube una imagen real con presigned
PUT, queda accesible por su `publicUrl` y aparece en el listado.

**Fase 4 — API pública.** §7.1 con ETag y CORS. ✅ El bundle refleja en <60 s
cualquier edición hecha por el CRUD.

**Fase 5 — Dashboard.** §8 servido en `/admin`. ✅ Un manager puede, sin tocar
código: editar una FAQ, reordenar programas, subir una foto a la galería y
publicarla, y editar el teléfono de contacto.

**Fase 6 (fuera de este repo) — Conexión del frontend.** El sitio consume
`GET /api/public/content` con fallback a los datos estáticos. No implementar
aquí; el contrato de §7.1 es la interfaz.

---

## 10. Seguridad — checklist mínimo

- [ ] Whitelist `ADMIN_EMAIL` verificada contra `id_token` de Google (no contra datos del perfil sin verificar).
- [ ] Cookie `httpOnly` + `secure` + `sameSite=lax`; `SESSION_SECRET` fuerte.
- [ ] CORS: `FRONTEND_URL` para la API pública; el dashboard es same-origin.
- [ ] Validación zod en toda escritura; sanitizar strings (el frontend renderiza texto plano, nunca HTML del CMS).
- [ ] Límites de tamaño/mime en presign; keys de R2 generadas por el server, jamás por el cliente.
- [ ] Rate limiting en `/auth/*` y `/api/admin/*`.
- [ ] Ningún secreto en el repo; `.env.example` solo con nombres.
- [ ] Logs sin PII más allá del email del manager en `updatedBy`.
