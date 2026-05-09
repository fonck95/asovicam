import { useMemo } from 'react';
import * as THREE from 'three';

const POD_LENGTH = 2.0;
const POD_RADIUS = 0.2;

// Pod geometry: curved tube with bean-bulges and gentle taper at the tips.
function buildPodGeometry() {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-POD_LENGTH / 2, -0.06, 0),
    new THREE.Vector3(-POD_LENGTH / 4, 0.2, 0.05),
    new THREE.Vector3(0, 0.24, 0),
    new THREE.Vector3(POD_LENGTH / 4, 0.2, -0.05),
    new THREE.Vector3(POD_LENGTH / 2, -0.06, 0),
  ]);

  const segs = 96;
  const radial = 24;
  const positions = [];
  const indices = [];
  const uvs = [];
  const frames = curve.computeFrenetFrames(segs, false);
  const points = curve.getSpacedPoints(segs);

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const taper = Math.sin(t * Math.PI) * 0.88 + 0.12;
    // 6 beans visible — bumps along the pod
    const bumps = 1 + Math.sin(t * Math.PI * 6 - Math.PI / 2) * 0.16;
    const r = POD_RADIUS * taper * bumps;
    const N = frames.normals[Math.min(i, segs - 1)];
    const B = frames.binormals[Math.min(i, segs - 1)];
    const P = points[i];

    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      // squashed cross-section so the pod is flatter top/bottom
      const nx = Math.cos(a);
      const ny = Math.sin(a) * 0.62;
      // tiny surface noise for organic feel
      const noise =
        Math.sin(a * 4 + i * 0.6) * 0.004 +
        Math.cos(t * 50) * 0.0025;
      const radius = r + noise;
      const x = P.x + (N.x * nx + B.x * ny) * radius;
      const y = P.y + (N.y * nx + B.y * ny) * radius;
      const z = P.z + (N.z * nx + B.z * ny) * radius;
      positions.push(x, y, z);
      uvs.push(j / radial, t);
    }
  }

  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j;
      const b = i * radial + ((j + 1) % radial);
      const c = (i + 1) * radial + j;
      const d = (i + 1) * radial + ((j + 1) % radial);
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return { geometry: geo, curve };
}

// Cowpea bean geometry: a kidney-shaped bean (slightly flattened sphere
// with an inward dent on one side where the hilum/eye sits).
function buildBeanGeometry() {
  const geo = new THREE.SphereGeometry(0.13, 32, 24);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // Indent on the +Z side for the hilum, slightly along -X
    const indent =
      Math.max(0, v.z * 1.2) * Math.exp(-(v.x ** 2 + v.y ** 2) * 18) * 0.04;
    v.z -= indent;
    // Slight kidney curve along x
    v.y += v.x * v.x * 0.18;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  // flatten slightly along z so it's lens-shaped, not perfectly round
  geo.scale(1, 0.95, 0.85);
  return geo;
}

function BeanInside({ position, rotation, scale = 1, dark = false }) {
  // Cowpea: cream-colored bean with the dark "eye" (hilum patch).
  const beanGeo = useMemo(buildBeanGeometry, []);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh geometry={beanGeo} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={dark ? '#fde68a' : '#fef9c3'}
          roughness={0.42}
          metalness={0.02}
          clearcoat={0.4}
          clearcoatRoughness={0.5}
          sheen={0.3}
          sheenColor="#fef3c7"
        />
      </mesh>
      {/* Hilum eye: an oval brown patch on the inward face */}
      <mesh position={[0, 0, 0.105]}>
        <circleGeometry args={[0.05, 24]} />
        <meshStandardMaterial color="#1c1208" roughness={0.65} />
      </mesh>
      {/* Subtle ring around the eye for that real cowpea look */}
      <mesh position={[0, 0, 0.106]}>
        <ringGeometry args={[0.05, 0.058, 28]} />
        <meshStandardMaterial color="#78350f" roughness={0.7} />
      </mesh>
    </group>
  );
}

