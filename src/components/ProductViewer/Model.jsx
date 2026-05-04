import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import CornModel from './models/CornModel';
import BeanModel from './models/BeanModel';
import WatermelonModel from './models/WatermelonModel';

// =====================================================
// Carga el modelo del producto activo.
// - Por defecto, los modelos son procedurales detallados
//   (kernels reales en la mazorca, vaina con frijoles
//   visibles, sandía con franjas tipo shader). Funcionan
//   sin descargas externas y se ven profesionales.
// - Si existe un .glb personalizado en /public/models/,
//   se utiliza en su lugar y se ajusta automáticamente.
// =====================================================

const PROCEDURAL_BY_ID = {
  maiz: CornModel,
  frijol: BeanModel,
  sandia: WatermelonModel,
};

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

function ProceduralModel({ id }) {
  const Component = PROCEDURAL_BY_ID[id] ?? CornModel;
  return <Component />;
}

function GLTFContent({ url }) {
  const gltf = useGLTF(url);

  const scene = useMemo(() => {
    if (!gltf?.scene) return null;
    const cloned = gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxAxis = Math.max(size.x, size.y, size.z) || 1;
    const target = 2;
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
  return (
    <FittedGroup autoRotate={autoRotate} hovered={hovered}>
      {useFallback ? (
        <ProceduralModel id={product.id} />
      ) : (
        <GLTFContent url={product.modelPath} />
      )}
    </FittedGroup>
  );
}
