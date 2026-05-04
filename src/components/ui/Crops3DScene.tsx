import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
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
  maizCob: 0xf6c14a,
  maizKernel: 0xfbe26a,
  maizLeaf: 0x4f7a2a,
  sandiaSkin: 0x1f5b2a,
  sandiaStripe: 0x0d3018,
  sandiaLeaf: 0x2f7d3a,
  frijolPod: 0x6fa64d,
  frijolBean: 0x6b4226,
  soil: 0x4b2e16,
  soilTop: 0x6b3f1d,
  grass: 0x3c8c3f,
  pollen: 0xfbe26a,
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

function buildCorn(): THREE.Group {
  const group = new THREE.Group();

  const cob = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.22, 1.1, 24, 6),
    new THREE.MeshStandardMaterial({
      color: PALETTE.maizCob,
      roughness: 0.6,
      metalness: 0.05,
    })
  );
  cob.position.y = 0.7;
  cob.castShadow = true;
  group.add(cob);

  const kernelGeo = new THREE.SphereGeometry(0.06, 8, 6);
  const kernelMat = new THREE.MeshStandardMaterial({
    color: PALETTE.maizKernel,
    roughness: 0.4,
    metalness: 0.1,
    emissive: 0x4a3000,
    emissiveIntensity: 0.15,
  });
  const rows = 9;
  const cols = 14;
  const kernels = new THREE.InstancedMesh(kernelGeo, kernelMat, rows * cols);
  const m = new THREE.Matrix4();
  let ix = 0;
  for (let r = 0; r < rows; r++) {
    const v = r / (rows - 1);
    const yLocal = THREE.MathUtils.lerp(0.18, 1.22, v);
    const radius = THREE.MathUtils.lerp(0.27, 0.21, v);
    const offset = (r % 2) * (Math.PI / cols);
    for (let c = 0; c < cols; c++) {
      const a = (c / cols) * Math.PI * 2 + offset;
      const x = Math.cos(a) * radius;
      const z = Math.sin(a) * radius;
      m.makeRotationY(a);
      m.setPosition(x, yLocal, z);
      kernels.setMatrixAt(ix++, m);
    }
  }
  kernels.instanceMatrix.needsUpdate = true;
  kernels.castShadow = true;
  group.add(kernels);

  const leafMat = new THREE.MeshStandardMaterial({
    color: PALETTE.maizLeaf,
    roughness: 0.7,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 3; i++) {
    const leafGeo = new THREE.PlaneGeometry(0.18, 1.4, 1, 8);
    const lp = leafGeo.attributes.position;
    for (let j = 0; j < lp.count; j++) {
      const y = lp.getY(j);
      const t = (y + 0.7) / 1.4;
      lp.setX(j, lp.getX(j) * (1 - t * 0.7));
      lp.setZ(j, Math.sin(t * Math.PI) * 0.15);
    }
    leafGeo.computeVertexNormals();
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    const a = (i / 3) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 0.12, 0.55, Math.sin(a) * 0.12);
    leaf.rotation.y = a + Math.PI / 2;
    leaf.rotation.z = -0.35;
    leaf.castShadow = true;
    group.add(leaf);
  }

  return group;
}

function buildWatermelon(): THREE.Group {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 48, 32),
    new THREE.MeshStandardMaterial({
      color: PALETTE.sandiaSkin,
      roughness: 0.45,
      metalness: 0.05,
    })
  );
  body.position.y = 0.85;
  body.scale.set(1.0, 0.95, 1.0);
  body.castShadow = true;
  group.add(body);

  const stripeMat = new THREE.MeshStandardMaterial({
    color: PALETTE.sandiaStripe,
    roughness: 0.5,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 8; i++) {
    const stripeGeo = new THREE.TorusGeometry(0.555, 0.05, 6, 64, Math.PI);
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.y = 0.85;
    stripe.rotation.y = (i / 8) * Math.PI * 2;
    stripe.rotation.x = Math.PI / 2;
    stripe.scale.set(1.0, 0.95, 1.0);
    group.add(stripe);
  }

  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.045, 0.18, 8),
    new THREE.MeshStandardMaterial({ color: 0x5b3a1a, roughness: 0.9 })
  );
  stem.position.y = 1.45;
  group.add(stem);

  const leafGeo = new THREE.SphereGeometry(0.15, 12, 8);
  const lp = leafGeo.attributes.position;
  for (let j = 0; j < lp.count; j++) {
    lp.setY(j, lp.getY(j) * 0.18);
  }
  leafGeo.computeVertexNormals();
  const leaf = new THREE.Mesh(
    leafGeo,
    new THREE.MeshStandardMaterial({
      color: PALETTE.sandiaLeaf,
      roughness: 0.6,
      side: THREE.DoubleSide,
    })
  );
  leaf.position.set(0.12, 1.55, 0);
  leaf.rotation.z = -0.4;
  leaf.castShadow = true;
  group.add(leaf);

  return group;
}

