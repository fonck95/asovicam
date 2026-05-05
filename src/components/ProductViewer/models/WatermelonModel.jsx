import { useMemo } from 'react';
import * as THREE from 'three';

const RADIUS = 1.12;

// MeshPhysicalMaterial + custom stripe shader injected via onBeforeCompile.
// Clearcoat simulates the waxy, sunlit sheen of a fresh watermelon rind.
function StripedRind() {
  const material = useMemo(() => {
    const mat = new THREE.MeshPhysicalMaterial({
      color: '#228b22',
      roughness: 0.28,
      metalness: 0,
      clearcoat: 0.65,
      clearcoatRoughness: 0.18,
    });

    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
         varying vec3 vLocalPos;`,
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vLocalPos = position;`,
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
         varying vec3 vLocalPos;

         float hash(vec3 p){
           p = fract(p*0.3183099+0.1); p*=17.0;
           return fract(p.x*p.y*p.z*(p.x+p.y+p.z));
         }
         float noise(vec3 p){
           vec3 i=floor(p), f=fract(p);
           f=f*f*(3.0-2.0*f);
           return mix(
             mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),
                 mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                 mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),
             f.z);
         }`,
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         float lon = atan(vLocalPos.z, vLocalPos.x);
         float latN = vLocalPos.y / ${RADIUS.toFixed(3)};

         // Two-octave domain warp gives organic stripe wiggle
         float wob = noise(vLocalPos*3.2)*0.42 + noise(vLocalPos*7.5)*0.14;
         float stripe = sin(lon*10.0 + wob*2.8 + latN*0.6);
         float band = smoothstep(-0.22, 0.22, stripe);

         vec3 darkGreen  = vec3(0.045, 0.18, 0.035);
         vec3 lightGreen = vec3(0.24, 0.58, 0.14);

         // Mottle within each zone
         float mottle = noise(vLocalPos*9.5)*0.10;
         lightGreen = lightGreen*(0.90+mottle);
         darkGreen  = darkGreen *(1.00+mottle*0.6);

         vec3 rindColor = mix(darkGreen, lightGreen, band);

         // Creamy belly: underside where the melon rested on soil
         float belly = smoothstep(0.50, 0.80, -latN)
                     * smoothstep(0.90, 0.30, abs(lon)/3.14159)
                     * 0.55;
         rindColor = mix(rindColor, vec3(0.90, 0.84, 0.60), belly);

         diffuseColor.rgb = rindColor;`,
      );
    };

    return mat;
  }, []);

  // Slightly oblong: longer on X, flatter on Y — typical field watermelon shape
  const geometry = useMemo(() => {
    const geo = new THREE.SphereGeometry(RADIUS, 96, 64);
    geo.scale(1.18, 0.88, 1.0);
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const bump =
        Math.sin(v.x * 7.5) * Math.cos(v.y * 8.2) * Math.sin(v.z * 6.1) * 0.013;
      v.setLength(v.length() + bump);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
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
        new THREE.Vector3(0,     RADIUS * 0.88, 0),
        new THREE.Vector3( 0.04, RADIUS * 0.88 + 0.11,  0.03),
        new THREE.Vector3(-0.02, RADIUS * 0.88 + 0.22, -0.04),
        new THREE.Vector3( 0.06, RADIUS * 0.88 + 0.34,  0.02),
      ]),
    [],
  );
  const geometry = useMemo(
    () => new THREE.TubeGeometry(curve, 18, 0.035, 10, false),
    [curve],
  );
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshPhysicalMaterial color="#4a6a10" roughness={0.86} clearcoat={0.08} />
    </mesh>
  );
}

function Tendril() {
  const curve = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= 54; i++) {
      const t = i / 54;
      const a = t * Math.PI * 6.5;
      const r = 0.028 + t * 0.072;
      pts.push(
        new THREE.Vector3(
          0.24 + Math.cos(a) * r,
          RADIUS * 0.88 + 0.10 + t * 0.24,
          Math.sin(a) * r,
        ),
      );
    }
    return new THREE.CatmullRomCurve3(pts);
  }, []);
  const geometry = useMemo(
    () => new THREE.TubeGeometry(curve, 72, 0.009, 6, false),
    [curve],
  );
  return (
    <mesh geometry={geometry} castShadow>
      <meshPhysicalMaterial color="#5a8a16" roughness={0.90} clearcoat={0.08} />
    </mesh>
  );
}

function WatermelonLeaf({ position, rotation, scale = 1 }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    // Five-lobed watermelon leaf silhouette
    shape.moveTo(0, 0);
    shape.bezierCurveTo( 0.52,  0.06,  0.72,  0.48,  0.58,  0.82);
    shape.bezierCurveTo( 0.45,  1.05,  0.20,  1.12,  0,     1.06);
    shape.bezierCurveTo(-0.20,  1.12, -0.45,  1.05, -0.58,  0.82);
    shape.bezierCurveTo(-0.72,  0.48, -0.52,  0.06,  0,     0);
    const geo = new THREE.ShapeGeometry(shape, 28);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const x = pos.getX(i);
      // Gentle dish + edge ripple
      pos.setZ(i, Math.sin(y * 2.6) * 0.065 + Math.cos(x * 2.8) * 0.04);
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
      <meshPhysicalMaterial
        color="#3a8020"
        roughness={0.52}
        metalness={0}
        clearcoat={0.28}
        clearcoatRoughness={0.48}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export default function WatermelonModel() {
  const top = RADIUS * 0.87;
  return (
    <group rotation={[0.04, 0.18, 0.06]}>
      <StripedRind />
      <Stem />
      <Tendril />
      <WatermelonLeaf position={[ 0.22, top + 0.05, -0.16]} rotation={[ 0.62, -0.38,  0.30]} scale={0.52} />
      <WatermelonLeaf position={[-0.20, top + 0.09,  0.14]} rotation={[ 0.46,  0.52, -0.42]} scale={0.44} />
      <WatermelonLeaf position={[ 0.12, top + 0.14,  0.22]} rotation={[ 0.54, -0.18,  0.62]} scale={0.38} />
    </group>
  );
}
