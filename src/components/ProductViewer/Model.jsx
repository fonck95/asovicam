import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

// =====================================================
// Carga el .glb del producto activo.
// - Si el archivo existe, se renderiza con `useGLTF`.
// - Si NO existe (placeholder), cae en una geometría
//   primitiva para que el visor funcione desde el primer
//   `npm run dev` sin modelos reales.
// - Se centra y escala automáticamente con un Box3.
// =====================================================

function useTryGLTF(path) {
  // useGLTF lanza si falla; envolvemos en try/catch via Suspense boundary externo.
  // Aquí solo cargamos; el fallback primitivo se elige por flag explícito.
  try {
    return useGLTF(path);
  } catch {
    return null;
  }
}

function FittedGroup({ children, autoRotate, hovered }) {
  const ref = useRef(null);
  const { invalidate } = useThree();

  useFrame((_, delta) => {
    if (!ref.current) return;
    if (autoRotate && !hovered) {
      ref.current.rotation.y += delta * 0.35;
      invalidate();
    }
  });

  return <group ref={ref}>{children}</group>;
}

// Geometría primitiva por producto, usada cuando no hay .glb real
function PrimitiveFallback({ id }) {
  if (id === 'maiz') {
    // Cilindro texturizado amarillo (mazorca)
    return (
      <group>
        <mesh castShadow receiveShadow position={[0, 0, 0]}>
          <cylinderGeometry args={[0.55, 0.5, 1.8, 32, 8]} />
          <meshStandardMaterial
            color="#eab308"
            roughness={0.55}
            metalness={0.05}
          />
        </mesh>
        {/* Hojas */}
        {[0, 1, 2].map((i) => (
          <mesh
            key={i}
            castShadow
            position={[
              Math.cos((i / 3) * Math.PI * 2) * 0.45,
              -0.2,
              Math.sin((i / 3) * Math.PI * 2) * 0.45,
            ]}
            rotation={[0.3, (i / 3) * Math.PI * 2, 0.4]}
          >
            <coneGeometry args={[0.18, 1.4, 4, 1, true]} />
            <meshStandardMaterial
              color="#15803d"
              roughness={0.7}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}
      </group>
    );
  }

  if (id === 'sandia') {
    // Esfera achatada verde con franjas oscuras
    return (
      <mesh castShadow receiveShadow scale={[1, 0.85, 1]}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial
          color="#16a34a"
          roughness={0.4}
          metalness={0.05}
        />
      </mesh>
    );
  }

  // frijol: cápsula / vaina
  return (
    <group rotation={[0, 0, Math.PI / 6]}>
      <mesh castShadow receiveShadow>
        <capsuleGeometry args={[0.35, 1.6, 8, 24]} />
        <meshStandardMaterial color="#86efac" roughness={0.5} />
      </mesh>
      {[-0.4, 0, 0.4].map((y) => (
        <mesh key={y} castShadow position={[0, y, 0.2]}>
          <sphereGeometry args={[0.18, 24, 24]} />
          <meshStandardMaterial color="#92400e" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function GLTFContent({ url }) {
  const gltf = useTryGLTF(url);

  // Normaliza el modelo: lo centra en el origen y lo escala a un tamaño objetivo
  const scene = useMemo(() => {
    if (!gltf?.scene) return null;
    const cloned = gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxAxis = Math.max(size.x, size.y, size.z) || 1;
    const target = 2; // tamaño objetivo en unidades world
    cloned.position.sub(center);
    cloned.scale.setScalar(target / maxAxis);
    cloned.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return cloned;
  }, [gltf]);

  if (!scene) return null;
  return <primitive object={scene} />;
}

export default function Model({ product, autoRotate, hovered, useFallback }) {
  // Precarga los tres modelos al montar para transiciones más rápidas
  useEffect(() => {
    if (useFallback) return;
    // No precargar si vamos a usar fallback
  }, [useFallback]);

  return (
    <FittedGroup autoRotate={autoRotate} hovered={hovered}>
      {useFallback ? (
        <PrimitiveFallback id={product.id} />
      ) : (
        <GLTFContent url={product.modelPath} />
      )}
    </FittedGroup>
  );
}
