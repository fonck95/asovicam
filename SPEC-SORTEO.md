# SPEC — Sorteo de lotes: API backend

> Documento complementario de `SPEC.md` para el repositorio `asovicam-backend`.
> Define las rutas y reglas para operar el sorteo de lotes desde el backend.
> Versión 1.0 — 2026-07-10. **Solo especificación: no implementar en el
> frontend todavía; la sincronización es una fase posterior (§11).**

---

## 1. Contexto y objetivo

La ruta `/sorteo` del sitio (`fonck95/asovicam`) ya sortea lotes de un mapa
entre personas o agrupaciones **sin backend**: toda la configuración
(participantes, semilla, hora de inicio, intervalo y mapa opcional) viaja
comprimida en el **hash de la URL**, y cada dispositivo reconstruye el mismo
sorteo de forma **determinista** y lo revela sincronizado por reloj.

Código fuente de referencia (normativo para este spec):

| Pieza | Archivo del frontend |
|---|---|
| Algoritmo determinista (PRNG, barajado, asignaciones, estado) | `src/utils/sorteo.ts` |
| Codificación del enlace (v1 y v2) | `src/utils/sorteo.ts` |
| Parser KML/KMZ y reglas de lotes/lindero | `src/utils/kml.ts` |
| Mapa predeterminado (48 parcelas LA FARAONA) | `src/data/parcelas.ts`, `src/data/mapaPredeterminado.ts` |
| Tipos `Lote` / `MapaSorteo` | `src/types/index.ts` |

**Qué aporta el backend** (motivación de este spec):

1. **Enlaces cortos y estables** (`/sorteo?id=abc123xyz9`) en lugar de un hash
   de cientos/miles de caracteres.
2. **Custodia de la semilla (commit–reveal, §5):** hoy cualquiera que reciba el
   enlace antes del inicio puede precomputar el resultado; con el backend la
   semilla no se conoce hasta la hora de inicio, ni siquiera el organizador.
3. **Persistencia y acta:** historial de sorteos, resultados descargables,
   auditoría.
4. **Tiempo real por push (SSE)** además del cálculo por reloj.

**Requisito duro:** el backend debe reproducir el algoritmo del §4
**bit-exacto**. El frontend seguirá verificando resultados localmente; los
vectores de prueba del §10 son el criterio de aceptación.

---

## 2. Alcance

**Incluye:** modelo de datos, rutas públicas y de admin, SSE, interop con el
formato de enlace actual (importar/exportar), validaciones y seguridad.

**Excluye (fases posteriores):** cambios en el frontend (§11), parsing de
KML/KMZ en el servidor (el frontend ya parsea y envía el mapa como JSON
`MapaSorteo`), panel visual del dashboard (basta el CRUD; ver `SPEC.md` §8
para integrarlo luego como una sección más), autenticación de espectadores
(no existe: los sorteos públicos se ven con solo tener el `publicId`).

Convenciones heredadas de `SPEC.md`: stack (§3), auth de admin por sesión
Google + whitelist (§4), validación con zod, CORS a `FRONTEND_URL`, rate
limiting, formato de errores homogéneo.

---

## 3. Modelo de datos

### 3.1 Tipos base (idénticos a `src/types/index.ts` del frontend)

```jsonc
// Lote — un polígono sorteable
{
  "nombre": "Parcela 7",          // string 1..80
  "areaHa": 11.76,                 // number > 0 | null
  "coords": [[6.78194, -74.28305], /* … */],  // [lat, lng][] con ≥ 3 vértices
  "centro": [6.78035, -74.28112]   // [lat, lng] para la etiqueta
}

// MapaSorteo
{
  "nombre": "Predio LA FARAONA — ASOVICAM",
  "lotes": [ /* Lote[] con 2..2000 elementos */ ],
  "limite": [[/* lat,lng */], /* … */] | null   // lindero opcional
}
```

### 3.2 Colección `sorteos`

