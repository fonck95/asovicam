import { useMemo } from 'react';
import * as THREE from 'three';

const RADIUS = 1.05;

// Custom striped shader so the rind shows realistic curved bands of varying
// density, plus a subtle waxy specular sheen. The stripes are anchored in
// local space so they stay locked to the fruit while it rotates.
function StripedRind() {
  const material = useMemo(() => {
    const mat = new THREE.MeshPhysicalMaterial({
      color: '#16a34a',
      roughness: 0.34,
      metalness: 0.04,
      clearcoat: 0.35,
      clearcoatRoughness: 0.4,
      sheen: 0.5,
      sheenColor: new THREE.Color('#bbf7d0'),
      sheenRoughness: 0.7,
      envMapIntensity: 1.0,
    });

    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `
          #include <common>
          varying vec3 vLocalPos;
          varying vec3 vLocalNormal;
        `,
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
          #include <begin_vertex>
          vLocalPos = position;
          vLocalNormal = normal;
        `,
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `
          #include <common>
          varying vec3 vLocalPos;
          varying vec3 vLocalNormal;

          // hash + value noise for the mottle along stripes
          float hash(vec3 p) {
            p = fract(p * 0.3183099 + 0.1);
            p *= 17.0;
            return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
          }
          float noise(vec3 p) {
            vec3 i = floor(p);
            vec3 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                  mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
              mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                  mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
              f.z);
          }
          float fbm(vec3 p) {
            float v = 0.0;
            float a = 0.5;
            for (int i = 0; i < 4; i++) {
              v += a * noise(p);
              p *= 2.02;
              a *= 0.5;
            }
            return v;
          }
        `,
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
          #include <color_fragment>
          // Longitude angle around Y for primary stripe direction
          float lon = atan(vLocalPos.z, vLocalPos.x);
          // distort stripes a bit using fbm so they branch and bend naturally
          float wob = (fbm(vLocalPos * 3.5) - 0.5) * 1.6;
          float stripeRaw = sin(lon * 11.0 + wob);

          // primary band mask
          float band = smoothstep(-0.12, 0.12, stripeRaw);

          // Secondary mottling inside the lighter stripes
          float mottle = fbm(vLocalPos * 7.0 + vec3(0.0, lon * 0.5, 0.0));
          float speckle = smoothstep(0.62, 0.78, mottle);
          float lightSpeckle = smoothstep(0.74, 0.85, mottle);

          // Color base values tuned to look like a real Charleston Gray melon
          vec3 deepGreen   = vec3(0.04, 0.18, 0.06);
          vec3 darkGreen   = vec3(0.10, 0.32, 0.13);
          vec3 midGreen    = vec3(0.28, 0.55, 0.22);
          vec3 paleGreen   = vec3(0.55, 0.78, 0.42);

          vec3 stripeColor = mix(deepGreen, darkGreen, mottle);
          // Inside the light stripes mix mid + pale based on the speckle
          vec3 fieldColor = mix(midGreen, paleGreen, lightSpeckle * 0.85);
          fieldColor = mix(fieldColor, midGreen * 0.85, speckle * 0.4);

          vec3 rindColor = mix(stripeColor, fieldColor, band);

          // Pole darkening (stem/blossom ends are slightly darker)
          float pole = smoothstep(0.85, 1.0, abs(normalize(vLocalPos).y));
          rindColor = mix(rindColor, rindColor * 0.7, pole * 0.45);

          // Subtle "ground spot" — bottom of the fruit a touch yellower where
          // it would have rested on the soil
          float ground = smoothstep(-0.95, -0.6, vLocalPos.y) - smoothstep(-0.6, -0.3, vLocalPos.y);
          ground = max(ground, 0.0);
          rindColor = mix(rindColor, vec3(0.85, 0.78, 0.45), ground * 0.18);

          diffuseColor.rgb = rindColor;
        `,
      );
    };

    return mat;
  }, []);

  // Slightly oblong sphere for an authentic watermelon shape, with bumpy
  // surface and a touch of stretching along Y for the classic oblate look.
  const geometry = useMemo(() => {
    const geo = new THREE.SphereGeometry(RADIUS, 128, 80);
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const len = v.length();
      // Two scales of bumps: large undulations + fine pebbly texture
      const big =
        Math.sin(v.x * 3.1) * Math.cos(v.y * 2.7) * Math.sin(v.z * 2.3) * 0.018;
      const fine =
        Math.sin(v.x * 14) * Math.cos(v.y * 13) * Math.sin(v.z * 12) * 0.006;
      v.setLength(len + big + fine);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    geo.scale(1, 0.9, 1);
    return geo;
  }, []);

  return (
    <mesh geometry={geometry} material={material} castShadow receiveShadow />
  );
}