function buildBeans(): THREE.Group {
  const group = new THREE.Group();

  const stalk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.05, 1.0, 8),
    new THREE.MeshStandardMaterial({ color: 0x3a5e1a, roughness: 0.9 })
  );
  stalk.position.y = 0.65;
  group.add(stalk);

  const podMat = new THREE.MeshStandardMaterial({
    color: PALETTE.frijolPod,
    roughness: 0.55,
    metalness: 0.05,
  });

  for (let i = 0; i < 4; i++) {
    const podGroup = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.1, 0.06, 0.05),
      new THREE.Vector3(0.25, 0.1, 0.0),
      new THREE.Vector3(0.4, 0.06, -0.05),
      new THREE.Vector3(0.5, 0, 0),
    ]);
    const podGeo = new THREE.TubeGeometry(curve, 24, 0.06, 10, false);
    const pod = new THREE.Mesh(podGeo, podMat);
    pod.castShadow = true;
    podGroup.add(pod);

    const beanMat = new THREE.MeshStandardMaterial({
      color: PALETTE.frijolBean,
      roughness: 0.5,
      metalness: 0.2,
    });
    for (let b = 0; b < 4; b++) {
      const bean = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 12, 8),
        beanMat
      );
      bean.scale.set(1.1, 0.7, 0.7);
      bean.position.set(0.07 + b * 0.11, 0.07, 0);
      podGroup.add(bean);
    }

    const angle = (i / 4) * Math.PI * 2;
    podGroup.position.set(
      Math.cos(angle) * 0.08,
      0.45 + i * 0.18,
      Math.sin(angle) * 0.08
    );
    podGroup.rotation.y = angle;
    podGroup.rotation.z = -0.15;
    group.add(podGroup);
  }

  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x4f8a2a,
    roughness: 0.7,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 10, 8),
      leafMat
    );
    leaf.scale.set(1.0, 0.12, 0.7);
    const a = (i / 6) * Math.PI * 2;
    const y = 0.4 + i * 0.13;
    leaf.position.set(Math.cos(a) * 0.18, y, Math.sin(a) * 0.18);
    leaf.rotation.y = a;
    leaf.rotation.z = -0.25;
    group.add(leaf);
  }

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

const CROP_BUILDERS: Record<CropKey, () => THREE.Group> = {
  maiz: buildCorn,
  sandia: buildWatermelon,
  frijol: buildBeans,
};

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

interface Crops3DSceneProps {
  className?: string;
}

export default function Crops3DScene({ className = '' }: Crops3DSceneProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [supported] = useState(detectWebGLSupport);

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

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0a1d12, 8, 22);

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
      const crop = CROP_BUILDERS[key]();
      pivot.add(crop);
      root.add(pivot);
      return {
        group: crop,
        pivot,
        basePosition: pivot.position.clone(),
        baseScale: 1,
        hover: 0,
        phase: i * 1.7,
        spin: key === 'sandia' ? 0.25 : 0.18,
        key,
      };
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
      cancelAnimationFrame(raf);
      ro.disconnect();
      wrapper.removeEventListener('pointermove', handlePointerMove);
      wrapper.removeEventListener('pointerleave', handlePointerLeave);
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
    </div>
  );
}
