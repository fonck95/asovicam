import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  makeWatermelonColorTexture,
  makeWatermelonFleshTexture,
  makeWatermelonFleshNormalTexture,
  makeWatermelonFleshRoughnessTexture,
  makeWatermelonNormalTexture,
} from '../textures';

// =====================================================
// Sandía: pieza completa + rebanada lateral mostrando la
// pulpa rosada y semillas instanciadas (presentación de
// marketing). La pulpa usa transmisión + atenuación de color
// para simular subsurface scattering (la luz "atraviesa" la
// pulpa rosada como en una sandía real bañada de luz).
//
// POLISH (Prompt 2):
//   - prop `mode`: 'whole' | 'cut' | 'both' (default 'both').
//   - Banda explícita de mesocarpio (corteza interior crema-verdosa,
//     ~1.5 cm en escala real) entre cáscara y pulpa en la rebanada.
//   - Cuando el modo es 'whole' o 'cut', el modelo se centra en lugar
//     de quedar descentrado a la izquierda como en el layout de marketing.
// =====================================================

const RADIUS = 1.0;

function buildRindGeometry() {
  const geo = new THREE.SphereGeometry(RADIUS, 192, 128);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const len = v.length();
    const ny = v.y / len;
    const azimuth = Math.atan2(v.z / len, v.x / len);
    const polar = Math.acos(Math.max(-1, Math.min(1, ny)));

    // Lóbulos longitudinales muy sutiles — las sandías reales son lisas;
    // los segmentos apenas se insinúan. Amplitudes reducidas ~4x respecto
    // a la versión anterior para evitar el look "irregular exagerado".
    const lobes = (Math.cos(azimuth * 5 + 0.4) * 0.005 +
                   Math.cos(azimuth * 7 - 1.2) * 0.0015) * Math.sin(polar);

    // Asimetría tallo/flor: leve pellizco en el polo superior, base
    // ligeramente aplanada. Mantenido pero atenuado para no exagerar.
    const stemBlossom = ny > 0
      ? -Math.pow(ny, 3.0) * 0.020
      : -Math.pow(-ny, 1.7) * 0.010;

    v.setLength(len + lobes + stemBlossom);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  // Forma oblonga típica de Charleston Gray: alargada en X, levemente
  // achatada en Y. Relación ~1.32:1.
  geo.scale(1.32, 0.93, 0.97);
  geo.computeVertexNormals();
  return geo;
}

// ---------- Rebanada ----------

const SLICE_RADIUS = 0.78;
const SLICE_DEPTH = 0.34;

function buildSliceFleshGeometry() {
  const shape = new THREE.Shape();
  const r = SLICE_RADIUS;
  shape.moveTo(-r, 0);
  shape.absarc(0, 0, r, Math.PI, 0, true);
  shape.lineTo(-r, 0);

  // Bevel mínimo: sólo suaviza el canto duro sin formar un "borde grueso"
  // alrededor de la cara plana. Antes era 0.045×0.048 y dejaba un anillo
  // rojo visible (material-1) tan ancho como el grosor del rind verde →
  // se leía como una rebanada con marco rojo en lugar de pulpa+cáscara.
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: SLICE_DEPTH,
    bevelEnabled: true,
    bevelThickness: 0.010,
    bevelSize: 0.010,
    bevelSegments: 4,
    curveSegments: 128,
  });
  geo.translate(0, 0, -SLICE_DEPTH / 2);
  return remapSliceUVs(geo);
}

function remapSliceUVs(geo) {
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const r = SLICE_RADIUS;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    // Mapeo radial centrado: el centro de la rebanada → centro de la textura
    const u = (x + r) / (2 * r);
    const v = 0.5 + (y / (2 * r)); // y ∈ [0, r] → v ∈ [0.5, 1]
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
  return geo;
}