| Campo | Tipo / reglas |
|---|---|
| `publicId` | string nanoid **12** (alfabeto URL-safe), único, indexado. Es el identificador que viaja en enlaces públicos. |
| `nombre` | string 0..120, opcional (etiqueta interna, ej. "Sorteo asamblea julio"). |
| `participantes` | `string[]` 1..1000, cada uno 1..80 chars, trim, **el orden de la lista importa** (entra al algoritmo §4). Duplicados permitidos. |
| `seed` | entero sin signo de 32 bits generado con CSPRNG del servidor. **Secreto hasta `inicio`** (§5). |
| `seedHash` | `sha256(`${publicId}:${seed}`)` en hex, público desde la creación. |
| `inicio` | época Unix en **ms** (UTC). |
| `intervaloMs` | entero 500..600000. |
| `mapa` | `MapaSorteo` embebido **o** `null` si usa el mapa predeterminado del frontend (las 48 parcelas; el backend solo necesita saber `totalLotes = 48` en ese caso — puede copiar `src/data/parcelas.ts` como seed para servir el CSV con nombres). |
| `totalLotes` | entero, denormalizado: `mapa.lotes.length` o 48. Debe cumplir `participantes.length ≤ totalLotes`. |
| `asignaciones` | `[{ parcelaIdx: number, participante: string }]` — **precomputadas una sola vez al crear** con el algoritmo §4 y nunca recalculadas. `asignaciones[i]` se hace pública en `inicio + i·intervaloMs`. |
| `cancelado` | `{ en: ms, motivo?: string } \| null`. |
| `origen` | `'api' \| 'enlace-importado'`. |
| `createdBy`, timestamps | como en `SPEC.md` §5. |

**Estado derivado** (no se almacena; se calcula con el reloj del servidor):

```
cancelado ≠ null                        → 'cancelado'
ahora <  inicio                         → 'programado'
reveladas(ahora) <  participantes.length → 'en_curso'
reveladas(ahora) == participantes.length → 'finalizado'
```

---

## 4. Algoritmo determinista (NORMATIVO)

El código de `src/utils/sorteo.ts` es la referencia. Portarlo respetando la
**aritmética de enteros de 32 bits de JavaScript**: `>>> 0` (a uint32), `| 0`
(a int32 con wrap), `Math.imul` (multiplicación con wrap a int32), `^`, `>>>`.
En lenguajes sin esos operadores, enmascarar con `& 0xFFFFFFFF` y manejar el
signo explícitamente.

### 4.1 PRNG `mulberry32(seed)`

```js
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;   // float en [0, 1)
  };
}
```

### 4.2 Barajado `barajar(items, rng)` — Fisher–Yates descendente

```js
for (let i = items.length - 1; i > 0; i--) {
  const j = Math.floor(rng() * (i + 1));
  [items[i], items[j]] = [items[j], items[i]];
}
```

### 4.3 Asignaciones `calcularAsignaciones({ participantes, seed }, totalLotes)`

**El orden de consumo del PRNG es parte del contrato:** primero se barajan
los índices de lotes, después los participantes, con el **mismo** stream.

```js
const rng     = mulberry32(seed);
const orden   = barajar([0, 1, …, totalLotes - 1], rng);  // 1º: lotes
const personas = barajar(participantes, rng);               // 2º: participantes
const asignaciones = personas.map((p, i) => ({ parcelaIdx: orden[i], participante: p }));
```

`parcelaIdx` es el índice del lote dentro de `mapa.lotes` (0-based). Si hay
menos participantes que lotes, los índices `orden[n..]` quedan libres.

### 4.4 Estado por reloj `estadoSorteo(config, ahora)`

```js
if (ahora < inicio) → { fase: 'previa', reveladas: 0, msParaInicio: inicio - ahora }
reveladas = min(n, floor((ahora - inicio) / intervaloMs) + 1)   // n = participantes.length
// la asignación i (0-based) se publica exactamente en inicio + i·intervaloMs
reveladas == n → { fase: 'finalizado' }
si no          → { fase: 'en_curso', msParaSiguiente: inicio + reveladas·intervaloMs - ahora }
```

