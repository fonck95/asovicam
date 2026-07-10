// Sincroniza las parcelas del Google My Maps oficial de ASOVICAM con el
// código fuente. Descarga el KML del mapa, extrae los polígonos de la
// carpeta "Parcelas" (y el límite del predio LA FARAONA) y genera
// src/data/parcelas.ts para que la página /sorteo los dibuje sin depender
// de Google en tiempo de ejecución.
//
// Uso:
//   node scripts/sync-parcelas.mjs            # descarga el KML de Google
//   node scripts/sync-parcelas.mjs mapa.kml   # usa un KML local
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const MAP_ID = '1pR7tb0-RpiB08RRk2XKuMbFzAxtBeEY';
const KML_URL = `https://www.google.com/maps/d/kml?mid=${MAP_ID}&forcekml=1`;
const OUT = fileURLToPath(new URL('../src/data/parcelas.ts', import.meta.url));

// Decimales suficientes para ~10 cm de precisión sin inflar el bundle.
const round = (n) => Math.round(Number(n) * 1e6) / 1e6;

function textOf(block, tag) {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? m[1].trim() : null;
}

// "lng,lat,alt lng,lat,alt ..." -> [[lat, lng], ...]
function parseCoords(text) {
  return text
    .trim()
    .split(/\s+/)
    .map((triple) => {
      const [lng, lat] = triple.split(',');
      return [round(lat), round(lng)];
    });
}

function placemarksOf(folderBlock) {
  return folderBlock.match(/<Placemark>[\s\S]*?<\/Placemark>/g) ?? [];
}

function polygonRing(placemark) {
  const poly = placemark.match(/<Polygon>[\s\S]*?<\/Polygon>/)?.[0];
  if (!poly) return null;
  const coords = textOf(poly, 'coordinates');
  if (!coords) return null;
  const ring = parseCoords(coords);
  // El KML repite el primer vértice al final; Leaflet no lo necesita.
  const [f, l] = [ring[0], ring[ring.length - 1]];
  if (ring.length > 1 && f[0] === l[0] && f[1] === l[1]) ring.pop();
  return ring;
}

function pointCoord(placemark) {
  const pt = placemark.match(/<Point>[\s\S]*?<\/Point>/)?.[0];
  if (!pt) return null;
  const coords = textOf(pt, 'coordinates');
  return coords ? parseCoords(coords)[0] : null;
}

function centroidOf(ring) {
  const lat = ring.reduce((s, c) => s + c[0], 0) / ring.length;
  const lng = ring.reduce((s, c) => s + c[1], 0) / ring.length;
  return [round(lat), round(lng)];
}

async function loadKml() {
  const localPath = process.argv[2];
  if (localPath) return readFile(localPath, 'utf8');
  const res = await fetch(KML_URL);
  if (!res.ok) throw new Error(`Descarga del KML falló: HTTP ${res.status}`);
  return res.text();
}

const kml = await loadKml();
const folders = kml.match(/<Folder>[\s\S]*?<\/Folder>/g) ?? [];
const folderByName = (name) =>
  folders.find((f) => (textOf(f, 'name') ?? '').includes(name));

const parcelasFolder = folderByName('Parcelas');
if (!parcelasFolder) throw new Error('No se encontró la carpeta "Parcelas" en el KML');

const parcelas = [];
let pending = null; // polígono a la espera de su punto-etiqueta
for (const pm of placemarksOf(parcelasFolder)) {
  const ring = polygonRing(pm);
  if (ring) {
    const desc = textOf(pm, 'description') ?? '';
    // "Parcela 12 — 11.76 ha"
    const m = desc.match(/Parcela\s+(\d+)\s*[—-]\s*([\d.]+)\s*ha/i);
    pending = {
      id: m ? Number(m[1]) : parcelas.length + 1,
      nombre: m ? `Parcela ${m[1]}` : `Parcela ${parcelas.length + 1}`,
      areaHa: m ? Number(m[2]) : null,
      coords: ring,
      centro: centroidOf(ring),
    };
    parcelas.push(pending);
    continue;
  }
  const pt = pointCoord(pm);
  // En el KML de My Maps cada polígono va seguido de su punto-etiqueta.
  if (pt && pending) {
    pending.centro = pt;
    pending = null;
  }
}

const limiteFolder = folderByName('Límite Predio');
const limite = limiteFolder ? polygonRing(placemarksOf(limiteFolder)[0] ?? '') : null;

if (parcelas.length === 0) throw new Error('El KML no contiene parcelas');
parcelas.sort((a, b) => a.id - b.id);

const ts = `// ⚠️ ARCHIVO GENERADO — no editar a mano.
// Fuente: Google My Maps "ASOVICAM Mapa" (mid=${MAP_ID}), carpeta "Parcelas".
// Regenerar con: node scripts/sync-parcelas.mjs
import type { Parcela } from '../types';

/** Coordenadas [lat, lng] del lindero del predio LA FARAONA (628.63 ha). */
export const limitePredio: [number, number][] = ${JSON.stringify(limite)};

/** Las ${parcelas.length} parcelas del predio, en orden numérico. */
export const parcelas: Parcela[] = [
${parcelas.map((p) => `  ${JSON.stringify(p)},`).join('\n')}
];
`;

await writeFile(OUT, ts);
console.log(`OK: ${parcelas.length} parcelas -> ${OUT}`);
console.log(
  'Áreas:',
  [...new Set(parcelas.map((p) => p.areaHa))].join(', '),
  'ha · límite:',
  limite ? `${limite.length} vértices` : 'no encontrado',
);