function buildSliceRindGeometry() {
  // Cáscara verde envolviendo el canto curvo del slice. Sweep de un
  // perfil tipo media-elipse a lo largo del arco. El perfil es más alto
  // que ancho (alto ≈ grosor del slice, ancho ≈ grosor de la corteza)
  // y se hunde hacia adentro en los extremos verticales para que pase
  // exactamente por la esquina redondeada del bevel de la pulpa,
  // eliminando la costura blanca/gris entre pulpa y cáscara.
  const arcSegs = 192;
  const profileSegs = 32;
  const halfDepth = SLICE_DEPTH / 2;       // 0.17
  // Perfil: en theta=0 sobresale `outward` hacia afuera; en theta=±π/2
  // entra `inward` hacia la pulpa (radial negativo).
  const outward = 0.060;
  const inward = 0.052;
  const profileTopZ = halfDepth + 0.022;   // los tips suben/bajan un poco más allá del slice
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i <= arcSegs; i++) {
    const u = i / arcSegs;
    const a = Math.PI - u * Math.PI;
    const ax = Math.cos(a);
    const ay = Math.sin(a);
    for (let j = 0; j <= profileSegs; j++) {
      const v = j / profileSegs;
      const theta = -Math.PI / 2 + v * Math.PI;
      const ct = Math.cos(theta);
      const st = Math.sin(theta);
      // Lerp entre extremo exterior (+outward) y extremo interior (-inward)
      // usando cos(theta) — suave, sin esquinas.
      const radial = ct * outward - (1 - ct) * inward;
      const z = st * profileTopZ;
      const rTotal = SLICE_RADIUS + radial;
      positions.push(ax * rTotal, ay * rTotal, z);
      uvs.push(u, v);
    }
  }
  const cols = profileSegs + 1;
  for (let i = 0; i < arcSegs; i++) {
    for (let j = 0; j < profileSegs; j++) {
      const a = i * cols + j;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Posiciones realistas de semillas en una rebanada.
// La Z se calcula respecto a la cara plana del slice (después del bevel,
// ahora reducido a 0.010), con un offset pequeño para que las semillas
// queden semi-embebidas en la pulpa.
const SEED_FRONT_Z = SLICE_DEPTH / 2 - 0.010 + 0.006;  // ~0.166
const SEED_BACK_Z = -SEED_FRONT_Z;
function generateSeedPositions() {
  const seeds = [];
  const rings = [
    { r: SLICE_RADIUS * 0.42, count: 7 },
    { r: SLICE_RADIUS * 0.58, count: 9 },
    { r: SLICE_RADIUS * 0.74, count: 11 },
  ];
  for (const ring of rings) {
    for (let i = 0; i < ring.count; i++) {
      const t = (i + 0.5) / ring.count;
      const a = Math.PI - t * Math.PI;
      const jitter = (Math.random() - 0.5) * 0.04;
      const x = Math.cos(a) * (ring.r + jitter);
      const y = Math.sin(a) * (ring.r + jitter);
      seeds.push({
        position: [x, y, SEED_FRONT_Z],
        rotation: [0, 0, a + Math.PI / 2 + (Math.random() - 0.5) * 0.4],
        scale: 0.85 + Math.random() * 0.3,
      });
    }
  }
  return seeds;
}

function buildSeedGeometry() {
  // Semilla aplanada con punta más estrecha
  const geo = new THREE.SphereGeometry(0.030, 18, 12);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    v.x *= 1.25;
    v.y *= 1.7;
    v.z *= 0.42;
    // Estrecharla en la punta superior
    if (v.y > 0) {
      v.x *= 1 - v.y * 0.18;
    }
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// Pequeñas gotas de jugo sobre la pulpa para look fresco
function generateJuiceDropPositions() {
  const drops = [];
  for (let i = 0; i < 12; i++) {
    const angle = Math.random() * Math.PI - Math.PI;
    const r = SLICE_RADIUS * (0.2 + Math.random() * 0.55);
    const x = Math.cos(angle) * r;
    const y = Math.abs(Math.sin(angle)) * r * 0.9 + 0.04;
    drops.push({
      // Pegadas a la cara plana de la pulpa, no flotando — antes era
      // SLICE_DEPTH/2 + 0.024 que ahora flota por encima del bevel ampliado.
      position: [x, y, SEED_FRONT_Z + 0.008],
      scale: 0.6 + Math.random() * 1.1,
    });
  }
  return drops;
}

export default function WatermelonModel({ mode = 'both' } = {}) {
  const groupRef = useRef(null);

  const showWhole = mode === 'whole' || mode === 'both';
  const showCut = mode === 'cut' || mode === 'both';

  const rindGeo = useMemo(buildRindGeometry, []);
  const sliceFleshGeo = useMemo(buildSliceFleshGeometry, []);
  const sliceRindGeo = useMemo(buildSliceRindGeometry, []);
  const seedGeo = useMemo(buildSeedGeometry, []);
  const seedPositions = useMemo(generateSeedPositions, []);
  const juiceDrops = useMemo(generateJuiceDropPositions, []);

  const rindMap = useMemo(makeWatermelonColorTexture, []);
  const rindNormal = useMemo(makeWatermelonNormalTexture, []);
  const fleshMap = useMemo(makeWatermelonFleshTexture, []);
  const fleshNormal = useMemo(makeWatermelonFleshNormalTexture, []);
  const fleshRoughness = useMemo(makeWatermelonFleshRoughnessTexture, []);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.position.y = Math.sin(clock.elapsedTime * 0.5) * 0.015;
  });

  // En modo 'both' separamos la sandía entera (izda) y la rebanada (dcha)
  // con espacio suficiente para que la rodaja no se superponga con el
  // cuerpo. En modos solo-entera o solo-corte, centramos el sujeto.
  const wholePosition = showCut ? [-0.95, 0, -0.15] : [0, 0, 0];
  const cutPosition = showWhole ? [1.55, -0.40, 0.30] : [0, -0.2, 0];
  const cutRotation = showWhole
    ? [-Math.PI / 2.4, 0.05, -0.18]
    : [-Math.PI / 2.8, 0.08, -0.1];

  return (
    <group ref={groupRef} rotation={[0.06, 0, 0.04]}>
      {/* === Sandía completa === */}
      {showWhole && (
      <group position={wholePosition}>
        <mesh geometry={rindGeo} castShadow receiveShadow>
          <meshPhysicalMaterial
            map={rindMap}
            normalMap={rindNormal}
            normalScale={[1.05, 1.05]}
            roughness={0.42}
            metalness={0.04}
            clearcoat={0.95}
            clearcoatRoughness={0.22}
            envMapIntensity={1.25}
            sheen={0.25}
            sheenColor="#a3e635"
            sheenRoughness={0.5}
          />
        </mesh>

        {/* Marca floral del extremo opuesto al tallo (Y-scale = 0.93) */}
        <mesh position={[0, -RADIUS * 0.93, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.012, 0.04, 32]} />
          <meshStandardMaterial color="#3f6212" roughness={0.85} side={THREE.DoubleSide} />
        </mesh>
      </group>
      )}

      {/* === Rebanada === */}
      {showCut && (
      <group position={cutPosition} rotation={cutRotation}>
        {/* Pulpa con SSS realista. Iteración mayo 2026:
            - clearcoat bajado a 0.32: reflejos del environment estaban
              levantando la luminosidad media y leyendo "rosa". Menos
              clearcoat = saturación roja más visible.
            - normalScale incrementado a 1.25: realza la geometría
              cellular voronoi del map de normales para que las celdas
              se vean más definidas (más "carne jugosa", menos "plástico").
            - attenuationColor empujado un punto más a wine
              (#b81a30 → más rojo profundo cuando la luz atraviesa).
            - sheen sostenido en rojo cálido pero sheenColor más rojo
              que coral para evitar derivar a tono rosado en bordes.
            - emissive levemente reforzado para sostener la saturación
              en zonas que reciben menos luz directa. */}
        <mesh geometry={sliceFleshGeo} castShadow receiveShadow>
          <meshPhysicalMaterial
            attach="material-0"
            map={fleshMap}
            normalMap={fleshNormal}
            normalScale={[1.25, 1.25]}
            roughnessMap={fleshRoughness}
            roughness={0.50}
            metalness={0.0}
            clearcoat={0.32}
            clearcoatRoughness={0.38}
            transmission={0.20}
            thickness={0.40}
            attenuationColor="#b81a30"
            attenuationDistance={0.16}
            ior={1.39}
            sheen={0.50}
            sheenColor="#d63a48"
            sheenRoughness={0.42}
            emissive="#3e0814"
            emissiveIntensity={0.22}
            envMapIntensity={0.85}
          />
          {/* Material lateral: cubre los lados extrudidos + el pequeño
              bevel perimetral. Color coral-rojo más saturado que matchea
              la nueva franja externa de la pulpa (FLESH_STOPS @ r≈0.88-
              0.92) para que el bevel mínimo se funda con la transición
              pulpa → mesocarpio sin leerse como un anillo rosa pastel.
              Antes #e88896 era demasiado rosado y el canto bajo la
              cáscara verde se veía pink. */}
          <meshPhysicalMaterial
            attach="material-1"
            color="#cf5258"
            roughness={0.78}
            metalness={0}
            sheen={0.22}
            sheenColor="#d88080"
            sheenRoughness={0.55}
          />
        </mesh>

        {/* Cáscara verde envolviendo el canto curvo de la rebanada.
            Geometría sweep elipsoidal — se funde con el bevel de la pulpa
            sin línea visible. polygonOffset empuja la cáscara hacia atrás
            del bevel para evitar z-fighting en el lateral.
            NOTA: la banda blanca-verdosa interior (mesocarpio) ya está
            pintada DENTRO de la textura de la pulpa (pre-corteza fibrosa
            entre t=0.91 y t=0.96 del radio). El antiguo mesh de mesocarpio
            duplicaba ese trabajo y se peleaba en Z con la pulpa, dejando
            la "línea blanca" visible en el corte. */}
        <mesh geometry={sliceRindGeo} castShadow receiveShadow>
          <meshPhysicalMaterial
            map={rindMap}
            normalMap={rindNormal}
            normalScale={[1.05, 1.05]}
            roughness={0.42}
            metalness={0.04}
            clearcoat={0.85}
            clearcoatRoughness={0.28}
            envMapIntensity={1.15}
            sheen={0.25}
            sheenColor="#a3e635"
            sheenRoughness={0.55}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Semillas — cara frontal */}
        {seedPositions.map((s, i) => (
          <mesh
            key={`f-${i}`}
            geometry={seedGeo}
            position={s.position}
            rotation={s.rotation}
            scale={s.scale}
            castShadow
          >
            <meshPhysicalMaterial
              color="#0c0500"
              roughness={0.22}
              metalness={0.22}
              clearcoat={1.0}
              clearcoatRoughness={0.10}
              envMapIntensity={1.5}
              sheen={0.4}
              sheenColor="#5c1a10"
              sheenRoughness={0.35}
            />
          </mesh>
        ))}
        {/* Semillas — cara trasera */}
        {seedPositions.map((s, i) => (
          <mesh
            key={`b-${i}`}
            geometry={seedGeo}
            position={[s.position[0], s.position[1], SEED_BACK_Z]}
            rotation={s.rotation}
            scale={s.scale}
            castShadow
          >
            <meshPhysicalMaterial
              color="#0c0500"
              roughness={0.22}
              metalness={0.22}
              clearcoat={1.0}
              clearcoatRoughness={0.10}
              envMapIntensity={1.5}
              sheen={0.4}
              sheenColor="#5c1a10"
              sheenRoughness={0.35}
            />
          </mesh>
        ))}

        {/* Gotitas de jugo sobre la pulpa (look fresco).
            Tono rojo más saturado y atenuación más cerrada para que
            las gotas se lean como "jugo de sandía", no como gotas
            transparentes con tinte rosa. */}
        {juiceDrops.map((d, i) => (
          <mesh
            key={`drop-${i}`}
            position={d.position}
            scale={[d.scale * 0.014, d.scale * 0.014, d.scale * 0.0075]}
          >
            <sphereGeometry args={[1, 18, 14]} />
            <meshPhysicalMaterial
              color="#dc2845"
              roughness={0.05}
              metalness={0}
              clearcoat={1.0}
              clearcoatRoughness={0.04}
              transmission={0.90}
              thickness={0.4}
              ior={1.36}
              attenuationColor="#a8182e"
              attenuationDistance={0.18}
              envMapIntensity={1.6}
            />
          </mesh>
        ))}
      </group>
      )}
    </group>
  );
}