// Dimple / blossom-end at the bottom — classic watermelon detail.
function BlossomEnd() {
  return (
    <mesh position={[0, -RADIUS * 0.9, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.015, 0.05, 24]} />
      <meshStandardMaterial color="#3f6212" roughness={0.85} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Stem() {
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, RADIUS * 0.9, 0),
        new THREE.Vector3(0.06, RADIUS * 0.9 + 0.13, 0.04),
        new THREE.Vector3(-0.02, RADIUS * 0.9 + 0.24, -0.05),
        new THREE.Vector3(0.09, RADIUS * 0.9 + 0.38, 0.02),
      ]),
    [],
  );
  const geometry = useMemo(
    () => new THREE.TubeGeometry(curve, 24, 0.045, 12, false),
    [curve],
  );
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color="#4d7c0f"
        roughness={0.88}
        metalness={0}
      />
    </mesh>
  );
}

// Spiral curl tendril near the stem.
function Tendril() {
  const curve = useMemo(() => {
    const points = [];
    for (let i = 0; i <= 50; i++) {
      const t = i / 50;
      const a = t * Math.PI * 5.5;
      const r = 0.04 + t * 0.07;
      points.push(
        new THREE.Vector3(
          0.18 + Math.cos(a) * r,
          RADIUS * 0.9 + 0.12 + t * 0.2,
          Math.sin(a) * r,
        ),
      );
    }
    return new THREE.CatmullRomCurve3(points);
  }, []);
  const geometry = useMemo(
    () => new THREE.TubeGeometry(curve, 70, 0.012, 6, false),
    [curve],
  );
  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial color="#84cc16" roughness={0.85} />
    </mesh>
  );
}

// Lobed leaf with veining baked into the shader.
function useLeafMaterial(color = '#4ade80') {
  return useMemo(() => {
    const mat = new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.55,
      metalness: 0.02,
      clearcoat: 0.25,
      clearcoatRoughness: 0.55,
      side: THREE.DoubleSide,
    });
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
          #include <color_fragment>
          float central = smoothstep(0.49, 0.5, vUv.x) - smoothstep(0.5, 0.51, vUv.x);
          float ribAngle = abs(vUv.x - 0.5) * 2.0;
          float side = sin(vUv.y * 11.0) * 0.5 + 0.5;
          side = smoothstep(0.92, 1.0, side) * (1.0 - ribAngle * 0.3);
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

function Leaf({ position, rotation, scale, material }) {
  const geometry = useMemo(() => {
    // 5-lobed watermelon-leaf silhouette
    const shape = new THREE.Shape();
    const lobes = 5;
    const N = 90;
    shape.moveTo(0, 0);
    for (let i = 1; i <= N; i++) {
      const t = i / N;
      const angle = Math.PI * (t - 0.5);
      // r modulated by 5 lobes + slight teeth
      const lobe = 0.7 + 0.3 * Math.cos(angle * lobes);
      const teeth = 0.04 * Math.sin(angle * lobes * 6);
      const r = (lobe + teeth) * 0.95;
      const x = Math.sin(angle) * r;
      const y = (1 - Math.cos(angle)) * r * 0.95;
      shape.lineTo(x, y);
    }
    shape.lineTo(0, 0);
    const geo = new THREE.ShapeGeometry(shape, 28);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      pos.setZ(
        i,
        Math.sin(y * 2.3) * 0.08 +
          Math.cos(x * 3.4) * 0.045 -
          Math.pow(Math.abs(x), 1.4) * 0.12,
      );
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

export default function WatermelonModel() {
  const leafMat = useLeafMaterial('#65a30d');
  const leafMatLight = useLeafMaterial('#86c54a');

  return (
    <group rotation={[0.06, 0, 0.08]}>
      <StripedRind />
      <BlossomEnd />
      <Stem />
      <Tendril />
      <Leaf
        position={[0.22, RADIUS * 0.9 + 0.06, -0.14]}
        rotation={[0.6, -0.3, 0.2]}
        scale={0.45}
        material={leafMat}
      />
      <Leaf
        position={[-0.16, RADIUS * 0.9 + 0.1, 0.12]}
        rotation={[0.4, 0.5, -0.3]}
        scale={0.4}
        material={leafMatLight}
      />
      <Leaf
        position={[0.0, RADIUS * 0.9 + 0.16, 0.22]}
        rotation={[0.5, 0.0, 0.05]}
        scale={0.32}
        material={leafMat}
      />
    </group>
  );
}
