import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  makeWatermelonColorTexture,
  makeWatermelonFleshTexture,
  makeWatermelonFleshNormalTexture,
  makeWatermelonFleshRoughnessTexture,
  makeWatermelonLeafColorTexture,
  makeWatermelonLeafNormalTexture,
  makeWatermelonNormalTexture,
} from '../textures';

// =====================================================
// Sandía: pieza completa + rebanada lateral mostrando la
// pulpa rosada y semillas instanciadas (presentación de
// marketing). La pulpa usa transmisión + atenuación de color
// para simular subsurface scattering (la luz "atraviesa" la
// pulpa rosada como en una sandía real bañada de luz).
// =====================================================

const RADIUS = 1.0;

function buildRindGeometry() {
  const geo = new THREE.SphereGeometry(RADIUS, 224, 144);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  // Dirección del "ground spot" (la zona plana donde reposó en el campo).
  // Está descentrada hacia un lado y ligeramente hacia abajo — no es
  // perfectamente en el polo sur, como en una sandía real.
  const groundDir = new THREE.Vector3(0.18, -0.95, 0.26).normalize();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const len = v.length();
    const nx = v.x / len, ny = v.y / len, nz = v.z / len;
    const azimuth = Math.atan2(nz, nx);
    const polar = Math.acos(Math.max(-1, Math.min(1, ny)));

    // (1) Lóbulos longitudinales muy SUTILES — una sandía real no tiene
    // segmentos visibles como una calabaza. Sólo ondulaciones casi
    // imperceptibles del polo del tallo al polo de la flor.
    const lobes = (
      Math.cos(azimuth * 5 + 0.4) * 0.014 +
      Math.cos(azimuth * 7 - 1.2) * 0.007 +
      Math.cos(azimuth * 11 + 0.9) * 0.003
    ) * Math.sin(polar);

    // (2) Asimetría tallo/flor: el extremo del tallo (top) se pellizca
    // ligeramente. El extremo de la flor (bottom) queda más plano.
    // Magnitudes balanceadas para mantener una silueta CASI esférica.
    const stemBlossom = ny > 0
      ? -Math.pow(ny, 3.2) * 0.052
      : -Math.pow(-ny, 1.8) * 0.018;

    // (3) Ground spot: hueco plano + ligero color shift, donde reposó
    // sobre la tierra. Se aplana mediante una función gaussiana sobre
    // el ángulo entre el vértice y groundDir.
    const dotGround = nx * groundDir.x + ny * groundDir.y + nz * groundDir.z;
    const groundT = Math.max(0, dotGround - 0.72) / 0.28;
    const groundFlatten = -Math.pow(groundT, 1.4) * 0.062;

    // (4) Deformación orgánica de baja+alta frecuencia (bultos naturales)
    // — combinación de tres escalas. La componente más baja crea las
    // grandes asimetrías que rompen el look "huevo perfecto".
    const big =
      Math.sin(v.x * 1.7 + 0.4) * Math.cos(v.y * 1.5 - 0.2) * Math.sin(v.z * 1.3) * 0.034 +
      Math.sin(v.x * 2.4) * Math.cos(v.y * 2.1) * Math.sin(v.z * 1.8) * 0.020 +
      Math.sin(v.x * 5.5 + 0.7) * Math.cos(v.y * 5.1) * Math.sin(v.z * 4.8) * 0.0075 +
      Math.sin(v.x * 11 + 1.4) * Math.cos(v.z * 9.3) * 0.0028;

    // (5) Hash-based jitter de muy baja frecuencia: hace que ningún
    // hemisferio se vea igual a otro (asimetría real, no especular).
    const seed = Math.sin(nx * 4.31 + ny * 7.13 + nz * 9.97) * 43758.5453;
    const sFrac = seed - Math.floor(seed);
    const asymmetry = (sFrac - 0.5) * 0.014;

    v.setLength(len + big + lobes + stemBlossom + groundFlatten + asymmetry);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  // Proporciones MENOS oblongas que antes — más cercano a una sandía
  // tipo Sugar Baby / Crimson Sweet (rango común de mercado, no la
  // variedad alargada Charleston Gray). Antes 1.32 daba look "huevo
  // gigante"; 1.16 mantiene un toque oval sin caer en lo artificial.
  geo.scale(1.16, 0.94, 0.99);
  geo.computeVertexNormals();
  return geo;
}

function buildStemGeometry() {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, RADIUS * 0.88, 0),
    new THREE.Vector3(0.05, RADIUS * 0.88 + 0.13, 0.04),
    new THREE.Vector3(-0.02, RADIUS * 0.88 + 0.24, -0.05),
    new THREE.Vector3(0.08, RADIUS * 0.88 + 0.36, 0.02),
  ]);
  return new THREE.TubeGeometry(curve, 32, 0.04, 18, false);
}

