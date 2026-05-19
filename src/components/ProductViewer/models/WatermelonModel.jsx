import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  generateWatermelonSeedLayout,
  makeWatermelonColorTexture,
  makeWatermelonFleshTexture,
  makeWatermelonFleshNormalTexture,
  makeWatermelonFleshRoughnessTexture,
  makeWatermelonNormalTexture,
  makeWatermelonRindRoughnessTexture,
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
// queden semi-embebidas en la pulpa. Cada semilla recibe además un
// micro-offset de profundidad determinístico (s.depthOffset) para que
// no todas estén a la misma altura — algunas más expuestas que otras.
const SEED_FRONT_Z = SLICE_DEPTH / 2 - 0.010 + 0.006;  // ~0.166
const SEED_BACK_Z = -SEED_FRONT_Z;
function generateSeedPositions() {
  // Layout placental compartido con la textura (asegura alineación
  // exacta entre cada semilla 3D y la cavidad oscura pintada bajo ella).
  return generateWatermelonSeedLayout().map((s) => ({
    position: [
      s.nx * SLICE_RADIUS,
      s.ny * SLICE_RADIUS,
      SEED_FRONT_Z + s.depthOffset,
    ],
    rotation: [0, 0, s.rotZ],
    scale: s.scale,
  }));
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
  const rindRoughness = useMemo(makeWatermelonRindRoughnessTexture, []);
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
          {/* CÁSCARA PBR — Citrullus lanatus cuticula cerosa.
              Cambios respecto a la versión anterior:
              - metalness: 0.04 → 0 (dieléctrico puro; el 0.04 anterior
                inyectaba un sesgo metálico injustificado en Schlick).
              - ior: 1.42 explícito (cutícula + cera vegetal → F0 ≈ 0.030).
              - clearcoat: 0.95 → 0.55. La cera natural NO es laca
                automotriz; clearcoat al 95% producía un espejo perfecto
                que aplanaba la microvariación.
              - clearcoatRoughness: 0.22 → 0.30 (la capa cerosa real
                tiene microestructura: el highlight viene "respirado").
              - roughness: 0.42 → 1.0 + roughnessMap obligatorio.
                Anti-patrón "roughness uniforme" fijado. El mapa marca
                franjas oscuras (pulidas, ~0.30), lámina entre rayas
                (~0.60), y cicatrices (~0.85). GGX integra un highlight
                heterogéneo característico.
              - envMapIntensity: 1.25 → 1.05 (ligera bajada al
                desactivar el clearcoat extremo; el IBL ya no se reparte
                entre dos lóbulos especulares casi idénticos). */}
          <meshPhysicalMaterial
            map={rindMap}
            normalMap={rindNormal}
            normalScale={[1.05, 1.05]}
            roughnessMap={rindRoughness}
            roughness={1.0}
            metalness={0}
            ior={1.42}
            clearcoat={0.55}
            clearcoatRoughness={0.30}
            envMapIntensity={1.05}
            sheen={0.25}
            sheenColor="#a3e635"
            sheenRoughness={0.5}
          />
        </mesh>

        {/* FIELD SPOT — mancha cremosa-amarilla en el lateral inferior
            donde el fruto reposó sobre el suelo. Marcador botánico de
            madurez del Charleston Gray (más amarillo = más maduro).
            Físicamente es tejido descolorido por contacto con el
            suelo: epidermis sin cloroplastos + cera abrasionada → más
            mate que el resto del rind.
            Posición: punto sobre el elipsoide (escalas 1.32/0.93/0.97)
            en lat=-30° / lon=40°. Rotación calculada para alinear la
            normal del CircleGeometry (+Z local) con la normal
            saliente del elipsoide ahí. Offset 0.012 hacia afuera para
            evitar z-fighting con la cáscara. */}
        <mesh
          position={[0.741, -0.472, 0.652]}
          rotation={[0.591, 0.554, 0]}
          renderOrder={1}
        >
          <circleGeometry args={[0.34, 48]} />
          <meshPhysicalMaterial
            color="#e8d995"
            roughness={0.78}
            metalness={0}
            ior={1.42}
            clearcoat={0.20}
            clearcoatRoughness={0.55}
            sheen={0.18}
            sheenColor="#fff0c0"
            sheenRoughness={0.55}
            transparent
            opacity={0.86}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Marca floral del extremo opuesto al tallo (Y-scale = 0.93) */}
        <mesh position={[0, -RADIUS * 0.93, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.012, 0.04, 32]} />
          <meshStandardMaterial color="#3f6212" roughness={0.85} side={THREE.DoubleSide} />
        </mesh>

        {/* STEM NUB — pequeña cicatriz seca en el polo superior
            (donde estaba el peduncle). Material seco, sin cera,
            tono marrón-grisáceo. Aporta legibilidad inmediata como
            "sandía de campo" en lugar de bola verde anónima. */}
        <group position={[0, RADIUS * 0.93, 0]} rotation={[0, 0, 0.3]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.026, 0.034, 0.045, 18]} />
            <meshPhysicalMaterial
              color="#6b5a3a"
              roughness={0.92}
              metalness={0}
              ior={1.38}
              sheen={0.10}
              sheenColor="#a89878"
              sheenRoughness={0.7}
            />
          </mesh>
          {/* Halo verde-oscuro alrededor del peduncle (cicatriz del corte) */}
          <mesh position={[0, -0.022, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.030, 0.060, 32]} />
            <meshStandardMaterial
              color="#3a5b1c"
              roughness={0.88}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      </group>
      )}

      {/* === Rebanada === */}
      {showCut && (
      <group position={cutPosition} rotation={cutRotation}>
        {/* Pulpa — refactor PBR (microfaceta + transporte de luz):
            La iteración anterior usaba `emissive` para falsear la
            sensación SSS, lo que sube luminosidad en zonas no
            iluminadas (no es physically based: el SSS auténtico viene
            del transporte de luz por dentro del medio, modelado en
            Three.js con transmission + thickness + attenuationColor +
            ior).
            Cambios:
            - transmission: 0.20 → 0.34. La pulpa madura es claramente
              translúcida bajo backlight; estamos en el rango correcto
              para Beer-Lambert visible.
            - emissive: 0.22 → 0.10. Bajada de fudge no-físico; ahora
              el "glow" interior nace del transmission + attenuation.
            - attenuationDistance: 0.16 → 0.12. Absorción más cerrada
              → la luz que atraviesa se enrojece más rápido, sin
              parecer un colorante translúcido genérico.
            - clearcoat: 0.32 → 0.18. La pulpa fresca tiene un film
              de jugo, no laca. Bajar separa el highlight especular
              del color base.
            - sheen: 0.50 → 0.32 (Estevez-Kulla). Suficiente para que
              el borde leído capture el rim sin saturar a coral.
            - envMapIntensity: 0.85 → 0.65. La pulpa es medio
              translúcida, no superficie metálica/cerámica — el IBL
              no debe dominar el aspecto. */}
        <mesh geometry={sliceFleshGeo} castShadow receiveShadow>
          <meshPhysicalMaterial
            attach="material-0"
            map={fleshMap}
            normalMap={fleshNormal}
            normalScale={[1.25, 1.25]}
            roughnessMap={fleshRoughness}
            roughness={0.50}
            metalness={0.0}
            ior={1.39}
            clearcoat={0.18}
            clearcoatRoughness={0.40}
            transmission={0.34}
            thickness={0.40}
            attenuationColor="#b01a2c"
            attenuationDistance={0.12}
            sheen={0.32}
            sheenColor="#d63a48"
            sheenRoughness={0.45}
            emissive="#3e0814"
            emissiveIntensity={0.10}
            envMapIntensity={0.65}
          />
          {/* Pared lateral del corte (bevel del extrude). Material
              dieléctrico mate-pulido. Antes era un color plano
              demasiado rosa; ahora wine más profundo + sheen rojo para
              que la transición pulpa→mesocarpio quede coherente con
              la nueva paleta del color map. */}
          <meshPhysicalMaterial
            attach="material-1"
            color="#b7363c"
            roughness={0.82}
            metalness={0}
            ior={1.39}
            sheen={0.30}
            sheenColor="#e25b5b"
            sheenRoughness={0.55}
          />
        </mesh>

        {/* Cáscara verde envolviendo el canto curvo de la rebanada.
            Mismos parámetros PBR que la sandía entera (dieléctrico
            cera vegetal con roughnessMap obligatorio) para mantener
            coherencia material entre las dos piezas. */}
        <mesh geometry={sliceRindGeo} castShadow receiveShadow>
          <meshPhysicalMaterial
            map={rindMap}
            normalMap={rindNormal}
            normalScale={[1.05, 1.05]}
            roughnessMap={rindRoughness}
            roughness={1.0}
            metalness={0}
            ior={1.42}
            clearcoat={0.55}
            clearcoatRoughness={0.30}
            envMapIntensity={1.05}
            sheen={0.25}
            sheenColor="#a3e635"
            sheenRoughness={0.55}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* SEMILLAS — PBR refactor.
            La testa de semilla negra de sandía es lignificada,
            dieléctrica, con barniz natural (oxidación de aceites
            superficiales). La versión anterior usaba metalness=0.22
            — anti-patrón explícito del prompt ("Metalness intermedio
            casi siempre incorrecto físicamente"). Las semillas no
            son metálicas; cualquier intuición de "brillo metálico"
            viene del IOR alto de la testa, no de la conductividad
            electrónica.
            Cambios:
            - metalness: 0.22 → 0 (dieléctrico puro).
            - ior: 1.55 explícito (testa lignificada → F0 ≈ 0.046).
            - clearcoat: 1.0 → 0.85 (barniz natural, no lacquer).
            - clearcoatRoughness: 0.10 → 0.18 (microestructura del
              barniz orgánico, no superficie ópticamente perfecta). */}
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
              roughness={0.26}
              metalness={0}
              ior={1.55}
              clearcoat={0.85}
              clearcoatRoughness={0.18}
              envMapIntensity={1.30}
              sheen={0.4}
              sheenColor="#5c1a10"
              sheenRoughness={0.35}
            />
          </mesh>
        ))}
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
              roughness={0.26}
              metalness={0}
              ior={1.55}
              clearcoat={0.85}
              clearcoatRoughness={0.18}
              envMapIntensity={1.30}
              sheen={0.4}
              sheenColor="#5c1a10"
              sheenRoughness={0.35}
            />
          </mesh>
        ))}

        {/* Gotitas de jugo — solución agua+azúcar (IOR ≈ 1.36).
            Añadido `iridescence` para reproducir la película thin-film
            que produce halos cromáticos en gotas reales bajo luz
            blanca (interferencia constructiva/destructiva en el film
            superficial de azúcar disuelto a glancing angles).
            iridescenceIOR=1.30 está entre el del agua pura y el de la
            sacarosa cristalina — un buen valor para "syrup film". */}
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
              attenuationDistance={0.12}
              iridescence={0.35}
              iridescenceIOR={1.30}
              envMapIntensity={1.6}
            />
          </mesh>
        ))}
      </group>
      )}
    </group>
  );
}