// Pod material with longitudinal seam baked into the shader.
function usePodMaterial() {
  return useMemo(() => {
    const mat = new THREE.MeshPhysicalMaterial({
      color: '#84cc16',
      roughness: 0.42,
      metalness: 0.02,
      clearcoat: 0.5,
      clearcoatRoughness: 0.5,
      sheen: 0.4,
      sheenColor: '#bbf7d0',
      envMapIntensity: 1.0,
    });
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
          #include <color_fragment>
          // Dark seams along the top and bottom of the pod (vUv.x = around)
          float seamTop = abs(sin(vUv.x * 3.14159));
          float seam = smoothstep(0.96, 1.0, seamTop);
          // tip darkening
          float tip = smoothstep(0.0, 0.06, vUv.y) * smoothstep(1.0, 0.94, vUv.y);
          // longitudinal subtle striping
          float stripe = sin(vUv.x * 50.0) * 0.5 + 0.5;
          stripe = pow(stripe, 6.0) * 0.06;
          diffuseColor.rgb *= mix(1.0, 0.55, seam);
          diffuseColor.rgb *= mix(0.78, 1.0, tip);
          diffuseColor.rgb -= stripe * vec3(0.05, 0.04, 0.02);
        `,
      );
    };
    return mat;
  }, []);
}

function Pod({ geometry, curve, podMat }) {
  // 6 beans bulging visibly along the pod
  const beans = useMemo(() => {
    const arr = [];
    const count = 6;
    for (let i = 0; i < count; i++) {
      const t = (i + 0.55) / (count + 0.1);
      const p = curve.getPoint(t);
      const tan = curve.getTangent(t);
      const angle = Math.atan2(tan.x, tan.y) - Math.PI / 2;
      arr.push({
        position: [p.x, p.y + 0.02, p.z + 0.005],
        rotation: [Math.PI / 2, 0, -angle],
        dark: i % 2 === 0,
      });
    }
    return arr;
  }, [curve]);

  return (
    <group>
      <mesh geometry={geometry} material={podMat} castShadow receiveShadow />
      {beans.map((b, i) => (
        <BeanInside
          key={i}
          position={b.position}
          rotation={b.rotation}
          dark={b.dark}
        />
      ))}
    </group>
  );
}

// Detailed leaf with central + side veins baked into the shader.
function useLeafMaterial(color = '#4ade80') {
  return useMemo(() => {
    const mat = new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.55,
      metalness: 0.02,
      clearcoat: 0.3,
      clearcoatRoughness: 0.6,
      side: THREE.DoubleSide,
    });
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
          #include <color_fragment>
          // Central vein along x=0 (uv.x near 0.5) and side veins
          float midV = 1.0 - smoothstep(0.495, 0.505, vUv.x) * smoothstep(0.495, 0.505, 1.0 - vUv.x);
          float central = smoothstep(0.49, 0.5, vUv.x) - smoothstep(0.5, 0.51, vUv.x);
          float ribAngle = abs(vUv.x - 0.5) * 2.0;
          float side = sin(vUv.y * 9.0) * 0.5 + 0.5;
          side = smoothstep(0.92, 1.0, side) * (1.0 - ribAngle * 0.3);
          // tip darkening + base shadow
          float tip = smoothstep(0.0, 0.1, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
          diffuseColor.rgb *= mix(0.7, 1.05, tip);
          diffuseColor.rgb -= central * vec3(0.12, 0.08, 0.04);
          diffuseColor.rgb -= side * vec3(0.06, 0.05, 0.02);
        `,
      );
    };
    return mat;
  }, [color]);
}

function Leaf({ position, rotation, scale = 1, material }) {
  // Trifoliate leaflet — almond-shaped with subtle bend.
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(0.28, 0.05, 0.5, 0.42, 0.42, 0.74);
    shape.bezierCurveTo(0.32, 1.0, 0.12, 1.12, 0, 1.16);
    shape.bezierCurveTo(-0.12, 1.12, -0.32, 1.0, -0.42, 0.74);
    shape.bezierCurveTo(-0.5, 0.42, -0.28, 0.05, 0, 0);
    const geo = new THREE.ShapeGeometry(shape, 24);
    // Bend: arch the leaf along its length
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z =
        Math.sin(y * 1.45) * 0.1 +
        Math.cos(x * 4.0) * 0.025 -
        Math.pow(Math.abs(x), 1.6) * 0.18;
      pos.setZ(i, z);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={position}
      rotation={rotation}
      scale={scale}
      castShadow
      receiveShadow
    />
  );
}

