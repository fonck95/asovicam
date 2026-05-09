import CornModel from './models/CornModel';
import BeanModel from './models/BeanModel';
import WatermelonModel from './models/WatermelonModel';

// =====================================================
// Dispatcher: selecciona el modelo 3D correspondiente al
// producto activo. Una sola ruta de render — sin .glb,
// sin manifests, sin shader hacks. Cada modelo se construye
// con primitivas Three.js + texturas procedurales en canvas.
// =====================================================

const REGISTRY = {
  maiz: CornModel,
  frijol: BeanModel,
  sandia: WatermelonModel,
};

export default function Model({ id }) {
  const Component = REGISTRY[id] ?? CornModel;
  return <Component />;
}
