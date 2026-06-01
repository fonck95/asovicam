import { Suspense } from 'react';
import { useGLTF } from '@react-three/drei';
import { CONFIG } from './config';
import CornModel from '../ProductViewer/models/CornModel';
import BeanModel from '../ProductViewer/models/BeanModel';
import WatermelonModel from '../ProductViewer/models/WatermelonModel';

// =====================================================
// Modelo protagonista. Dos rutas:
//   • CONFIG.MODEL_URL definido → carga tu .glb con DRACOLoader.
//   • Si es null → usa el modelo PROCEDURAL de ASOVICAM (maíz/frijol/sandía).
// El <group> exterior (rotación/escala/posición vía scroll) lo controla
// Stage.jsx; aquí solo decidimos QUÉ se renderiza dentro de él.
//
// `modelId` lo decide el producto activo (ver products.js): la experiencia
// ya no está cableada al maíz, sino que recibe el modelo a mostrar.
// =====================================================

const PROCEDURAL = {
  maiz: CornModel,
  frijol: BeanModel,
  sandia: WatermelonModel,
};

function GLBModel({ url }) {
  // drei.useGLTF acepta la ruta del decoder DRACO como 2º argumento.
  // Suspende hasta que el .glb esté listo (lo cubre el ProgressLoader).
  const { scene } = useGLTF(url, CONFIG.DRACO_PATH);
  return <primitive object={scene} />;
}

export default function ProtagonistModel({ modelId = CONFIG.MODEL_ID }) {
  if (CONFIG.MODEL_URL) {
    return (
      <Suspense fallback={null}>
        <GLBModel url={CONFIG.MODEL_URL} />
      </Suspense>
    );
  }
  const Procedural = PROCEDURAL[modelId] ?? CornModel;
  return <Procedural />;
}

// Pre-carga del .glb (mejora el time-to-interactive) si se configuró uno.
if (CONFIG.MODEL_URL) {
  useGLTF.preload(CONFIG.MODEL_URL, CONFIG.DRACO_PATH);
}