---

## 5. Equidad verificable (commit–reveal)

1. Al **crear** el sorteo, el servidor genera `seed` (CSPRNG) y publica solo
   `seedHash = sha256("<publicId>:<seed>")`.
2. Antes de `inicio`, **ninguna respuesta de la API incluye `seed` ni
   `asignaciones`** — tampoco para el admin (evita filtraciones y sospechas).
3. Desde `ahora ≥ inicio`, la API expone `seed` y las asignaciones **solo
   hasta `reveladas(ahora)`**; el resto se libera con el reloj.
4. Cualquiera puede auditar después: recomputar §4 con la `seed` revelada y
   verificar `seedHash`.

---

## 6. API

Formato de error homogéneo en toda la API:

```jsonc
{ "error": { "codigo": "PARTICIPANTES_EXCEDEN_LOTES", "mensaje": "…" } }
```

| Código | HTTP |
|---|---|
| `SORTEO_NO_ENCONTRADO` | 404 |
| `VALIDACION` (detalle zod en `mensaje`) | 422 |
| `PARTICIPANTES_EXCEDEN_LOTES` | 422 |
| `ENLACE_INVALIDO` | 422 |
| `SORTEO_NO_FINALIZADO` | 409 |
| `SORTEO_YA_TERMINADO` (cancelar un finalizado) | 409 |
| `NO_AUTORIZADO` | 401 |

### 6.1 Pública (sin auth; CORS `FRONTEND_URL`; rate-limit por IP)

```
GET /api/public/tiempo
→ 200 { "ahora": 1800000000000 }
   Sin caché. Para corregir el desfase de reloj del cliente
   (offset = ahora_servidor - Date.now() al recibir).

GET /api/public/sorteos/:publicId
→ 200 (snapshot completo; Cache-Control: no-store)
{
  "publicId": "abc123xyz9AB",
  "nombre": "Sorteo asamblea julio",
  "estado": "programado" | "en_curso" | "finalizado" | "cancelado",
  "ahora": 1799999990000,          // reloj del servidor en esta respuesta
  "inicio": 1800000000000,
  "intervaloMs": 5000,
  "totalLotes": 48,
  "totalParticipantes": 10,        // n; la lista completa NO se expone aquí
  "seedHash": "9f2c…",
  "seed": 20260710,                // SOLO si ahora ≥ inicio; antes: null
  "mapa": { …MapaSorteo… } | null, // null = mapa predeterminado del sitio
  "reveladas": 3,
  "asignaciones": [                // exactamente las primeras `reveladas`
    { "orden": 0, "parcelaIdx": 37, "participante": "P02", "reveladaEn": 1800000000000 },
    { "orden": 1, "parcelaIdx": 25, "participante": "P08", "reveladaEn": 1800000005000 },
    { "orden": 2, "parcelaIdx": 6,  "participante": "P06", "reveladaEn": 1800000010000 }
  ],
  "cancelado": null | { "en": ms, "motivo": "…" }
}

GET /api/public/sorteos/:publicId/estado
→ 200 { "estado", "reveladas", "msParaInicio", "msParaSiguiente", "ahora" }
   Endpoint liviano para polling (recomendado cada 1 s durante 'en_curso').

GET /api/public/sorteos/:publicId/stream
→ SSE (text/event-stream). Ver §8.

GET /api/public/sorteos/:publicId/resultados.csv
→ 200 solo si estado == 'finalizado'; si no, 409 SORTEO_NO_FINALIZADO.
   text/csv; charset=utf-8 con BOM. Columnas y formato idénticos al frontend:
   "Lote","Área (ha)","Asignado a"  (una fila por lote, en el orden del mapa;
   lotes sin asignar → "Libre"). Celdas que empiecen por = + - @ se prefijan
   con ' (mitigación de inyección CSV).
```

**Nota de privacidad:** la lista completa de participantes solo se conoce a
medida que se revela (o vía admin). Evita exponer de antemano quién participa.

