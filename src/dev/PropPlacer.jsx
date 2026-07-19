import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const _box = new THREE.Box3();

// The prop being placed, rendered entirely from props (position/rotation/scale
// come from the panel + keyboard in App). Reports the world-space bottom Y each
// frame so the panel can offer a "drop to floor" button.
export default function PropPlacer({ url, position, rotation, scale, onMeasure }) {
  const group = useRef(null);
  const { scene } = useGLTF(url);
  const model = useMemo(() => scene.clone(), [scene]);
  const acc = useRef(0);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g || !onMeasure) return;
    acc.current += dt;
    if (acc.current < 0.1) return; // ~10Hz
    acc.current = 0;
    _box.setFromObject(g);
    onMeasure({ minY: _box.min.y });
  });

  return (
    <group ref={group} position={position} rotation={rotation} scale={scale}>
      <primitive object={model} />
    </group>
  );
}

useGLTF.preload('/models/chair.glb');
useGLTF.preload('/models/chair2.glb');
