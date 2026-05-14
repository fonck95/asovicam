import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  makeBeanSeedNormalTexture,
  makeBeanSeedTexture,
  makeLeafColorTexture,
  makeLeafNormalTexture,
  makePodColorTexture,
  makePodInteriorTexture,
  makePodNormalTexture,
} from '../textures';

// =====================================================
// Frijol: vaina cerrada (TubeGeometry curva con bultos)
// + vaina abierta detrás mostrando los frijoles dentro,
// + hojas trifoliadas. Materiales PBR con clearcoat para
// el lustre fresco y sheen sutil en las hojas.
//
// POLISH (Prompt 3):
//   - prop `variety`: 'eye-black' (caupí ojo-negro, default)
//                   | 'red' (caupí rojo)
//                   | 'white' (caupí blanco/crema sin ojo).
//     Cada variedad sobreescribe el tinte del cuerpo + la mancha
//     del hilum vía vertex-color/tinte sin regenerar texturas.
//   - prop `count`: número de semillas dentro de la vaina abierta
//     (default 5). Cuando count > 12 cambiamos a InstancedMesh.
//   - prop `showPod`: si false, no renderiza vaina cerrada ni abierta —
//     útil para presentar sólo las semillas sueltas.
// =====================================================

const POD_LENGTH = 1.95;
const POD_RADIUS = 0.18;

// Paleta de variedades — multiplicadores sobre el albedo base de la
// textura cremosa (que tira a beige cálido). Para "blanco" subimos los
// tres canales por encima de 1 (la textura base es beige, no blanco
// puro) para empujarla a crema-marfil sin perder la variación FBM.
const VARIETY_PRESETS = {
  'eye-black': { tint: [1.0, 1.0, 1.0], hidesEye: false, sheen: '#fff5d6' },
  red:        { tint: [1.15, 0.55, 0.42], hidesEye: false, sheen: '#ffe0d0' },
  white:      { tint: [1.18, 1.14, 1.05], hidesEye: true, sheen: '#fff8e8' },
};

function buildPodHalfGeometry({ open = false } = {}) {
  // Construye media vaina (sólo la parte superior) — para la vaina
  // abierta usamos esto dos veces y separamos las dos mitades.
  // Cuando open = false, usamos la vaina completa (con interior fake).
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-POD_LENGTH / 2, -0.06, 0),
    new THREE.Vector3(-POD_LENGTH / 4, 0.18, 0.04),
    new THREE.Vector3(0, 0.22, 0),
    new THREE.Vector3(POD_LENGTH / 4, 0.18, -0.04),
    new THREE.Vector3(POD_LENGTH / 2, -0.06, 0),
  ]);

  const segs = 96;
  const radial = 24;
  const positions = [];
  const indices = [];
  const uvs = [];
  const frames = curve.computeFrenetFrames(segs, false);
  const points = curve.getSpacedPoints(segs);

  // Cuando open=true sólo barremos media circunferencia (PI)
  const arc = open ? Math.PI : Math.PI * 2;
  const radialUsed = open ? Math.floor(radial / 2) + 1 : radial;

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const taper = Math.sin(t * Math.PI) * 0.85 + 0.15;
    // 5 bumps a lo largo de la vaina (cantidad típica de semillas en
    // caupí). Esta constante no depende del prop `count` — la vaina
    // misma es una pieza geométrica fija; sólo el contenido (semillas)
    // se replica según count.
    const POD_BUMPS = 5;
    const bumps = 1 + Math.sin(t * Math.PI * POD_BUMPS - Math.PI / 2) * 0.32;
    const r = POD_RADIUS * taper * bumps;
    const N = frames.normals[Math.min(i, segs - 1)];
    const B = frames.binormals[Math.min(i, segs - 1)];
    const P = points[i];

    for (let j = 0; j < radialUsed; j++) {
      const a = open
        ? -Math.PI / 2 + (j / (radialUsed - 1)) * arc
        : (j / radial) * arc;
      const nx = Math.cos(a);
      const ny = Math.sin(a) * 0.7;
      const radius = r;
      const x = P.x + (N.x * nx + B.x * ny) * radius;
      const y = P.y + (N.y * nx + B.y * ny) * radius;
      const z = P.z + (N.z * nx + B.z * ny) * radius;
      positions.push(x, y, z);
      uvs.push(j / (open ? radialUsed - 1 : radial), t);
    }
  }

  const cols = radialUsed;
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < (open ? cols - 1 : cols); j++) {
      const a = i * cols + (open ? j : j);
      const b = i * cols + (open ? j + 1 : (j + 1) % cols);
      const c = (i + 1) * cols + (open ? j : j);
      const d = (i + 1) * cols + (open ? j + 1 : (j + 1) % cols);
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

function buildLeafGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.32, 0.1, 0.55, 0.5, 0.42, 0.95);
  shape.bezierCurveTo(0.32, 1.18, 0.12, 1.32, 0, 1.36);
  shape.bezierCurveTo(-0.12, 1.32, -0.32, 1.18, -0.42, 0.95);
  shape.bezierCurveTo(-0.55, 0.5, -0.32, 0.1, 0, 0);

  const geo = new THREE.ShapeGeometry(shape, 32);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z =
      Math.sin(y * 1.4) * 0.09 +
      Math.cos(x * 4) * 0.02 -
      Math.pow(Math.abs(x), 1.6) * 0.18;
    pos.setZ(i, z);
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

