import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const WALL_URL = encodeURI('/models/brick wall 3d model.glb');

const _box = new THREE.Box3();
const _center = new THREE.Vector3();

// A brick-wall GLB placed entirely from props (position/rotation/scale come
// from the panel + keyboard in App). Reports a ready-to-paste collider each
// frame: world-center position, true half-extents, and yaw.
export default function WallPlacer({ position, rotation, scale, onChange }) {
  const group = useRef(null);
  const { scene } = useGLTF(WALL_URL);
  const wall = useRef(scene.clone()).current;
  const baseSize = useRef(new THREE.Vector3(1, 1, 1));
  const acc = useRef(0);

  // Measure the wall's own size once (at identity).
  useEffect(() => {
    _box.setFromObject(wall);
    _box.getSize(baseSize.current);
  }, [wall]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g || !onChange) return;
    acc.current += dt;
    if (acc.current < 0.1) return; // ~10Hz overlay updates
    acc.current = 0;

    _box.setFromObject(g);
    _box.getCenter(_center); // oriented box center in world space
    onChange({
      position: [_center.x, _center.y, _center.z],
      rotation: [g.rotation.x, g.rotation.y, g.rotation.z],
      scale,
      // Unrotated half-extents (the collider carries the rotation separately).
      half: [
        (baseSize.current.x / 2) * scale,
        (baseSize.current.y / 2) * scale,
        (baseSize.current.z / 2) * scale,
      ],
    });
  });

  return (
    <group ref={group} position={position} rotation={rotation} scale={scale}>
      <primitive object={wall} />
    </group>
  );
}

useGLTF.preload(WALL_URL);