function Stem() {
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-POD_LENGTH / 2 - 0.05, -0.05, 0),
        new THREE.Vector3(-POD_LENGTH / 2 - 0.22, 0.16, 0.04),
        new THREE.Vector3(-POD_LENGTH / 2 - 0.42, 0.4, -0.02),
        new THREE.Vector3(-POD_LENGTH / 2 - 0.5, 0.55, 0.04),
      ]),
    [],
  );
  const geometry = useMemo(
    () => new THREE.TubeGeometry(curve, 24, 0.026, 10, false),
    [curve],
  );

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color="#65a30d" roughness={0.7} />
    </mesh>
  );
}

// Decorative tendril curling away from the stem.
function Tendril() {
  const curve = useMemo(() => {
    const points = [];
    const N = 30;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const a = t * Math.PI * 4.5;
      const r = 0.04 + (1 - t) * 0.05;
      points.push(
        new THREE.Vector3(
          -POD_LENGTH / 2 - 0.32 + Math.cos(a) * r,
          0.45 + t * 0.18,
          0.06 + Math.sin(a) * r,
        ),
      );
    }
    return new THREE.CatmullRomCurve3(points);
  }, []);
  const geometry = useMemo(
    () => new THREE.TubeGeometry(curve, 50, 0.008, 6, false),
    [curve],
  );
  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial color="#84cc16" roughness={0.8} />
    </mesh>
  );
}

// Tiny pale-yellow cowpea flower at the stem axil.
function Flower() {
  return (
    <group position={[-POD_LENGTH / 2 - 0.18, 0.22, 0.05]}>
      {[0, 72, 144, 216, 288].map((deg, i) => (
        <mesh key={i} rotation={[0, 0, (deg * Math.PI) / 180]}>
          <circleGeometry args={[0.045, 16]} />
          <meshStandardMaterial
            color="#fef9c3"
            roughness={0.6}
            side={THREE.DoubleSide}
            emissive="#facc15"
            emissiveIntensity={0.05}
          />
        </mesh>
      ))}
      <mesh>
        <sphereGeometry args={[0.018, 12, 10]} />
        <meshStandardMaterial color="#a16207" roughness={0.6} />
      </mesh>
    </group>
  );
}

export default function BeanModel() {
  const { geometry, curve } = useMemo(buildPodGeometry, []);
  const podMat = usePodMaterial();
  const leafMatLight = useLeafMaterial('#4ade80');
  const leafMatMid = useLeafMaterial('#22c55e');
  const leafMatDark = useLeafMaterial('#15803d');

  return (
    <group rotation={[0.08, 0, -0.12]} position={[0.05, 0, 0]}>
      <Pod geometry={geometry} curve={curve} podMat={podMat} />
      <Stem />
      <Tendril />
      <Flower />
      <Leaf
        position={[-POD_LENGTH / 2 - 0.5, 0.55, 0.02]}
        rotation={[0.4, 0.2, -0.5]}
        scale={0.6}
        material={leafMatMid}
      />
      <Leaf
        position={[-POD_LENGTH / 2 - 0.45, 0.62, -0.22]}
        rotation={[0.5, -0.4, -0.2]}
        scale={0.5}
        material={leafMatLight}
      />
      <Leaf
        position={[-POD_LENGTH / 2 - 0.6, 0.45, 0.22]}
        rotation={[0.3, 0.6, -0.7]}
        scale={0.55}
        material={leafMatDark}
      />
      <Leaf
        position={[-POD_LENGTH / 2 - 0.35, 0.7, 0.0]}
        rotation={[0.2, -0.1, -0.3]}
        scale={0.42}
        material={leafMatMid}
      />
    </group>
  );
}