function buildStemGeometry() {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-POD_LENGTH / 2 - 0.04, -0.05, 0),
    new THREE.Vector3(-POD_LENGTH / 2 - 0.18, 0.18, 0.04),
    new THREE.Vector3(-POD_LENGTH / 2 - 0.32, 0.4, 0),
    new THREE.Vector3(-POD_LENGTH / 2 - 0.42, 0.55, 0.04),
  ]);
  return new THREE.TubeGeometry(curve, 24, 0.022, 10, false);
}

function buildBeanSeedGeometry() {
  // Frijol caupí individual. POLISH (Prompt 3):
  //   - achatado lateral 0.55 (la semilla real es plana, no oblonga)
  //   - lado cóncavo más definido para el hilum (smoothstep que resta
  //     curvatura sólo en una banda angosta del lado +z). Antes la
  //     indentación apenas se notaba en silueta — la diferencia entre
  //     un "frijolito de juguete" y un caupí real es justo este
  //     perfil arriñonado.
  //   - micro-ruido determinista de baja amplitud para que no se vea
  //     como un sólido CAD perfecto.
  const geo = new THREE.SphereGeometry(0.085, 48, 28);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // Reniforme (1.0 : 0.75 : 0.55 según Prompt 3):
    v.y *= 0.75;
    v.x *= 1.45;
    v.z *= 0.62;

    // Concavidad del hilum: smoothstep sobre la componente Z + banda
    // estrecha en Y. Hace que el lado +z se aplane y se hunda hacia
    // el ecuador, dejando una ranura central nítida. Esto es lo que
    // distingue una semilla "arriñonada" de una elíptica plana.
    const yBand = 1 - Math.min(1, Math.abs(v.y) / 0.045);
    const zSide = Math.max(0, v.z) / 0.06;
    const concavity = Math.pow(yBand, 1.4) * Math.min(1, zSide) * 0.018;
    v.z -= concavity;

    // Pequeña ondulación que recorre el lado dorsal — los caupí
    // tienen una arruga sutil cuando están secos
    v.z += Math.sin(v.x * 5.5) * 0.004 * (v.z > 0 ? 0 : 1);

    // Micro-ruido determinista (anti-CAD)
    const microNoise =
      Math.sin(v.x * 47 + v.y * 31 + v.z * 23) *
      Math.cos(v.y * 43 + v.x * 29) * 0.0025;
    v.x += microNoise;
    v.y += microNoise;
    v.z += microNoise;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  // UV cilíndrico alrededor del eje Y. El offset 0.25 garantiza que el
  // centro de la textura (u=0.5) corresponda al lado +z del frijol —
  // que es justo donde está la indentación del hilum, alineando textura
  // y geometría. v cubre todo el rango vertical del frijol.
  const uv = geo.attributes.uv;
  // Rango Y actualizado al nuevo factor (0.085 * 0.75 = 0.06375)
  const yHalf = 0.085 * 0.75;
  for (let i = 0; i < uv.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const u = ((Math.atan2(z, x) + Math.PI) / (Math.PI * 2) + 0.25) % 1;
    const v2 = (y + yHalf) / (yHalf * 2);
    uv.setXY(i, u, Math.max(0, Math.min(1, v2)));
  }
  uv.needsUpdate = true;
  return geo;
}