### 6.2 Admin (sesión `requireAdmin` de `SPEC.md` §4; prefijo `/api/admin`)

```
POST /api/admin/sorteos
body {
  "nombre"?: string,
  "participantes": string[],        // 1..1000 × 1..80 chars
  "intervaloMs": number,            // 500..600000
  "inicio"?: ms | "esperaMs"?: number,  // exactamente uno; esperaMs 5000..604800000
  "mapa"?: MapaSorteo               // omitir = mapa predeterminado (48 lotes)
}
Validar: participantes.length ≤ totalLotes; mapa ≤ 2 MB JSON, 2..2000 lotes,
anillos 3..5000 vértices, |lat| ≤ 90, |lng| ≤ 180; inicio > ahora + 5000.
→ 201 {
  "publicId", "seedHash", "inicio", "intervaloMs", "totalLotes",
  "urlPublica": "<FRONTEND_URL>/sorteo?id=<publicId>"
}
(NUNCA devuelve seed ni asignaciones.)

GET  /api/admin/sorteos?page=&limit=      → listado paginado (sin seed)
GET  /api/admin/sorteos/:publicId          → detalle; mismas reglas de
                                             revelación del §5 (el admin NO ve
                                             seed/asignaciones antes de tiempo)
POST /api/admin/sorteos/:publicId/cancelar body { "motivo"?: string }
     → 200 si estado ∈ {programado, en_curso}; 409 si finalizado.
     Un sorteo cancelado deja de revelar asignaciones (las ya reveladas
     permanecen visibles en el snapshot, marcadas por el estado 'cancelado').

POST /api/admin/sorteos/importar-enlace body { "hash": string }
     → decodifica el formato del §7 (v1 o v2), crea el sorteo con la seed,
       inicio e intervalo del enlace (se permite inicio en pasado: sirve para
       archivar sorteos ya realizados con el sistema actual), origen =
       'enlace-importado'. → 201 igual que POST /sorteos.
       En importados la seed ya era pública: seedHash se calcula igual, y la
       regla del §5 aplica desde el inicio original (normalmente ya vencido).

GET  /api/admin/sorteos/:publicId/enlace-offline
     → 200 { "hash": "2!…", "url": "<FRONTEND_URL>/sorteo#2!…" }
       Genera el enlace autónomo actual (formato §7 v2) como plan B si el
       backend no está disponible durante un evento. Solo si ahora ≥ inicio
       o el sorteo fue importado (antes revelaría la seed).
```

---

## 7. Interoperabilidad con el enlace actual (hash)

El frontend hoy codifica `SorteoConfig` en `location.hash`:

```jsonc
// SorteoConfig (JSON)
{
  "v": 2,                        // 1 = formato legado
  "participantes": ["Ana", "Bruno", "Carla"],
  "seed": 42,                    // uint32
  "inicio": 1800000000000,       // época ms
  "intervaloMs": 6000,
  "mapa": { …MapaSorteo… }       // opcional; solo v2
}
```

- **v2:** `"2!" + base64url( deflate-raw( JSON en UTF-8 ) )` — base64url sin
  padding (`+`→`-`, `/`→`_`, sin `=`). `deflate-raw` = DEFLATE **sin** cabecera
  zlib/gzip (`zlib.inflateRawSync` en Node lo lee).
- **v1 (legado):** `base64url(JSON UTF-8)` sin prefijo.
- ⚠️ **La compresión no es canónica:** dos implementaciones pueden producir
  bytes distintos para el mismo JSON. El contrato es **de decodificación**:
  `inflate(base64url⁻¹(hash sin prefijo))` debe reconstruir el JSON. No
  comparar hashes byte a byte.
- Reglas de validación al decodificar (mismas del frontend):
  `v ∈ {1,2}`, `participantes` array no vacío de strings, `seed`/`inicio`/
  `intervaloMs` numéricos, `intervaloMs ≥ 500`, `mapa` opcional con el shape
  del §3.1, y `participantes.length ≤ totalLotes`.