function buildLeafGeometry() {
  // Hoja de sandía REAL: palmatipartida con 5 lóbulos profundos (el
  // central es el más largo). Cada lóbulo tiene a su vez sub-lóbulos
  // pequeños y un margen ligeramente dentado. Se construye con un
  // contorno azimutal por ángulo, modulando el radio con una suma de
  // ondas que crea los cortes profundos.
  const shape = new THREE.Shape();
  const N = 220;
  // Pecíolo (base): empezar en (0, 0)
  shape.moveTo(0, 0);

  // Función de radio polar: gran lóbulo central + 4 laterales con
  // gargantas (sinus) profundas entre cada par. r(θ) ∈ [0.18, 1.0].
  const lobeProfile = (theta) => {
    // theta normalizado a (-PI..PI), pero la hoja vive en (-PI/2 .. 3PI/2)
    // para que la base (0,0) coincida con la punta inferior del pecíolo.
    // 5 lóbulos: usamos cos(5θ) como envolvente y restamos cortes profundos
    const lobeWave = 0.62 + 0.36 * Math.pow(Math.max(0, Math.cos(5 * theta * 0.5)), 1.4);
    // Cortes (sinus) profundos donde cos cruza cero
    const cutMod = Math.pow(Math.abs(Math.sin(5 * theta * 0.5)), 3.5);
    const cut = cutMod * 0.45;
    // Dentado fino del margen
    const tooth = Math.sin(theta * 38) * 0.012;
    // Lóbulo central (theta ≈ PI/2) más alargado
    const centerLobeBoost = Math.exp(-Math.pow(theta - Math.PI / 2, 2) * 4) * 0.18;
    return Math.max(0.18, lobeWave - cut + tooth + centerLobeBoost);
  };

  for (let i = 1; i <= N; i++) {
    const t = i / N;
    const theta = Math.PI * (t - 0.5) + Math.PI / 2; // mapea a (0..PI), apunta hacia +Y
    const r = lobeProfile(theta - Math.PI / 2 + Math.PI / 2) * 0.95;
    const x = Math.cos(theta) * r;
    const y = Math.sin(theta) * r * 0.98;
    shape.lineTo(x, y);
  }
  shape.lineTo(0, 0);

  const geo = new THREE.ShapeGeometry(shape, 60);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    // Curvatura suave en cuenco + leves ondulaciones por lóbulo
    const dist = Math.sqrt(x * x + y * y);
    const cup = -Math.pow(dist, 1.5) * 0.10;
    const radial = Math.cos(Math.atan2(y, x) * 5) * dist * 0.025;
    pos.setZ(
      i,
      Math.sin(y * 2.4) * 0.045 +
        Math.cos(x * 3.6) * 0.028 +
        radial +
        cup,
    );
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  const uv = geo.attributes.uv;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  for (let i = 0; i < uv.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    uv.setXY(i, (x - minX) / (maxX - minX), (y - minY) / (maxY - minY));
  }
  uv.needsUpdate = true;
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

export default function WatermelonModel() {
  const groupRef = useRef(null);

  const rindGeo = useMemo(buildRindGeometry, []);
  const stemGeo = useMemo(buildStemGeometry, []);
  const leafGeo = useMemo(buildLeafGeometry, []);
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
  const leafMap = useMemo(makeWatermelonLeafColorTexture, []);
  const leafNormal = useMemo(makeWatermelonLeafNormalTexture, []);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.position.y = Math.sin(clock.elapsedTime * 0.5) * 0.015;
  });

  return (
    <group ref={groupRef} rotation={[0.06, 0, 0.04]}>
      {/* === Sandía completa (a la izquierda) === */}
      <group position={[-0.55, 0, -0.1]}>
        <mesh geometry={rindGeo} castShadow receiveShadow>
          <meshPhysicalMaterial
            map={rindMap}
            normalMap={rindNormal}
            normalScale={[1.15, 1.15]}
            roughness={0.55}
            metalness={0.02}
            clearcoat={0.55}
            clearcoatRoughness={0.42}
            envMapIntensity={1.05}
            sheen={0.22}
            sheenColor="#a3e635"
            sheenRoughness={0.6}
          />
        </mesh>

        {/* Marca floral del extremo opuesto al tallo (Y-scale = 0.93) */}
        <mesh position={[0, -RADIUS * 0.93, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.012, 0.04, 32]} />
          <meshStandardMaterial color="#3f6212" roughness={0.85} side={THREE.DoubleSide} />
        </mesh>

        {/* Tallo */}
        <mesh geometry={stemGeo} castShadow receiveShadow>
          <meshPhysicalMaterial
            color="#4d7c0f"
            roughness={0.78}
            clearcoat={0.3}
            clearcoatRoughness={0.5}
          />
        </mesh>

        {/* Hojas decorativas — Citrullus lanatus tiene hojas más mates
            y grisáceas que un frijol; reducimos clearcoat y sheen, y el
            verde del sheen va a un tono más apagado. */}
        <mesh
          geometry={leafGeo}
          position={[0.18, RADIUS * 0.88 + 0.05, -0.1]}
          rotation={[0.55, -0.3, 0.2]}
          scale={0.46}
          castShadow
          receiveShadow
        >
          <meshPhysicalMaterial
            map={leafMap}
            normalMap={leafNormal}
            normalScale={[1.0, 1.0]}
            roughness={0.78}
            metalness={0.02}
            clearcoat={0.20}
            clearcoatRoughness={0.65}
            sheen={0.35}
            sheenColor="#8aa658"
            sheenRoughness={0.7}
            transmission={0.12}
            thickness={0.05}
            ior={1.4}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh
          geometry={leafGeo}
          position={[-0.18, RADIUS * 0.88 + 0.08, 0.14]}
          rotation={[0.4, 0.7, -0.35]}
          scale={0.40}
          castShadow
          receiveShadow
        >
          <meshPhysicalMaterial
            map={leafMap}
            normalMap={leafNormal}
            normalScale={[1.0, 1.0]}
            roughness={0.78}
            metalness={0.02}
            clearcoat={0.20}
            clearcoatRoughness={0.65}
            sheen={0.35}
            sheenColor="#8aa658"
            sheenRoughness={0.7}
            transmission={0.12}
            thickness={0.05}
            ior={1.4}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* === Rebanada (a la derecha, ligeramente al frente) === */}
      <group position={[1.1, -0.55, 0.4]} rotation={[-Math.PI / 2.4, 0.05, -0.18]}>
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
    </group>
  );
}
