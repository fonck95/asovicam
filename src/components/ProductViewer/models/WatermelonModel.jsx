import { useMemo } from 'react';
import * as THREE from 'three';

const RADIUS = 1.05;

// Custom striped shader so the rind shows realistic curved bands
function StripedRind() {
  const material = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: '#16a34a',
      roughness: 0.42,
      metalness: 0.05,
    });

    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `
          #include <common>
          varying vec3 vLocalPos;
        `,
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
          #include <begin_vertex>
          vLocalPos = position;
        `,
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `
          #include <common>
          varying vec3 vLocalPos;

          // simple value noise for the mottle along stripes
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
        `,
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
          #include <color_fragment>
          // Longitude angle around Y for stripe direction
          float lon = atan(vLocalPos.z, vLocalPos.x);
          // distort stripes a bit using noise so they're not perfectly straight
          float wob = noise(vLocalPos * 4.0) * 0.35;
          float stripe = sin(lon * 12.0 + wob * 2.0);
          // Smooth stripe band: dark green where stripe<0
          float band = smoothstep(-0.15, 0.15, stripe);
          vec3 darkGreen = vec3(0.04, 0.18, 0.06);
          vec3 lightGreen = vec3(0.32, 0.62, 0.20);
          // mottle texture inside stripes
          float mottle = noise(vLocalPos * 8.0);
          lightGreen = mix(lightGreen, lightGreen * 0.85, mottle);
          darkGreen = mix(darkGreen, darkGreen * 1.4, mottle * 0.7);
          vec3 rindColor = mix(darkGreen, lightGreen, band);
          diffuseColor.rgb = rindColor;
        `,
      );
    };

    return mat;
  }, []);

  // Slightly oblong sphere for an authentic watermelon shape
  const geometry = useMemo(() => {
    const geo = new THREE.SphereGeometry(RADIUS, 96, 64);
    // subtle bumpy surface via vertex displacement
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const len = v.length();
      const noise =
        Math.sin(v.x * 8) * Math.cos(v.y * 7) * Math.sin(v.z * 6) * 0.012;
      v.setLength(len + noise);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    geo.scale(1, 0.92, 1);
    return geo;
  }, []);

  return (
    <mesh geometry={geometry} material={material} castShadow receiveShadow />
  );
}

function Stem() {
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, RADIUS * 0.92, 0),
        new THREE.Vector3(0.05, RADIUS * 0.92 + 0.12, 0.04),
        new THREE.Vector3(-0.02, RADIUS * 0.92 + 0.22, -0.05),
        new THREE.Vector3(0.08, RADIUS * 0.92 + 0.35, 0.02),
      ]),
    [],
  );
  const geometry = useMemo(
    () => new THREE.TubeGeometry(curve, 20, 0.04, 10, false),
    [curve],
  );
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color="#3f6212" roughness={0.85} />
    </mesh>
  );
}

function Tendril() {
  // Spiral curl
  const curve = useMemo(() => {
    const points = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const a = t * Math.PI * 5;
      const r = 0.04 + t * 0.06;
      points.push(
        new THREE.Vector3(
          0.18 + Math.cos(a) * r,
          RADIUS * 0.92 + 0.12 + t * 0.18,
          Math.sin(a) * r,
        ),
      );
    }
    return new THREE.CatmullRomCurve3(points);
  }, []);
  const geometry = useMemo(
    () => new THREE.TubeGeometry(curve, 60, 0.012, 6, false),
    [curve],
  );
  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial color="#65a30d" roughness={0.85} />
    </mesh>
  );
}

function Leaf({ position, rotation, scale }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    // Lobed watermelon leaf approximation
    shape.moveTo(0, 0);
    shape.bezierCurveTo(0.4, 0.1, 0.55, 0.4, 0.45, 0.7);
    shape.bezierCurveTo(0.35, 0.85, 0.2, 0.95, 0.05, 1.0);
    shape.bezierCurveTo(-0.05, 1.0, -0.2, 0.95, -0.35, 0.85);
    shape.bezierCurveTo(-0.55, 0.4, -0.4, 0.1, 0, 0);
    const geo = new THREE.ShapeGeometry(shape, 18);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const x = pos.getX(i);
      pos.setZ(i, Math.sin(y * 2.2) * 0.07 + Math.cos(x * 3.1) * 0.04);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <mesh
      geometry={geometry}
      position={position}
      rotation={rotation}
      scale={scale}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial
        color="#4ade80"
        roughness={0.6}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export default function WatermelonModel() {
  return (
    <group rotation={[0.05, 0, 0.08]}>
      <StripedRind />
      <Stem />
      <Tendril />
      <Leaf
        position={[0.18, RADIUS * 0.92 + 0.05, -0.12]}
        rotation={[0.6, -0.3, 0.2]}
        scale={0.4}
      />
      <Leaf
        position={[-0.14, RADIUS * 0.92 + 0.08, 0.1]}
        rotation={[0.4, 0.5, -0.3]}
        scale={0.35}
      />
    </group>
  );
}