---

## 8. Tiempo real (SSE)

`GET /api/public/sorteos/:publicId/stream` — `text/event-stream`:

```
event: snapshot      ← inmediato al conectar; data = respuesta de GET /sorteos/:id
event: revelacion    ← en cada inicio + i·intervaloMs
data: { "orden": 4, "parcelaIdx": 20, "participante": "P05", "reveladas": 5, "reveladaEn": 1800000020000 }
event: finalizado    data: { "reveladas": 10 }
event: cancelado     data: { "en": …, "motivo": "…" }
: heartbeat          ← comentario cada 25 s (mantiene vivo el proxy)
```

Notas de implementación:

- No hay estado por cliente: todo se deriva de `inicio`, `intervaloMs` y
  `asignaciones` almacenadas; un reinicio del servidor se recupera solo.
- Un único timer por sorteo activo (o un scheduler global por tick) que
  emite a los suscriptores; al no haber suscriptores, no hay timer.
- El cliente que se conecta tarde recibe el `snapshot` completo — no hace
  falta `Last-Event-ID`.
- **Fallback:** el frontend seguirá calculando §4 por reloj; SSE es mejora,
  no dependencia. Si SSE falla, polling a `/estado` cada 1 s.

---

## 9. Seguridad y validaciones — checklist

- [ ] `publicId` nanoid de 12 chars (≈71 bits): no enumerable. No exponer ids
      internos de Mongo.
- [ ] `seed` con CSPRNG (`crypto.randomInt(0, 2**32)`); jamás en logs.
- [ ] Regla del §5 aplicada en **todas** las rutas (públicas y admin) y en el
      CSV/SSE: nada del futuro sale del servidor.
- [ ] zod en todos los bodies; strings trim; nombres son **texto plano** (el
      frontend escapa al renderizar; el backend no almacena HTML).
- [ ] Límite de tamaño de body: 3 MB (mapas embebidos).
- [ ] Rate limit: público 60 req/min/IP (SSE excluido, máx. 5 conexiones
      SSE por IP); admin como en `SPEC.md`.
- [ ] CORS: rutas públicas → `FRONTEND_URL`; SSE incluido.
- [ ] Mitigación de inyección CSV (§6.1).
- [ ] Relojes: todas las marcas en época **ms UTC** del servidor; nunca usar
      la hora enviada por un cliente.

---

## 10. Vectores de prueba (NORMATIVOS)

Generados con la implementación real del frontend (`src/utils/sorteo.ts`).
La implementación del backend debe reproducirlos exactamente (los floats del
PRNG con los 15-17 dígitos mostrados, doble precisión IEEE 754).

### 10.1 PRNG

```
mulberry32(1)          → [0.6270739405881613, 0.002735721180215478, 0.5274470399599522, 0.9810509674716741, 0.9683778982143849]
mulberry32(123456789)  → [0.2577907438389957, 0.9707721115555614, 0.7853280142880976, 0.20616457983851433, 0.30307188746519387]
```

### 10.2 Barajado

```
barajar([0,1,2,3,4,5], mulberry32(42)) → [1, 0, 4, 5, 2, 3]
```

### 10.3 Asignaciones — seed 123456789, 6 lotes, 6 participantes

`participantes = ["Ana","Bruno","Carla","David","Elena","Fabio"]`

```json
[{"parcelaIdx":5,"participante":"Fabio"},{"parcelaIdx":2,"participante":"Carla"},
 {"parcelaIdx":0,"participante":"Ana"},{"parcelaIdx":3,"participante":"Bruno"},
 {"parcelaIdx":4,"participante":"David"},{"parcelaIdx":1,"participante":"Elena"}]
```

### 10.4 Asignaciones — seed 20260710, 48 lotes, 10 participantes

`participantes = ["P01","P02",…,"P10"]`