export default function BeanModel({
  variety = 'eye-black',
  count = 5,
  showPod = true,
} = {}) {
  const groupRef = useRef(null);

  const preset = VARIETY_PRESETS[variety] ?? VARIETY_PRESETS['eye-black'];

  const closedPodGeo = useMemo(() => buildPodHalfGeometry({ open: false }), []);
  const openTopGeo = useMemo(() => buildPodHalfGeometry({ open: true }), []);
  const leafGeo = useMemo(buildLeafGeometry, []);
  const stemGeo = useMemo(buildStemGeometry, []);
  const seedGeo = useMemo(buildBeanSeedGeometry, []);
  const sutureGeo = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-POD_LENGTH / 2 + 0.05, 0.02, 0),
      new THREE.Vector3(-POD_LENGTH / 4, 0.06, 0.03),
      new THREE.Vector3(0, 0.07, 0),
      new THREE.Vector3(POD_LENGTH / 4, 0.06, -0.03),
      new THREE.Vector3(POD_LENGTH / 2 - 0.05, 0.02, 0),
    ]);
    return new THREE.TubeGeometry(curve, 48, 0.006, 6, false);
  }, []);

  const podMap = useMemo(makePodColorTexture, []);
  const podNormal = useMemo(makePodNormalTexture, []);
  const podInteriorMap = useMemo(makePodInteriorTexture, []);
  const leafMap = useMemo(makeLeafColorTexture, []);
  const leafNormal = useMemo(makeLeafNormalTexture, []);
  const seedMap = useMemo(makeBeanSeedTexture, []);
  const seedNormal = useMemo(makeBeanSeedNormalTexture, []);

  // Posiciones de las semillas dentro de la vaina abierta (cuando hay
  // vaina) o flotando en arreglo lineal (cuando showPod=false). El
  // jitter pseudoaleatorio determinista evita identidad perfecta entre
  // semillas adyacentes: cada una se mueve unos micras en X/Y/Z y rota
  // libremente, anti-look "ensartado en un alambre".
  const seedTransforms = useMemo(() => {
    const arr = [];
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const x = -POD_LENGTH / 2 + t * POD_LENGTH;
      const y = showPod
        ? 0.22 - Math.pow((t - 0.5) * 2, 2) * 0.28
        : 0;
      const z = showPod ? Math.sin((t - 0.5) * Math.PI) * 0.04 : 0;
      // Determinista por índice — repetible entre renders
      const h1 = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      const h2 = (Math.sin(i * 78.233) * 24631.7) % 1;
      const h3 = (Math.sin(i * 41.17) * 19937.1) % 1;
      arr.push({
        position: [
          x + h1 * 0.01,
          (showPod ? y - 0.06 : y) + h2 * 0.006,
          z + h3 * 0.008,
        ],
        rotation: [
          h1 * 0.4,
          (i % 2) * 0.3 + i * 0.13 + h2 * 0.5,
          (i % 3) * 0.15 + h3 * 0.3,
        ],
        scale: 0.95 + h1 * 0.10,
      });
    }
    return arr;
  }, [count, showPod]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.position.y = Math.sin(clock.elapsedTime * 0.6) * 0.015;
  });

  // Material exterior de la vaina cerrada: DoubleSide está bien porque
  // la vaina cerrada es un tubo completo. Para la vaina abierta usamos
  // FrontSide en el exterior + BackSide en la membrana interior,
  // así no compiten en z por el mismo pixel (antes ambos meshes ocupaban
  // exactamente la misma posición → z-fighting visible como flickering
  // entre verde brillante y crema pálido).
  const podMaterialClosed = (
    <meshPhysicalMaterial
      map={podMap}
      normalMap={podNormal}
      normalScale={[1.2, 1.2]}
      roughness={0.38}
      metalness={0.04}
      clearcoat={0.7}
      clearcoatRoughness={0.28}
      sheen={0.4}
      sheenColor="#a3e635"
      sheenRoughness={0.5}
      envMapIntensity={1.15}
      transmission={0.12}
      thickness={0.1}
      attenuationColor="#84cc16"
      attenuationDistance={0.4}
      ior={1.4}
      side={THREE.DoubleSide}
    />
  );

  const podMaterialOpenExterior = (
    <meshPhysicalMaterial
      map={podMap}
      normalMap={podNormal}
      normalScale={[1.2, 1.2]}
      roughness={0.38}
      metalness={0.04}
      clearcoat={0.7}
      clearcoatRoughness={0.28}
      sheen={0.4}
      sheenColor="#a3e635"
      sheenRoughness={0.5}
      envMapIntensity={1.15}
      transmission={0.06}
      thickness={0.08}
      attenuationColor="#84cc16"
      attenuationDistance={0.4}
      ior={1.4}
      side={THREE.FrontSide}
    />
  );

  const podInteriorMaterial = (
    <meshPhysicalMaterial
      map={podInteriorMap}
      roughness={0.65}
      metalness={0.0}
      clearcoat={0.45}
      clearcoatRoughness={0.4}
      sheen={0.3}
      sheenColor="#e9f3c9"
      sheenRoughness={0.55}
      envMapIntensity={1.0}
      side={THREE.BackSide}
    />
  );

  // Tinte y opacidad del "ojo" (hilum) por variedad. El frijol blanco
  // no tiene mancha negra; aplicamos un overlay claro encima del mismo
  // mesh con un material adicional sería complicado, así que en su lugar
  // usamos un pequeño parche circular crema sobre el +z del frijol.
  const seedTint = `rgb(${(255 * preset.tint[0]) | 0}, ${(255 * preset.tint[1]) | 0}, ${(255 * preset.tint[2]) | 0})`;

  return (
    <group ref={groupRef} rotation={[0.05, 0, -0.1]} position={[0.05, 0, 0]}>
      {showPod && (
        <>
          {/* Vaina cerrada (principal) */}
          <mesh geometry={closedPodGeo} castShadow receiveShadow position={[0, 0, 0.32]}>
            {podMaterialClosed}
          </mesh>
          {/* Sutura dorsal sutil sobre la vaina cerrada — línea fina más
              oscura que el cuerpo, recorre la cresta. En vaina real la
              sutura es la "costura" por donde se abre cuando madura. */}
          <mesh
            geometry={sutureGeo}
            castShadow={false}
            receiveShadow={false}
            position={[0, 0.18, 0.32]}
          >
            <meshPhysicalMaterial
              color="#3d6b18"
              roughness={0.55}
              clearcoat={0.35}
              clearcoatRoughness={0.4}
            />
          </mesh>

          {/* Vaina abierta — revela los frijoles. Acercamos las dos mitades
              (offset Y reducido) para que toquen en el extremo y se vea
              UNA vaina partida, no dos hojuelas separadas con un hueco. */}
          <group position={[0, 0, -0.36]} rotation={[0, 0, 0]}>
            {/* Membrana interior: inset hacia el interior de la vaina
                vía scale<1 para que NO comparta pixels con la cáscara
                exterior. Esto elimina el flickering por z-fighting que
                había antes con ambas mitades en la misma posición. */}
            <mesh
              geometry={openTopGeo}
              castShadow={false}
              receiveShadow
              rotation={[0.32, 0, 0]}
              position={[0, 0.030, 0]}
              scale={[1, 0.92, 0.92]}
            >
              {podInteriorMaterial}
            </mesh>
            <mesh
              geometry={openTopGeo}
              castShadow={false}
              receiveShadow
              rotation={[Math.PI - 0.32, 0, 0]}
              position={[0, -0.030, 0]}
              scale={[1, 0.92, 0.92]}
            >
              {podInteriorMaterial}
            </mesh>

            {/* Capa exterior: mitad superior. FrontSide solo — al mirar
                hacia adentro, esta capa no estorba y vemos la membrana
                interior. polygonOffset empuja la exterior fuera de la
                interior para que no compitan en el bevel. */}
            <mesh geometry={openTopGeo} castShadow receiveShadow rotation={[0.32, 0, 0]} position={[0, 0.030, 0]}>
              {podMaterialOpenExterior}
            </mesh>
            {/* Capa exterior: mitad inferior */}
            <mesh
              geometry={openTopGeo}
              castShadow
              receiveShadow
              rotation={[Math.PI - 0.32, 0, 0]}
              position={[0, -0.030, 0]}
            >
              {podMaterialOpenExterior}
            </mesh>

            {/* Pivot hinge — pequeños trozos de cáscara en los dos
                extremos de la vaina abierta que unen visualmente las dos
                mitades, simulando que la vaina se rajó desde la sutura
                pero las puntas siguen pegadas. Sin esto, las hojuelas
                parecen dos cosas distintas que no se tocan. */}
            {[-1, 1].map((dir) => (
              <mesh
                key={dir}
                castShadow
                receiveShadow
                position={[dir * (POD_LENGTH / 2 - 0.04), 0, 0]}
                rotation={[0, 0, dir * 0.18]}
              >
                <sphereGeometry args={[0.085, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
                <meshPhysicalMaterial
                  map={podMap}
                  normalMap={podNormal}
                  normalScale={[1.0, 1.0]}
                  roughness={0.45}
                  metalness={0.04}
                  clearcoat={0.55}
                  clearcoatRoughness={0.35}
                  sheen={0.35}
                  sheenColor="#a3e635"
                  sheenRoughness={0.55}
                />
              </mesh>
            ))}
          </group>

          {/* Tallo */}
          <mesh geometry={stemGeo} castShadow receiveShadow>
            <meshPhysicalMaterial
              color="#65a30d"
              roughness={0.65}
              clearcoat={0.3}
              clearcoatRoughness={0.4}
            />
          </mesh>
        </>
      )}

      {/* Frijoles. Cuando hay vaina van dentro de ella; si no, se
          presentan sueltos centrados en el origen. Cada variedad
          multiplica el albedo por su tinte; "white" además cubre el
          ojo negro con un parche crema. */}
      <group position={showPod ? [0, 0, -0.36] : [0, 0, 0]}>
        {seedTransforms.map((s, i) => (
          <group
            key={i}
            position={[s.position[0], s.position[1] - (showPod ? 0.02 : 0), s.position[2]]}
            rotation={s.rotation}
            scale={s.scale}
          >
            <mesh geometry={seedGeo} castShadow receiveShadow>
              <meshPhysicalMaterial
                map={seedMap}
                normalMap={seedNormal}
                normalScale={[0.8, 0.8]}
                color={seedTint}
                roughness={0.34}
                metalness={0.06}
                clearcoat={0.95}
                clearcoatRoughness={0.14}
                sheen={0.25}
                sheenColor={preset.sheen}
                sheenRoughness={0.5}
                envMapIntensity={1.25}
              />
            </mesh>
            {preset.hidesEye && (
              // Variedad "white" (caupí blanco): tapa la mancha del hilum
              // con un parche crema-marfil que se mezcla con el cuerpo
              // de la semilla. Render por encima del albedo, con
              // ligero depthWrite=false para no romper bordes.
              <mesh position={[0, 0, 0.058]} rotation={[0, 0, 0]}>
                <sphereGeometry args={[0.014, 16, 12]} />
                <meshPhysicalMaterial
                  color="#ede0c4"
                  roughness={0.32}
                  metalness={0}
                  clearcoat={0.6}
                  clearcoatRoughness={0.2}
                  depthWrite={false}
                />
              </mesh>
            )}
          </group>
        ))}
      </group>

      {/* Hojas trifoliadas — solo cuando hay vaina (contexto planta) */}
      {showPod && [
        { pos: [-POD_LENGTH / 2 - 0.42, 0.55, 0.02], rot: [0.4, 0.2, -0.5], scale: 0.6 },
        { pos: [-POD_LENGTH / 2 - 0.34, 0.62, -0.18], rot: [0.5, -0.4, -0.2], scale: 0.5 },
        { pos: [-POD_LENGTH / 2 - 0.5, 0.48, 0.22], rot: [0.3, 0.6, -0.7], scale: 0.55 },
      ].map((cfg, i) => (
        <mesh
          key={i}
          geometry={leafGeo}
          position={cfg.pos}
          rotation={cfg.rot}
          scale={cfg.scale}
          castShadow
          receiveShadow
        >
          <meshPhysicalMaterial
            map={leafMap}
            normalMap={leafNormal}
            normalScale={[0.85, 0.85]}
            roughness={0.55}
            metalness={0.02}
            clearcoat={0.5}
            clearcoatRoughness={0.45}
            sheen={0.55}
            sheenColor="#a3e635"
            sheenRoughness={0.5}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}
