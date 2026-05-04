import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import styles from './Crops3DScene.module.css';

type CropKey = 'maiz' | 'sandia' | 'frijol';

interface CropMount {
  group: THREE.Group;
  pivot: THREE.Group;
  basePosition: THREE.Vector3;
  baseScale: number;
  hover: number;
  phase: number;
  spin: number;
  key: CropKey;
}

const PALETTE = {
  soil: 0x4b2e16,
  soilTop: 0x6b3f1d,
  grass: 0x3c8c3f,
  pollen: 0xfbe26a,
};

interface ModelSpec {
  url: string;
  targetHeight: number;
  yOffset: number;
}

const MODEL_SPECS: Record<CropKey, ModelSpec> = {
  maiz: { url: '/models/corn.glb', targetHeight: 1.8, yOffset: 0.32 },
  sandia: { url: '/models/watermelon.glb', targetHeight: 1.0, yOffset: 0.32 },
  frijol: { url: '/models/beanstalk.glb', targetHeight: 1.9, yOffset: 0.32 },
};

function buildSoilIsland(): THREE.Group {
  const group = new THREE.Group();

  const geo = new THREE.CylinderGeometry(1.2, 0.85, 0.6, 32, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > 0.25) {
      const noise = (Math.random() - 0.5) * 0.08;
      pos.setY(i, y + noise);
      pos.setX(i, pos.getX(i) + (Math.random() - 0.5) * 0.05);
      pos.setZ(i, pos.getZ(i) + (Math.random() - 0.5) * 0.05);
    }
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: PALETTE.soil,
    roughness: 0.95,
    metalness: 0.0,
    flatShading: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  const topGeo = new THREE.CircleGeometry(1.18, 32);
  const topMat = new THREE.MeshStandardMaterial({
    color: PALETTE.soilTop,
    roughness: 1.0,
  });
  const top = new THREE.Mesh(topGeo, topMat);
  top.rotation.x = -Math.PI / 2;
  top.position.y = 0.305;
  top.receiveShadow = true;
  group.add(top);

  const tuftMat = new THREE.MeshStandardMaterial({
    color: PALETTE.grass,
    roughness: 0.7,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 7; i++) {
    const blade = new THREE.Mesh(
      new THREE.ConeGeometry(0.04, 0.22, 4, 1),
      tuftMat
    );
    const angle = Math.random() * Math.PI * 2;
    const r = 0.55 + Math.random() * 0.5;
    blade.position.set(Math.cos(angle) * r, 0.41, Math.sin(angle) * r);
    blade.rotation.z = (Math.random() - 0.5) * 0.4;
    blade.rotation.x = (Math.random() - 0.5) * 0.4;
    group.add(blade);
  }

  return group;
}

function normalizeModel(root: THREE.Object3D, spec: ModelSpec): THREE.Group {
  const wrapper = new THREE.Group();
  wrapper.add(root);

  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const height = Math.max(size.y, 0.001);
  const scale = spec.targetHeight / height;
  root.scale.setScalar(scale);

  root.position.x -= center.x * scale;
  root.position.z -= center.z * scale;
  root.position.y -= box.min.y * scale;
  root.position.y += spec.yOffset;

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const mat = mesh.material as
        | THREE.MeshStandardMaterial
        | THREE.MeshStandardMaterial[]
        | undefined;
      const tune = (m: THREE.Material) => {
        const sm = m as THREE.MeshStandardMaterial;
        if ('roughness' in sm) sm.roughness = Math.min(1, (sm.roughness ?? 0.7) * 0.9 + 0.1);
        if ('metalness' in sm) sm.metalness = Math.min(0.2, sm.metalness ?? 0);
        sm.envMapIntensity = 0.9;
        sm.needsUpdate = true;
      };
      if (Array.isArray(mat)) mat.forEach(tune);
      else if (mat) tune(mat);
    }
  });

  return wrapper;
}

function buildPlaceholder(key: CropKey): THREE.Group {
  const group = new THREE.Group();
  const color = key === 'maiz' ? 0xf6c14a : key === 'sandia' ? 0x1f5b2a : 0x6fa64d;
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 1.2, 12),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7 })
  );
  stem.position.y = 0.9;
  stem.castShadow = true;
  group.add(stem);
  return group;
}

