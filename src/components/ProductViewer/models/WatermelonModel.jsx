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

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: SLICE_DEPTH,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: 6,
    curveSegments: 96,
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
  const arcPoints = [];
  const segments = 96;
  const r = SLICE_RADIUS + 0.02;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = Math.PI - t * Math.PI;
    arcPoints.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
  }
  const curve = new THREE.CatmullRomCurve3(arcPoints, false);
  return new THREE.TubeGeometry(curve, 128, SLICE_DEPTH / 2 + 0.04, 22, false);
}

// POLISH (Prompt 2): mesocarpio = banda blanca-verdosa entre cáscara y
// pulpa (1–2 cm en la sandía real; aquí ~0.04 unidades). Es un anillo
// extruido apenas más estrecho que la cáscara y ligeramente más ancho
// que la pulpa, mapeado con un gradiente blanco→verde tenue para que
// se mezcle suavemente con ambos lados. Lo que faltaba en el corte
// para que no se viera "pulpa pegada directo a cáscara".
const MESO_THICKNESS = 0.04;
function buildMesocarpGeometry() {
  const shape = new THREE.Shape();
  const rOut = SLICE_RADIUS + 0.005;
  const rIn = SLICE_RADIUS - MESO_THICKNESS;
  shape.moveTo(-rOut, 0);
  shape.absarc(0, 0, rOut, Math.PI, 0, true);
  shape.lineTo(rIn, 0);
  shape.absarc(0, 0, rIn, 0, Math.PI, false);
  shape.lineTo(-rOut, 0);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: SLICE_DEPTH * 0.97,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 3,
    curveSegments: 96,
  });
  geo.translate(0, 0, -SLICE_DEPTH * 0.97 / 2);
  // UV simple radial: el centro de la rebanada es u=0.5, el borde es 0/1
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const d = Math.sqrt(x * x + y * y);
    // d normalizado al espesor de la banda: 0 = lado pulpa, 1 = lado cáscara
    const t = Math.max(0, Math.min(1, (d - rIn) / (rOut - rIn)));
    uv.setXY(i, t, (x + rOut) / (2 * rOut));
  }
  uv.needsUpdate = true;
  return geo;
}

// Posiciones realistas de semillas en una rebanada
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
        position: [x, y, SLICE_DEPTH / 2 + 0.020],
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
      position: [x, y, SLICE_DEPTH / 2 + 0.024],
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
  const mesocarpGeo = useMemo(buildMesocarpGeometry, []);
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
        {/* Pulpa con SSS realista. Iteración 2026:
            - color emissive sutil rojo: contrarresta el wash-out de la
              transmission cuando la luz atraviesa el slice y ayuda a
              que la pulpa se vea SATURADA en sombra.
            - attenuationDistance < SLICE_DEPTH (0.34) para garantizar
              tinte rojo claro al atravesar la rebanada. Antes 0.42 estaba
              por encima del grosor → atenuación casi nula → look pálido.
            - sheen rojo cálido (no rosado-blanco) para que los highlights
              de borde tinten en rojo en lugar de desaturar.
            - clearcoat reducido para evitar reflejos blancos del environment
              que estaban "lavando" la pulpa.
            - iridescencia desactivada (creaba shimmer azulado en sombras). */}
        <mesh geometry={sliceFleshGeo} castShadow receiveShadow>
          <meshPhysicalMaterial
            attach="material-0"
            map={fleshMap}
            normalMap={fleshNormal}
            normalScale={[1.05, 1.05]}
            roughnessMap={fleshRoughness}
            roughness={0.48}
            metalness={0.0}
            clearcoat={0.55}
            clearcoatRoughness={0.32}
            transmission={0.22}
            thickness={0.40}
            attenuationColor="#c8203a"
            attenuationDistance={0.18}
            ior={1.39}
            sheen={0.55}
            sheenColor="#e8505a"
            sheenRoughness={0.38}
            emissive="#3a0612"
            emissiveIntensity={0.18}
            envMapIntensity={1.0}
          />
          {/* Material lateral: representa la "rebanada vista de canto".
              Antes era cream #fbf3e8 → cuando la cámara pillaba el lateral
              del slice se veía un sandwich blanco. Ahora rojo profundo con
              roughness alta (cut surface seca) para coherencia visual. */}
          <meshPhysicalMaterial
            attach="material-1"
            color="#a01a30"
            roughness={0.78}
            metalness={0}
            sheen={0.30}
            sheenColor="#c8404a"
            sheenRoughness={0.55}
            emissive="#2a0510"
            emissiveIntensity={0.12}
          />
        </mesh>

        {/* Cáscara verde alrededor del borde curvo */}
        <mesh geometry={sliceRindGeo} castShadow receiveShadow>
          <meshPhysicalMaterial
            map={rindMap}
            normalMap={rindNormal}
            normalScale={[1.05, 1.05]}
            roughness={0.4}
            metalness={0.04}
            clearcoat={0.9}
            clearcoatRoughness={0.25}
            envMapIntensity={1.2}
          />
        </mesh>

        {/* Mesocarpio: banda blanca-verdosa entre cáscara y pulpa.
            Sin texturas (sólo color sólido) para no romper la lectura
            del corte; sheen sutil verdoso para que se asome el color de
            la corteza interior. Es la "carnita blanca" que en una sandía
            real separa la pulpa roja del verde duro. */}
        <mesh geometry={mesocarpGeo} castShadow={false} receiveShadow>
          <meshPhysicalMaterial
            color="#e8e4c0"
            roughness={0.85}
            metalness={0}
            sheen={0.25}
            sheenColor="#c5d4a8"
            sheenRoughness={0.6}
            clearcoat={0.18}
            clearcoatRoughness={0.55}
            envMapIntensity={0.85}
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
            position={[s.position[0], s.position[1], -SLICE_DEPTH / 2 - 0.020]}
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