```json
[{"parcelaIdx":37,"participante":"P02"},{"parcelaIdx":25,"participante":"P08"},
 {"parcelaIdx":6,"participante":"P06"},{"parcelaIdx":9,"participante":"P04"},
 {"parcelaIdx":20,"participante":"P05"},{"parcelaIdx":21,"participante":"P03"},
 {"parcelaIdx":40,"participante":"P07"},{"parcelaIdx":15,"participante":"P09"},
 {"parcelaIdx":18,"participante":"P10"},{"parcelaIdx":8,"participante":"P01"}]
```

### 10.5 Estado por reloj — `inicio = 1800000000000`, `intervaloMs = 5000`, n = 10

| `ahora` | fase | reveladas | msParaInicio | msParaSiguiente |
|---|---|---|---|---|
| inicio − 1500 | previa | 0 | 1500 | 1500 |
| inicio | en_curso | 1 | 0 | 5000 |
| inicio + 4999 | en_curso | 1 | 0 | 1 |
| inicio + 5000 | en_curso | 2 | 0 | 5000 |
| inicio + 44999 | en_curso | 9 | 0 | 1 |
| inicio + 45000 | finalizado | 10 | 0 | 0 |

### 10.6 Enlace v2 (prueba de DECODIFICACIÓN)

El siguiente hash, decodificado según §7, debe producir exactamente:

```
2!q1YqU7Iy0lEqSCwqyUzOLEjMK0ktVrKKVnLMS1TSUXIqKs3LB9LOiUU5iUqxOkrFqakpSlYmQB2ZeUD1-UpWhhYGCAASLkktKkvMyfcFGmMGFKoFAA
```

```json
{"v":2,"participantes":["Ana","Bruno","Carla"],"seed":42,"inicio":1800000000000,"intervaloMs":6000}
```

### 10.7 Enlace v1 legado (decodificación)

```
eyJ2IjoxLCJwYXJ0aWNpcGFudGVzIjpbIkFuYSIsIkJydW5vIiwiQ2FybGEiXSwic2VlZCI6NDIsImluaWNpbyI6MTgwMDAwMDAwMDAwMCwiaW50ZXJ2YWxvTXMiOjYwMDB9
```

→ mismo JSON del §10.6 pero con `"v": 1`.

---

## 11. Sincronización futura con el frontend (fuera de este repo)

Contrato para cuando el sitio se conecte (no implementar aún):

1. **URL pública del visor:** `<FRONTEND_URL>/sorteo?id=<publicId>`. El
   frontend leerá el query param, hará `GET /api/public/sorteos/:id`,
   corregirá su reloj con `GET /api/public/tiempo` y se suscribirá al SSE
   (con fallback a polling y al cálculo local §4 una vez conozca la seed).
2. **Creación:** el flujo de organizador del frontend llamará a
   `POST /api/admin/sorteos` cuando haya sesión; si el backend no responde,
   degrada al modo actual de enlace-hash (que se mantiene como plan B
   permanente).
3. **Archivo:** los sorteos hechos con enlaces-hash se podrán registrar a
   posteriori con `POST /api/admin/sorteos/importar-enlace`.

---

## 12. Fases y criterios de aceptación

**Fase 1 — Algoritmo.** Port de §4 + commit-reveal §5. ✅ Pasa todos los
vectores del §10 en tests automatizados.

**Fase 2 — CRUD + reglas de revelación.** §3, §6.2 (crear/listar/cancelar) y
§6.1 (snapshot/estado). ✅ Con un sorteo de prueba: antes de `inicio` ninguna
ruta expone seed/asignaciones; después, exactamente `reveladas(ahora)`.

**Fase 3 — Interop.** §7: importar-enlace y enlace-offline. ✅ Importa los
hashes del §10.6/§10.7; el enlace-offline generado se abre correctamente en
el `/sorteo` actual del sitio.

**Fase 4 — SSE + CSV.** §8 y CSV de §6.1. ✅ Dos clientes SSE reciben la misma
`revelacion` con < 1 s de diferencia; el CSV coincide con el que exporta el
frontend para la misma seed.