function buildPollen(): THREE.Points {
  const count = 240;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 12;
    positions[i * 3 + 1] = Math.random() * 4 - 0.5;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 8;
    seeds[i] = Math.random();
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
  const mat = new THREE.PointsMaterial({
    color: PALETTE.pollen,
    size: 0.05,
    transparent: true,
    opacity: 0.7,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Points(geo, mat);
}

const CROP_LAYOUT: { key: CropKey; x: number }[] = [
  { key: 'maiz', x: -2.6 },
  { key: 'sandia', x: 0 },
  { key: 'frijol', x: 2.6 },
];

function detectWebGLSupport(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const probe = document.createElement('canvas');
    return !!(
      probe.getContext('webgl2') ||
      probe.getContext('webgl') ||
      probe.getContext('experimental-webgl')
    );
  } catch {
    return false;
  }
}

const modelCache = new Map<string, Promise<THREE.Group>>();
function loadModel(spec: ModelSpec): Promise<THREE.Group> {
  let cached = modelCache.get(spec.url);
  if (!cached) {
    const loader = new GLTFLoader();
    cached = new Promise<THREE.Group>((resolve, reject) => {
      loader.load(
        spec.url,
        (gltf) => resolve(gltf.scene),
        undefined,
        (err) => reject(err)
      );
    });
    modelCache.set(spec.url, cached);
  }
  return cached.then((scene) => scene.clone(true));
}

interface Crops3DSceneProps {
  className?: string;
}

export default function Crops3DScene({ className = '' }: Crops3DSceneProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [supported] = useState(detectWebGLSupport);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supported) return;
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0a1d12, 8, 22);

    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x223844);
    const envLightTop = new THREE.Mesh(
      new THREE.SphereGeometry(50, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffe6b0, side: THREE.BackSide })
    );
    envScene.add(envLightTop);
    const envTarget = pmrem.fromScene(envScene, 0.04);
    scene.environment = envTarget.texture;

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 2.6, 8.2);
    camera.lookAt(0, 1, 0);

    const hemi = new THREE.HemisphereLight(0xfff1c2, 0x1a3a1a, 0.65);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffd9a0, 1.5);
    sun.position.set(4, 6, 3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -6;
    sun.shadow.camera.right = 6;
    sun.shadow.camera.top = 6;
    sun.shadow.camera.bottom = -6;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 20;
    sun.shadow.bias = -0.0008;
    scene.add(sun);

    const rim = new THREE.DirectionalLight(0x8fffd0, 0.35);
    rim.position.set(-4, 3, -3);
    scene.add(rim);

    const root = new THREE.Group();
    scene.add(root);

    const mounts: CropMount[] = CROP_LAYOUT.map(({ key, x }, i) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0, 0);
      const island = buildSoilIsland();
      pivot.add(island);
      const placeholder = buildPlaceholder(key);
      pivot.add(placeholder);
      root.add(pivot);
      return {
        group: placeholder,
        pivot,
        basePosition: pivot.position.clone(),
        baseScale: 1,
        hover: 0,
        phase: i * 1.7,
        spin: key === 'sandia' ? 0.25 : 0.18,
        key,
      };
    });

    let cancelled = false;
    Promise.all(
      CROP_LAYOUT.map(({ key }) => loadModel(MODEL_SPECS[key]).then((scene) => ({ key, scene })))
    )
      .then((loaded) => {
        if (cancelled) return;
        loaded.forEach(({ key, scene: modelScene }) => {
          const mount = mounts.find((m) => m.key === key);
          if (!mount) return;
          mount.pivot.remove(mount.group);
          const normalized = normalizeModel(modelScene, MODEL_SPECS[key]);
          mount.pivot.add(normalized);
          mount.group = normalized;
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error loading crop models', err);
        setLoading(false);
      });

    const pollen = buildPollen();
    scene.add(pollen);

    const groundShadow = new THREE.Mesh(
      new THREE.CircleGeometry(8, 48),
      new THREE.ShadowMaterial({ opacity: 0.25 })
    );
    groundShadow.rotation.x = -Math.PI / 2;
    groundShadow.position.y = -0.31;
    groundShadow.receiveShadow = true;
    scene.add(groundShadow);

    const pointer = new THREE.Vector2(0, 0);
    const targetPointer = new THREE.Vector2(0, 0);
    const raycaster = new THREE.Raycaster();
    let hoveredKey: CropKey | null = null;

    const handlePointerMove = (e: PointerEvent) => {
      const rect = wrapper.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      targetPointer.set(nx, ny);

      raycaster.setFromCamera(targetPointer, camera);
      const hits = raycaster.intersectObjects(
        mounts.map((m) => m.pivot),
        true
      );
      if (hits.length > 0) {
        let obj: THREE.Object3D | null = hits[0].object;
        while (obj && obj.parent) {
          const found = mounts.find((m) => m.pivot === obj);
          if (found) {
            hoveredKey = found.key;
            return;
          }
          obj = obj.parent;
        }
      }
      hoveredKey = null;
    };
    const handlePointerLeave = () => {
      hoveredKey = null;
      targetPointer.set(0, 0);
    };

    const resize = () => {
      const rect = wrapper.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    canvas.dataset.active = 'true';

    const ro = new ResizeObserver(resize);
    ro.observe(wrapper);

    wrapper.addEventListener('pointermove', handlePointerMove);
    wrapper.addEventListener('pointerleave', handlePointerLeave);

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    const clock = new THREE.Clock();
    let raf = 0;
    const tmpVec = new THREE.Vector3();

    const animate = () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      pointer.lerp(targetPointer, 0.08);
      root.rotation.y = pointer.x * 0.35;
      root.rotation.x = -pointer.y * 0.12;
      camera.position.x = pointer.x * 0.4;
      camera.position.y = 2.6 + pointer.y * 0.25;
      camera.lookAt(0, 1, 0);

      mounts.forEach((mount) => {
        const isHover = mount.key === hoveredKey ? 1 : 0;
        mount.hover += (isHover - mount.hover) * Math.min(1, dt * 8);
        mount.group.rotation.y += mount.spin * dt;
        const bob = Math.sin(t * 1.2 + mount.phase) * 0.06;
        mount.pivot.position.y = mount.basePosition.y + bob + mount.hover * 0.18;
        const s = 1 + mount.hover * 0.12;
        mount.pivot.scale.setScalar(s);
      });

      const posAttr = pollen.geometry.getAttribute(
        'position'
      ) as THREE.BufferAttribute;
      const seedAttr = pollen.geometry.getAttribute(
        'seed'
      ) as THREE.BufferAttribute;
      for (let i = 0; i < posAttr.count; i++) {
        const seed = seedAttr.getX(i);
        tmpVec.fromBufferAttribute(posAttr, i);
        tmpVec.y += (0.12 + seed * 0.2) * dt;
        tmpVec.x += Math.sin(t * 0.6 + seed * 6.28) * 0.002;
        if (tmpVec.y > 4) {
          tmpVec.y = -0.5;
          tmpVec.x = (Math.random() - 0.5) * 12;
          tmpVec.z = (Math.random() - 0.5) * 8;
        }
        posAttr.setXYZ(i, tmpVec.x, tmpVec.y, tmpVec.z);
      }
      posAttr.needsUpdate = true;

      renderer.render(scene, camera);
      if (!reduceMotion) {
        raf = requestAnimationFrame(animate);
      }
    };
    animate();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      wrapper.removeEventListener('pointermove', handlePointerMove);
      wrapper.removeEventListener('pointerleave', handlePointerLeave);
      pmrem.dispose();
      envTarget.dispose();
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).geometry) {
          (obj as THREE.Mesh).geometry.dispose();
        }
        const mat = (obj as THREE.Mesh).material;
        if (mat) {
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else (mat as THREE.Material).dispose();
        }
      });
      renderer.dispose();
    };
  }, [supported]);

  return (
    <div ref={wrapperRef} className={`${styles.wrapper} ${className}`}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        data-active="false"
        aria-label="Escena 3D interactiva: maíz, sandía y frijol sobre tierra fértil"
      />
      {!supported && (
        <div className={styles.fallback}>
          Tu navegador no puede renderizar la escena 3D. Las imágenes y datos de
          la milpa siguen disponibles abajo.
        </div>
      )}
      {supported && loading && (
        <div className={styles.loading} aria-hidden="true">
          Cargando modelos 3D…
        </div>
      )}
      <span className={styles.hint}>Mueve el cursor para explorar</span>
      <div className={styles.legend} aria-hidden="true">
        <span className={styles.chip}>
          <span
            className={styles.dot}
            style={{ background: 'var(--color-maiz)' }}
          />
          Maíz
        </span>
        <span className={styles.chip}>
          <span
            className={styles.dot}
            style={{ background: 'var(--color-sandia)' }}
          />
          Sandía
        </span>
        <span className={styles.chip}>
          <span
            className={styles.dot}
            style={{ background: 'var(--color-frijol)' }}
          />
          Frijol caupí
        </span>
      </div>
      <span className={styles.credits}>
        Modelos 3D: Quaternius (CC0), Kenney (CC0), Poly by Google (CC-BY)
      </span>
    </div>
  );
}
